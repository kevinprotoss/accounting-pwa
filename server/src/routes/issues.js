import fs from 'node:fs';
import { db, enqueueWrite, logChange } from '../db.js';
import { enqueueInvoice, isGenerating } from '../services/pdf-queue.js';
import { trashFile } from '../utils/trash.js';

function normalizeIssue(body) {
  return {
    issue_number: String(body.issue_number ?? '').trim(),
    date: body.date || new Date().toISOString().slice(0, 10),
    customer_id: body.customer_id ?? null,
    customer_name: body.customer_name || null,
    customer_address: body.customer_address || null,
    customer_vat_id: body.customer_vat_id || null,
    invoice_number: body.invoice_number ? String(body.invoice_number).trim() : null,
    is_export: body.is_export ? 1 : 0,
    carrier: body.carrier || null,
    tracking_number: body.tracking_number || null,
    shipping_date: body.shipping_date || null,
    export_customs_number: body.export_customs_number || null,
    export_customs_date: body.export_customs_date || null,
    export_location: body.export_location || null,
    export_attachment_path: body.export_attachment_path || null,
    payment_attachment_paths: body.payment_attachment_paths || null,
    bank_reference: body.bank_reference || null,
    payment_received_date: body.payment_received_date || null,
    status: body.status || 'open',
    remarks: body.remarks || null,
  };
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => ({
      receipt_item_id: Number(it.receipt_item_id) || 0,
      quantity: Number(it.quantity) || 0,
      selling_net_price: Number(it.selling_net_price) || 0,
      tax_rate: Number(it.tax_rate) ?? 19,
    }))
    .filter((it) => it.receipt_item_id && it.quantity > 0);
}

function calcTotals(items, isExport) {
  const netTotal = items.reduce(
    (s, it) => s + it.quantity * it.selling_net_price,
    0
  );
  const taxTotal = isExport
    ? 0
    : items.reduce(
        (s, it) => s + (it.quantity * it.selling_net_price * it.tax_rate) / 100,
        0
      );
  return { netTotal, taxTotal, grossTotal: netTotal + taxTotal };
}

function getAvailable(receiptItemId, excludeIssueId = null) {
  const ri = db
    .prepare('SELECT quantity FROM goods_receipt_items WHERE id = ?')
    .get(receiptItemId);
  if (!ri) return 0;
  let issued = db
    .prepare(
      'SELECT COALESCE(SUM(quantity), 0) AS q FROM goods_issue_items WHERE receipt_item_id = ?'
    )
    .get(receiptItemId).q;
  if (excludeIssueId) {
    const self = db
      .prepare(
        'SELECT COALESCE(SUM(quantity), 0) AS q FROM goods_issue_items WHERE issue_id = ? AND receipt_item_id = ?'
      )
      .get(excludeIssueId, receiptItemId).q;
    issued -= self;
  }
  return ri.quantity - issued;
}

function validateStock(items, excludeIssueId = null) {
  for (const it of items) {
    const available = getAvailable(it.receipt_item_id, excludeIssueId);
    if (it.quantity > available + 1e-9) {
      const ri = db
        .prepare('SELECT product_name FROM goods_receipt_items WHERE id = ?')
        .get(it.receipt_item_id);
      const name = ri?.product_name ?? `批次 ${it.receipt_item_id}`;
      throw new Error(`「${name}」库存不足，可用 ${available}，请求 ${it.quantity}`);
    }
  }
}

function generateInvoiceNumberForToday() {
  const today = new Date();
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const prefix = `INV-${ymd}-`;

  const rows = db
    .prepare('SELECT invoice_number FROM goods_issues WHERE invoice_number LIKE ?')
    .all(`${prefix}%`);

  const used = new Set();
  for (const r of rows) {
    const n = parseInt(r.invoice_number.slice(prefix.length), 10);
    if (!Number.isNaN(n)) used.add(n);
  }

  let next = 1;
  while (used.has(next)) next++;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

function getInvoice(issueId) {
  return db.prepare('SELECT * FROM invoices WHERE issue_id = ?').get(issueId) ?? null;
}

const insertItemStmt = db.prepare(`
  INSERT INTO goods_issue_items (issue_id, receipt_item_id, quantity, selling_net_price, tax_rate)
  VALUES (?, ?, ?, ?, ?)
`);

export default async function issuesRoutes(app) {
  app.get('/next-invoice-number', async () => {
    return { invoice_number: generateInvoiceNumberForToday() };
  });

  app.get('/', async () => {
    return db
      .prepare(
        `SELECT i.*,
          (SELECT COUNT(*) FROM goods_issue_items gi WHERE gi.issue_id = i.id) AS item_count,
          (SELECT COALESCE(SUM(quantity * selling_net_price), 0) FROM goods_issue_items gi WHERE gi.issue_id = i.id) AS net_total,
          (SELECT COALESCE(SUM(quantity * selling_net_price * (1 + tax_rate / 100.0)), 0) FROM goods_issue_items gi WHERE gi.issue_id = i.id) AS gross_total,
          (SELECT pdf_path FROM invoices WHERE issue_id = i.id) AS invoice_pdf_path
         FROM goods_issues i
         ORDER BY i.date DESC, i.id DESC`
      )
      .all();
  });

  app.get('/:id/invoice', async (req, reply) => {
    const id = Number(req.params.id);
    const issue = db.prepare('SELECT id FROM goods_issues WHERE id = ?').get(id);
    if (!issue) return reply.code(404).send({ error: 'Issue not found' });
    return { invoice: getInvoice(id) };
  });

  app.post('/:id/regenerate-invoice', async (req, reply) => {
    const id = Number(req.params.id);
    const issue = db.prepare('SELECT id FROM goods_issues WHERE id = ?').get(id);
    if (!issue) return reply.code(404).send({ error: 'Issue not found' });

    const invoice = getInvoice(id);
    if (!invoice) return reply.code(404).send({ error: 'Invoice not found' });

    if (invoice.pdf_path && fs.existsSync(invoice.pdf_path)) {
      return { status: 'ready' };
    }

    if (invoice.pdf_path) {
      await enqueueWrite(() => {
        db.prepare('UPDATE invoices SET pdf_path = NULL WHERE issue_id = ?').run(id);
      });
    }

    const status = enqueueInvoice(id);
    return { status };
  });

  app.get('/:id/invoice.pdf', async (req, reply) => {
    const id = Number(req.params.id);
    const invoice = getInvoice(id);
    if (!invoice || !invoice.pdf_path) {
      return reply.code(404).send({ error: 'PDF not ready' });
    }
    if (!fs.existsSync(invoice.pdf_path)) {
      return reply.code(404).send({ error: 'PDF file missing' });
    }
    try {
      const buffer = await fs.promises.readFile(invoice.pdf_path);
      reply
        .header('Content-Type', 'application/pdf')
        .header(
          'Content-Disposition',
          `attachment; filename="${invoice.invoice_number}.pdf"`
        )
        .send(buffer);
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'Failed to read PDF' });
    }
  });

  app.get('/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const issue = db.prepare('SELECT * FROM goods_issues WHERE id = ?').get(id);
    if (!issue) return reply.code(404).send({ error: 'Issue not found' });
    const items = db
      .prepare(
        `SELECT gi.*, ri.product_name, ri.net_unit_price AS purchase_price
         FROM goods_issue_items gi
         JOIN goods_receipt_items ri ON ri.id = gi.receipt_item_id
         WHERE gi.issue_id = ?
         ORDER BY gi.id`
      )
      .all(id);
    return { ...issue, items, invoice: getInvoice(id) };
  });

  app.post('/', async (req, reply) => {
    const data = normalizeIssue(req.body ?? {});
    const items = normalizeItems(req.body?.items);
    if (!data.issue_number)
      return reply.code(400).send({ error: 'issue_number is required' });
    if (!data.invoice_number)
      return reply.code(400).send({ error: '发票号不能为空' });
    if (items.length === 0)
      return reply.code(400).send({ error: '至少需要一条有效明细' });

    try {
      validateStock(items);
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }

    try {
      const created = await enqueueWrite(() => {
        const tx = db.transaction(() => {
          const info = db
            .prepare(
              `INSERT INTO goods_issues
                (issue_number, date, customer_id, customer_name, customer_address, customer_vat_id,
                 invoice_number, is_export, carrier, tracking_number, shipping_date,
                 export_customs_number, export_customs_date, export_location,
                 export_attachment_path, payment_attachment_paths,
                 bank_reference, payment_received_date, status, remarks)
               VALUES
                (@issue_number, @date, @customer_id, @customer_name, @customer_address, @customer_vat_id,
                 @invoice_number, @is_export, @carrier, @tracking_number, @shipping_date,
                 @export_customs_number, @export_customs_date, @export_location,
                 @export_attachment_path, @payment_attachment_paths,
                 @bank_reference, @payment_received_date, @status, @remarks)`
            )
            .run(data);
          const issueId = info.lastInsertRowid;

          for (const it of items) {
            insertItemStmt.run(
              issueId,
              it.receipt_item_id,
              it.quantity,
              it.selling_net_price,
              it.tax_rate
            );
          }

          const { netTotal, taxTotal, grossTotal } = calcTotals(items, data.is_export === 1);
          db.prepare(
            `INSERT INTO invoices (invoice_number, issue_id, pdf_path, net_total, tax_total, gross_total)
             VALUES (?, ?, NULL, ?, ?, ?)`
          ).run(data.invoice_number, issueId, netTotal, taxTotal, grossTotal);

          return issueId;
        });
        const issueId = tx();
        const row = db.prepare('SELECT * FROM goods_issues WHERE id = ?').get(issueId);
        const rowItems = db
          .prepare('SELECT * FROM goods_issue_items WHERE issue_id = ?')
          .all(issueId);
        logChange('goods_issues', issueId, 'create', null, { ...row, items: rowItems });
        return { ...row, items: rowItems, invoice: getInvoice(issueId) };
      });

      enqueueInvoice(created.id);

      return reply.code(201).send(created);
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) {
        return reply
          .code(409)
          .send({ error: '单号或发票号已被使用，请刷新后重试' });
      }
      throw err;
    }
  });

  app.put('/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const data = normalizeIssue(req.body ?? {});
    const items = normalizeItems(req.body?.items);
    if (!data.issue_number)
      return reply.code(400).send({ error: 'issue_number is required' });
    if (!data.invoice_number)
      return reply.code(400).send({ error: '发票号不能为空' });
    if (items.length === 0)
      return reply.code(400).send({ error: '至少需要一条有效明细' });

    const oldIssue = db.prepare('SELECT * FROM goods_issues WHERE id = ?').get(id);
    if (!oldIssue) return reply.code(404).send({ error: 'Issue not found' });

    if (data.invoice_number !== oldIssue.invoice_number) {
      return reply.code(400).send({ error: '发票号不允许修改' });
    }

    try {
      validateStock(items, id);
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }

    try {
      const result = await enqueueWrite(() => {
        const tx = db.transaction(() => {
          const old = db.prepare('SELECT * FROM goods_issues WHERE id = ?').get(id);
          if (!old) return null;
          const oldItems = db
            .prepare('SELECT * FROM goods_issue_items WHERE issue_id = ?')
            .all(id);

          db.prepare(
            `UPDATE goods_issues SET
              issue_number = @issue_number,
              date = @date,
              customer_id = @customer_id,
              customer_name = @customer_name,
              customer_address = @customer_address,
              customer_vat_id = @customer_vat_id,
              is_export = @is_export,
              carrier = @carrier,
              tracking_number = @tracking_number,
              shipping_date = @shipping_date,
              export_customs_number = @export_customs_number,
              export_customs_date = @export_customs_date,
              export_location = @export_location,
              export_attachment_path = @export_attachment_path,
              payment_attachment_paths = @payment_attachment_paths,
              bank_reference = @bank_reference,
              payment_received_date = @payment_received_date,
              status = @status,
              remarks = @remarks,
              updated_at = CURRENT_TIMESTAMP
             WHERE id = @id`
          ).run({ id, ...data });

          db.prepare('DELETE FROM goods_issue_items WHERE issue_id = ?').run(id);
          for (const it of items) {
            insertItemStmt.run(
              id,
              it.receipt_item_id,
              it.quantity,
              it.selling_net_price,
              it.tax_rate
            );
          }

          const { netTotal, taxTotal, grossTotal } = calcTotals(items, data.is_export === 1);
          db.prepare(
            `UPDATE invoices
             SET pdf_path = NULL, net_total = ?, tax_total = ?, gross_total = ?
             WHERE issue_id = ?`
          ).run(netTotal, taxTotal, grossTotal, id);

          return { old, oldItems };
        });

        const ctx = tx();
        if (!ctx) return null;
        const updated = db.prepare('SELECT * FROM goods_issues WHERE id = ?').get(id);
        const updatedItems = db
          .prepare('SELECT * FROM goods_issue_items WHERE issue_id = ?')
          .all(id);
        logChange(
          'goods_issues',
          id,
          'update',
          { ...ctx.old, items: ctx.oldItems },
          { ...updated, items: updatedItems }
        );
        return { ...updated, items: updatedItems, invoice: getInvoice(id) };
      });

      if (!result) return reply.code(404).send({ error: 'Issue not found' });

      enqueueInvoice(id);

      return result;
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) {
        return reply.code(409).send({ error: '单号已被使用' });
      }
      throw err;
    }
  });

  app.delete('/:id', async (req, reply) => {
    const id = Number(req.params.id);
    try {
      const result = await enqueueWrite(() => {
        const old = db.prepare('SELECT * FROM goods_issues WHERE id = ?').get(id);
        if (!old) return { found: false };
        const invoice = db
          .prepare('SELECT pdf_path FROM invoices WHERE issue_id = ?')
          .get(id);
        const oldItems = db
          .prepare('SELECT * FROM goods_issue_items WHERE issue_id = ?')
          .all(id);
        db.prepare('DELETE FROM goods_issues WHERE id = ?').run(id);
        logChange('goods_issues', id, 'delete', { ...old, items: oldItems }, null);
        return { found: true, pdfPath: invoice?.pdf_path ?? null };
      });

      if (!result.found) return reply.code(404).send({ error: 'Issue not found' });
      if (result.pdfPath) trashFile(result.pdfPath);
      return reply.code(204).send();
    } catch (err) {
      if (String(err.message).includes('FOREIGN KEY')) {
        return reply
          .code(409)
          .send({ error: '该销售单已关联付款订单，无法删除' });
      }
      throw err;
    }
  });
}