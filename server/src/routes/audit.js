import { db } from '../db.js';

export default async function auditRoutes(app) {
  // ── 销售单搜索 ──
  app.get('/issues', async (req) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const { from, to, invoice, customer, product, keyword } = req.query;

    const conditions = [];
    const params = [];

    if (from) {
      conditions.push('g.date >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('g.date <= ?');
      params.push(to);
    }
    if (invoice) {
      conditions.push('g.invoice_number LIKE ?');
      params.push(`%${invoice}%`);
    }
    if (customer) {
      conditions.push('g.customer_name LIKE ?');
      params.push(`%${customer}%`);
    }
    if (product) {
      conditions.push(`EXISTS (
        SELECT 1 FROM goods_issue_items gi
        JOIN goods_receipt_items ri ON gi.receipt_item_id = ri.id
        WHERE gi.issue_id = g.id AND ri.product_name LIKE ?
      )`);
      params.push(`%${product}%`);
    }
    if (keyword) {
      conditions.push(
        '(g.issue_number LIKE ? OR g.customer_name LIKE ? OR g.invoice_number LIKE ? OR g.remarks LIKE ?)'
      );
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = db
      .prepare(`SELECT COUNT(*) AS c FROM goods_issues g ${where}`)
      .get(...params).c;

    const items = db
      .prepare(
        `SELECT g.id, g.issue_number, g.date, g.customer_name, g.invoice_number,
                g.is_export, g.status,
                (SELECT COALESCE(SUM(gi.quantity * gi.selling_net_price), 0)
                 FROM goods_issue_items gi WHERE gi.issue_id = g.id) AS net_total
         FROM goods_issues g
         ${where}
         ORDER BY g.date DESC, g.id DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    return { items, total, limit, offset };
  });

  // ── 销售单链路详情 ──
  app.get('/issues/:id/chain', async (req, reply) => {
    const id = Number(req.params.id);
    const issue = db.prepare('SELECT * FROM goods_issues WHERE id = ?').get(id);
    if (!issue) return reply.code(404).send({ error: 'Issue not found' });

    const items = db
      .prepare(
        `SELECT gi.id, gi.quantity, gi.selling_net_price, gi.tax_rate,
                ri.id AS receipt_item_id,
                ri.product_name, ri.net_unit_price AS purchase_price,
                ri.receipt_id, gr.receipt_number, gr.date AS receipt_date,
                gr.supplier, gr.supplier_invoice
         FROM goods_issue_items gi
         JOIN goods_receipt_items ri ON ri.id = gi.receipt_item_id
         JOIN goods_receipts gr ON gr.id = ri.receipt_id
         WHERE gi.issue_id = ?
         ORDER BY gi.id`
      )
      .all(id);

    const invoice =
      db
        .prepare(
          'SELECT id, invoice_number, pdf_path, net_total, tax_total, gross_total, created_at FROM invoices WHERE issue_id = ?'
        )
        .get(id) ?? null;

    const history = db
      .prepare(
        `SELECT id, action, old_values, new_values, user,
                datetime(timestamp, 'localtime') AS timestamp
         FROM logbook
         WHERE table_name = 'goods_issues' AND record_id = ?
         ORDER BY id DESC`
      )
      .all(id);

    return { issue, items, invoice, history };
  });

  // ── 进货单搜索 ──
  app.get('/receipts', async (req) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const { from, to, supplier, keyword } = req.query;

    const conditions = [];
    const params = [];

    if (from) {
      conditions.push('r.date >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('r.date <= ?');
      params.push(to);
    }
    if (supplier) {
      conditions.push('r.supplier LIKE ?');
      params.push(`%${supplier}%`);
    }
    if (keyword) {
      conditions.push(
        '(r.receipt_number LIKE ? OR r.supplier LIKE ? OR r.supplier_invoice LIKE ? OR r.remarks LIKE ?)'
      );
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = db
      .prepare(`SELECT COUNT(*) AS c FROM goods_receipts r ${where}`)
      .get(...params).c;

    const items = db
      .prepare(
        `SELECT r.id, r.receipt_number, r.date, r.supplier, r.supplier_invoice,
                r.remarks,
                (SELECT COUNT(*) FROM goods_receipt_items ri WHERE ri.receipt_id = r.id) AS item_count,
                (SELECT COALESCE(SUM(quantity * net_unit_price), 0)
                 FROM goods_receipt_items ri WHERE ri.receipt_id = r.id) AS net_total,
                EXISTS (
                  SELECT 1 FROM goods_issue_items gi
                  JOIN goods_receipt_items ri ON gi.receipt_item_id = ri.id
                  WHERE ri.receipt_id = r.id
                ) AS is_used
         FROM goods_receipts r
         ${where}
         ORDER BY r.date DESC, r.id DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    return { items, total, limit, offset };
  });

  // ── 进货单详情 ──
  app.get('/receipts/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const receipt = db.prepare('SELECT * FROM goods_receipts WHERE id = ?').get(id);
    if (!receipt) return reply.code(404).send({ error: 'Receipt not found' });

    const items = db
      .prepare(
        `SELECT id, product_name, quantity, net_unit_price, tax_rate
         FROM goods_receipt_items
         WHERE receipt_id = ?
         ORDER BY id`
      )
      .all(id);

    const usedBy = db
      .prepare(
        `SELECT DISTINCT gi.issue_id, g.issue_number, g.date, g.customer_name
         FROM goods_issue_items gi
         JOIN goods_receipt_items ri ON gi.receipt_item_id = ri.id
         JOIN goods_issues g ON g.id = gi.issue_id
         WHERE ri.receipt_id = ?
         ORDER BY g.date DESC`
      )
      .all(id);

    return { receipt, items, usedBy };
  });

  // ── 支出搜索 ──
  app.get('/expenses', async (req) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const { from, to, category, keyword } = req.query;

    const conditions = [];
    const params = [];

    if (from) {
      conditions.push('date >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('date <= ?');
      params.push(to);
    }
    if (category) {
      conditions.push('category LIKE ?');
      params.push(`%${category}%`);
    }
    if (keyword) {
      conditions.push(
        '(category LIKE ? OR description LIKE ? OR supplier_invoice LIKE ? OR remarks LIKE ?)'
      );
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = db
      .prepare(`SELECT COUNT(*) AS c FROM other_expenses ${where}`)
      .get(...params).c;

    const items = db
      .prepare(
        `SELECT * FROM other_expenses ${where}
         ORDER BY date DESC, id DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    return { items, total, limit, offset };
  });

  // ── 支出详情 ──
  app.get('/expenses/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM other_expenses WHERE id = ?').get(id);
    if (!row) return reply.code(404).send({ error: 'Expense not found' });
    return row;
  });

  // ── 公司车搜索 ──
  app.get('/cars', async (req) => {
    const { keyword } = req.query;
    const conditions = [];
    const params = [];
    if (keyword) {
      conditions.push('license_plate LIKE ?');
      params.push(`%${keyword}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const items = db
      .prepare(
        `SELECT *,
                (SELECT COUNT(*) FROM car_expenses WHERE car_id = company_cars.id) AS expense_count
         FROM company_cars
         ${where}
         ORDER BY active DESC, id DESC`
      )
      .all(...params);

    return { items, total: items.length };
  });

  // ── 公司车详情 ──
  app.get('/cars/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const car = db.prepare('SELECT * FROM company_cars WHERE id = ?').get(id);
    if (!car) return reply.code(404).send({ error: 'Car not found' });

    const expenses = db
      .prepare(
        'SELECT id, month, amount, tax_rule_percent FROM car_expenses WHERE car_id = ? ORDER BY month'
      )
      .all(id);

    return { car, expenses };
  });
}