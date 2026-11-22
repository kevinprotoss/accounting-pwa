import { db, enqueueWrite, logChange } from '../db.js';

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalize(body) {
  const rule = Number(body.tax_rule_percent);
  return {
    license_plate: String(body.license_plate ?? '').trim(),
    gross_list_price: Number(body.gross_list_price) || 0,
    acquisition_date: body.acquisition_date || null,
    tax_rule_percent: rule === 0.25 ? 0.25 : 1,
  };
}

// 起点月：购车日 1 号则当月；否则下个月。
// 如果启用过（reactivated_at 晚于购车日），起点月 = 启用月的下个月。
function computeStartMonth(car) {
  let base = car.acquisition_date;
  let isReactivated = false;
  if (car.reactivated_at && car.reactivated_at > base) {
    base = car.reactivated_at;
    isReactivated = true;
  }
  const [y, m, d] = base.split('-').map(Number);
  if (!isReactivated && d === 1) {
    return `${y}-${String(m).padStart(2, '0')}`;
  }
  const next = new Date(y, m, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function monthsBetween(start, end) {
  const result = [];
  let [y, m] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return result;
}

// 为所有 active=1 的车补齐截至上个月的月度记录。
// 停用月不计，当月未结束不计。
function ensureCarExpenses() {
  const cars = db.prepare('SELECT * FROM company_cars WHERE active = 1').all();
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endMonth = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO car_expenses (car_id, month, amount, tax_rule_percent)
    VALUES (?, ?, ?, ?)
  `);

  let created = 0;
  let skipped = 0;

  for (const car of cars) {
    const startMonth = computeStartMonth(car);
    if (startMonth > endMonth) continue;
    const amount = (car.gross_list_price * car.tax_rule_percent) / 100;
    for (const month of monthsBetween(startMonth, endMonth)) {
      const info = insert.run(car.id, month, amount, car.tax_rule_percent);
      if (info.changes > 0) created++;
      else skipped++;
    }
  }

  return { created, skipped };
}

export default async function carsRoutes(app) {
  // 进入车辆页 / 税务页时调用，补齐缺失月份
  app.post('/ensure-expenses', async () => {
    return enqueueWrite(() => ensureCarExpenses());
  });

  app.get('/', async () => {
    const cars = db
      .prepare('SELECT * FROM company_cars ORDER BY active DESC, id DESC')
      .all();
    const expenseStmt = db.prepare(
      'SELECT month, amount, tax_rule_percent FROM car_expenses WHERE car_id = ? ORDER BY month'
    );
    return cars.map((car) => ({
      ...car,
      expenses: expenseStmt.all(car.id),
    }));
  });

  app.post('/', async (req, reply) => {
    const data = normalize(req.body ?? {});
    if (!data.license_plate) {
      return reply.code(400).send({ error: '车牌号不能为空' });
    }
    if (!data.acquisition_date) {
      return reply.code(400).send({ error: '购车日期不能为空' });
    }
    try {
      const created = await enqueueWrite(() => {
        const info = db
          .prepare(
            `INSERT INTO company_cars
              (license_plate, gross_list_price, acquisition_date, active, tax_rule_percent)
             VALUES (?, ?, ?, 1, ?)`
          )
          .run(
            data.license_plate,
            data.gross_list_price,
            data.acquisition_date,
            data.tax_rule_percent
          );
        const id = info.lastInsertRowid;
        const row = db.prepare('SELECT * FROM company_cars WHERE id = ?').get(id);
        logChange('company_cars', id, 'create', null, row);
        return row;
      });
      return reply.code(201).send({ ...created, expenses: [] });
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) {
        return reply.code(409).send({ error: '该车牌号已存在' });
      }
      throw err;
    }
  });

  app.put('/:id/deactivate', async (req, reply) => {
    const id = Number(req.params.id);
    const result = await enqueueWrite(() => {
      const car = db.prepare('SELECT * FROM company_cars WHERE id = ?').get(id);
      if (!car) return { error: 404 };
      if (car.active === 0) return { error: 400, message: '车辆已停用' };

      // 先确保停用前的所有月份已生成
      ensureCarExpenses();

      db.prepare(
        'UPDATE company_cars SET active = 0, deactivated_at = ? WHERE id = ?'
      ).run(today(), id);
      const updated = db.prepare('SELECT * FROM company_cars WHERE id = ?').get(id);
      logChange('company_cars', id, 'deactivate', car, updated);
      return { car: updated };
    });

    if (result.error === 404) return reply.code(404).send({ error: 'Car not found' });
    if (result.error === 400) return reply.code(400).send({ error: result.message });
    return result.car;
  });

  app.put('/:id/reactivate', async (req, reply) => {
    const id = Number(req.params.id);
    const result = await enqueueWrite(() => {
      const car = db.prepare('SELECT * FROM company_cars WHERE id = ?').get(id);
      if (!car) return { error: 404 };
      if (car.active === 1) return { error: 400, message: '车辆未停用' };

      db.prepare(
        `UPDATE company_cars
         SET active = 1, reactivated_at = ?, deactivated_at = NULL
         WHERE id = ?`
      ).run(today(), id);
      const updated = db.prepare('SELECT * FROM company_cars WHERE id = ?').get(id);
      logChange('company_cars', id, 'reactivate', car, updated);
      return { car: updated };
    });

    if (result.error === 404) return reply.code(404).send({ error: 'Car not found' });
    if (result.error === 400) return reply.code(400).send({ error: result.message });
    return result.car;
  });

  app.delete('/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const ok = await enqueueWrite(() => {
      const car = db.prepare('SELECT * FROM company_cars WHERE id = ?').get(id);
      if (!car) return false;
      // car_expenses 靠 ON DELETE CASCADE 自动删除
      db.prepare('DELETE FROM company_cars WHERE id = ?').run(id);
      logChange('company_cars', id, 'delete', car, null);
      return true;
    });
    if (!ok) return reply.code(404).send({ error: 'Car not found' });
    return reply.code(204).send();
  });
}