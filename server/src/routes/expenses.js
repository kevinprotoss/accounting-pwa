import { db, enqueueWrite, logChange } from '../db.js';

function normalize(body) {
  const net = Number(body.net_amount) || 0;
  const rate = Number(body.tax_rate) ?? 19;
  const isOutput = body.is_output_tax ? 1 : 0;
  let inputTax;
  if (body.input_tax != null && body.input_tax !== '') {
    inputTax = Number(body.input_tax) || 0;
  } else {
    inputTax = isOutput ? 0 : (net * rate) / 100;
  }
  return {
    date: body.date || new Date().toISOString().slice(0, 10),
    category: body.category || null,
    description: body.description || null,
    net_amount: isOutput ? 0 : net,
    tax_rate: isOutput ? 0 : rate,
    input_tax: inputTax,
    is_output_tax: isOutput,
    attachment_path: body.attachment_path || null,
    supplier_invoice: body.supplier_invoice || null,
    remarks: body.remarks || null,
  };
}

export default async function expensesRoutes(app) {
  app.get('/', async () => {
    return db
      .prepare(
        `SELECT e.*,
          EXISTS (
            SELECT 1 FROM scan_jobs sj
            WHERE sj.record_type = 'other_expenses' AND sj.record_id = e.id
          ) AS needs_review
         FROM other_expenses e
         ORDER BY e.date DESC, e.id DESC`
      )
      .all();
  });

  app.get('/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM other_expenses WHERE id = ?').get(id);
    if (!row) return reply.code(404).send({ error: 'Expense not found' });
    return row;
  });

  app.post('/', async (req, reply) => {
    const data = normalize(req.body ?? {});
    const created = await enqueueWrite(() => {
      const info = db
        .prepare(
          `INSERT INTO other_expenses
            (date, category, description, net_amount, tax_rate, input_tax, is_output_tax, attachment_path, supplier_invoice, remarks)
           VALUES
            (@date, @category, @description, @net_amount, @tax_rate, @input_tax, @is_output_tax, @attachment_path, @supplier_invoice, @remarks)`
        )
        .run(data);
      const id = info.lastInsertRowid;
      const row = db.prepare('SELECT * FROM other_expenses WHERE id = ?').get(id);
      logChange('other_expenses', id, 'create', null, row);
      return row;
    });
    return reply.code(201).send(created);
  });

  app.put('/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const data = normalize(req.body ?? {});
    const result = await enqueueWrite(() => {
      const old = db.prepare('SELECT * FROM other_expenses WHERE id = ?').get(id);
      if (!old) return null;
      db.prepare(
        `UPDATE other_expenses SET
          date = @date, category = @category, description = @description,
          net_amount = @net_amount, tax_rate = @tax_rate, input_tax = @input_tax,
          is_output_tax = @is_output_tax, attachment_path = @attachment_path,
          supplier_invoice = @supplier_invoice, remarks = @remarks,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = @id`
      ).run({ id, ...data });
      const updated = db.prepare('SELECT * FROM other_expenses WHERE id = ?').get(id);
      logChange('other_expenses', id, 'update', old, updated);
      return updated;
    });
    if (!result) return reply.code(404).send({ error: 'Expense not found' });
    return result;
  });

  app.delete('/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const ok = await enqueueWrite(() => {
      const old = db.prepare('SELECT * FROM other_expenses WHERE id = ?').get(id);
      if (!old) return false;
      db.prepare('DELETE FROM other_expenses WHERE id = ?').run(id);
      logChange('other_expenses', id, 'delete', old, null);
      return true;
    });
    if (!ok) return reply.code(404).send({ error: 'Expense not found' });
    return reply.code(204).send();
  });
}