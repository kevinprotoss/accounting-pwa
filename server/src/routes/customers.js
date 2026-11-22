import { db, enqueueWrite, logChange } from '../db.js';

function normalize(body) {
  return {
    name: String(body.name ?? '').trim(),
    street: body.street || null,
    postcode: body.postcode || null,
    city: body.city || null,
    country: body.country || null,
    ust_idnr: body.ust_idnr || null,
    email: body.email || null,
    phone: body.phone || null,
  };
}

export default async function customersRoutes(app) {
  app.get('/', async () => {
    return db.prepare('SELECT * FROM customers ORDER BY id DESC').all();
  });

  app.get('/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!row) return reply.code(404).send({ error: 'Customer not found' });
    return row;
  });

  app.post('/', async (req, reply) => {
    const data = normalize(req.body ?? {});
    if (!data.name) return reply.code(400).send({ error: 'name is required' });

    const row = await enqueueWrite(() => {
      const info = db.prepare(`
        INSERT INTO customers (name, street, postcode, city, country, ust_idnr, email, phone)
        VALUES (@name, @street, @postcode, @city, @country, @ust_idnr, @email, @phone)
      `).run(data);
      const id = info.lastInsertRowid;
      const created = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
      logChange('customers', id, 'create', null, created);
      return created;
    });

    return reply.code(201).send(row);
  });

  app.put('/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const data = normalize(req.body ?? {});
    if (!data.name) return reply.code(400).send({ error: 'name is required' });

    const row = await enqueueWrite(() => {
      const old = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
      if (!old) return null;
      db.prepare(`
        UPDATE customers SET
          name = @name,
          street = @street,
          postcode = @postcode,
          city = @city,
          country = @country,
          ust_idnr = @ust_idnr,
          email = @email,
          phone = @phone,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({ id, ...data });
      const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
      logChange('customers', id, 'update', old, updated);
      return updated;
    });

    if (!row) return reply.code(404).send({ error: 'Customer not found' });
    return row;
  });

  app.delete('/:id', async (req, reply) => {
    const id = Number(req.params.id);

    const ok = await enqueueWrite(() => {
      const old = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
      if (!old) return false;
      db.prepare('DELETE FROM customers WHERE id = ?').run(id);
      logChange('customers', id, 'delete', old, null);
      return true;
    });

    if (!ok) return reply.code(404).send({ error: 'Customer not found' });
    return reply.code(204).send();
  });
}