import { db } from '../db.js';

export default async function stockRoutes(app) {
  // 可选 ?forIssue=<id>：编辑销售单时，把自己已占用的数量加回可用库存
  app.get('/', async (req) => {
    const forIssue = req.query.forIssue ? Number(req.query.forIssue) : null;

    const rows = db.prepare(`
      SELECT
        ri.id AS receipt_item_id,
        ri.product_name,
        ri.net_unit_price AS purchase_price,
        ri.tax_rate,
        ri.quantity AS received_qty,
        COALESCE(SUM(gi.quantity), 0) AS issued_qty,
        gr.date AS receipt_date,
        gr.supplier,
        gr.supplier_invoice
      FROM goods_receipt_items ri
      JOIN goods_receipts gr ON ri.receipt_id = gr.id
      LEFT JOIN goods_issue_items gi ON ri.id = gi.receipt_item_id
      GROUP BY ri.id
    `).all();

    const selfUsed = forIssue
      ? db
          .prepare(
            'SELECT receipt_item_id, SUM(quantity) AS q FROM goods_issue_items WHERE issue_id = ? GROUP BY receipt_item_id'
          )
          .all(forIssue)
      : [];
    const selfMap = new Map(selfUsed.map((r) => [r.receipt_item_id, r.q]));

    return rows
      .map((r) => ({
        ...r,
        remaining_qty:
          r.received_qty - r.issued_qty + (selfMap.get(r.receipt_item_id) ?? 0),
      }))
      .filter((r) => r.remaining_qty > 0);
  });
}