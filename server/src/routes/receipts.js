import { db, enqueueWrite, logChange } from '../db.js';

function normalizeReceipt(body) {
  return {
    receipt_number: String(body.receipt_number ?? '').trim(),
    date: body.date || new Date().toISOString().slice(0, 10),
    supplier: body.supplier || null,
    supplier_invoice: body.supplier_invoice || null,
    remarks: body.remarks || null,
    attachment_path: body.attachment_path || null,
  };
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => ({
      id: it.id ? Number(it.id) : null,
      product_name: String(it.product_name ?? '').trim(),
      quantity: Number(it.quantity) || 0,
      net_unit_price: Number(it.net_unit_price) || 0,
      tax_rate: Number(it.tax_rate) ?? 19,
    }))
    .filter((it) => it.product_name && it.quantity > 0);
}

const insertItemStmt = db.prepare(`
  INSERT INTO goods_receipt_items (receipt_id, product_name, quantity, net_unit_price, tax_rate)
  VALUES (?, ?, ?, ?, ?)
`);

export default async function receiptsRoutes(app) {
  app.get('/', async () => {
    return db
      .prepare(
        `SELECT r.*,
          (SELECT COUNT(*) FROM goods_receipt_items i WHERE i.receipt_id = r.id) AS item_count,
          (SELECT COALESCE(SUM(quantity * net_unit_price), 0) FROM goods_receipt_items i WHERE i.receipt_id = r.id) AS net_total,
          (SELECT COALESCE(SUM(quantity * net_unit_price * (1 + tax_rate / 100.0)), 0) FROM goods_receipt_items i WHERE i.receipt_id = r.id) AS gross_total,
          EXISTS (
            SELECT 1 FROM goods_issue_items gi
            JOIN goods_receipt_items ri ON gi.receipt_item_id = ri.id
            WHERE ri.receipt_id = r.id
          ) AS is_used,
          EXISTS (
            SELECT 1 FROM scan_jobs sj
            WHERE sj.record_type = 'goods_receipts' AND sj.record_id = r.id
          ) AS needs_review
         FROM goods_receipts r
         ORDER BY r.date DESC, r.id DESC`
      )
      .all();
  });

  app.get('/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const receipt = db.prepare('SELECT * FROM goods_receipts WHERE id = ?').get(id);
    if (!receipt) return reply.code(404).send({ error: 'Receipt not found' });
    const items = db
      .prepare(
        `SELECT ri.*,
          EXISTS (
            SELECT 1 FROM goods_issue_items gi WHERE gi.receipt_item_id = ri.id
          ) AS is_used
         FROM goods_receipt_items ri
         WHERE ri.receipt_id = ?
         ORDER BY ri.id`
      )
      .all(id);
    return { ...receipt, items };
  });

  app.post('/', async (req, reply) => {
    const data = normalizeReceipt(req.body ?? {});
    const items = normalizeItems(req.body?.items);
    if (!data.receipt_number) return reply.code(400).send({ error: 'receipt_number is required' });
    if (items.length === 0) return reply.code(400).send({ error: '至少需要一条有效明细' });

    const created = await enqueueWrite(() => {
      const tx = db.transaction(() => {
        const info = db
          .prepare(
            `INSERT INTO goods_receipts
              (receipt_number, date, supplier, supplier_invoice, remarks, attachment_path)
             VALUES (@receipt_number, @date, @supplier, @supplier_invoice, @remarks, @attachment_path)`
          )
          .run(data);
        const receiptId = info.lastInsertRowid;
        for (const it of items) {
          insertItemStmt.run(receiptId, it.product_name, it.quantity, it.net_unit_price, it.tax_rate);
        }
        return receiptId;
      });
      const receiptId = tx();
      const row = db.prepare('SELECT * FROM goods_receipts WHERE id = ?').get(receiptId);
      const rowItems = db
        .prepare('SELECT * FROM goods_receipt_items WHERE receipt_id = ?')
        .all(receiptId);
      logChange('goods_receipts', receiptId, 'create', null, { ...row, items: rowItems });
      return { ...row, items: rowItems.map((it) => ({ ...it, is_used: 0 })) };
    });

    return reply.code(201).send(created);
  });

  app.put('/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const data = normalizeReceipt(req.body ?? {});
    const items = normalizeItems(req.body?.items);
    if (!data.receipt_number) return reply.code(400).send({ error: 'receipt_number is required' });
    if (items.length === 0) return reply.code(400).send({ error: '至少需要一条有效明细' });

    const result = await enqueueWrite(() => {
      const tx = db.transaction(() => {
        const old = db.prepare('SELECT * FROM goods_receipts WHERE id = ?').get(id);
        if (!old) return null;
        const oldItems = db
          .prepare('SELECT * FROM goods_receipt_items WHERE receipt_id = ?')
          .all(id);

        // 已被销售单引用的明细 ID，不能删除，不能修改
        const usedItemIds = new Set(
          db
            .prepare(
              `SELECT DISTINCT ri.id
               FROM goods_receipt_items ri
               JOIN goods_issue_items gi ON gi.receipt_item_id = ri.id
               WHERE ri.receipt_id = ?`
            )
            .all(id)
            .map((r) => r.id)
        );

        db.prepare(
          `UPDATE goods_receipts SET
            receipt_number = @receipt_number,
            date = @date,
            supplier = @supplier,
            supplier_invoice = @supplier_invoice,
            remarks = @remarks,
            attachment_path = @attachment_path,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = @id`
        ).run({ id, ...data });

        // 删除未被引用的明细
        if (usedItemIds.size > 0) {
          const placeholders = [...usedItemIds].map(() => '?').join(',');
          db.prepare(
            `DELETE FROM goods_receipt_items
             WHERE receipt_id = ? AND id NOT IN (${placeholders})`
          ).run(id, ...[...usedItemIds]);
        } else {
          db.prepare('DELETE FROM goods_receipt_items WHERE receipt_id = ?').run(id);
        }

        // 插入：跳过已引用的明细（前端会把它们原样传回）
        for (const it of items) {
          if (it.id && usedItemIds.has(it.id)) continue;
          insertItemStmt.run(id, it.product_name, it.quantity, it.net_unit_price, it.tax_rate);
        }

        return { old, oldItems };
      });

      const ctx = tx();
      if (!ctx) return null;
      const updated = db.prepare('SELECT * FROM goods_receipts WHERE id = ?').get(id);
      const updatedItems = db
        .prepare(
          `SELECT ri.*,
            EXISTS (SELECT 1 FROM goods_issue_items gi WHERE gi.receipt_item_id = ri.id) AS is_used
           FROM goods_receipt_items ri
           WHERE ri.receipt_id = ?
           ORDER BY ri.id`
        )
        .all(id);
      logChange(
        'goods_receipts',
        id,
        'update',
        { ...ctx.old, items: ctx.oldItems },
        { ...updated, items: updatedItems }
      );
      return { ...updated, items: updatedItems };
    });

    if (!result) return reply.code(404).send({ error: 'Receipt not found' });
    return result;
  });

  app.delete('/:id', async (req, reply) => {
    const id = Number(req.params.id);
    try {
      const ok = await enqueueWrite(() => {
        const old = db.prepare('SELECT * FROM goods_receipts WHERE id = ?').get(id);
        if (!old) return false;
        const oldItems = db
          .prepare('SELECT * FROM goods_receipt_items WHERE receipt_id = ?')
          .all(id);
        db.prepare('DELETE FROM goods_receipts WHERE id = ?').run(id);
        logChange('goods_receipts', id, 'delete', { ...old, items: oldItems }, null);
        return true;
      });
      if (!ok) return reply.code(404).send({ error: 'Receipt not found' });
      return reply.code(204).send();
    } catch (err) {
      if (
        err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' ||
        String(err.message).includes('FOREIGN KEY')
      ) {
        return reply
          .code(409)
          .send({ error: '该进货单的批次已被销售单引用，无法删除' });
      }
      throw err;
    }
  });
}