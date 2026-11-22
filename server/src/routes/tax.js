import { db } from '../db.js';

const granularities = ['month', 'quarter', 'year'];

function getPeriodKey(dateStr, granularity) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (granularity === 'year') return `${y}`;
  if (granularity === 'quarter') return `${y}-Q${Math.ceil(m / 3)}`;
  return `${y}-${String(m).padStart(2, '0')}`;
}

function getPeriodLabel(key, granularity) {
  if (granularity === 'year') return `${key}年`;
  if (granularity === 'quarter') {
    const [y, q] = key.split('-');
    return `${y}年${q}`;
  }
  const [y, m] = key.split('-');
  return `${y}年${parseInt(m, 10)}月`;
}

function periodRange(key, granularity) {
  if (granularity === 'year') {
    return { from: `${key}-01-01`, to: `${key}-12-31` };
  }
  if (granularity === 'quarter') {
    const [y, q] = key.split('-Q');
    const quarter = parseInt(q, 10);
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;
    return {
      from: `${y}-${String(startMonth).padStart(2, '0')}-01`,
      to: `${y}-${String(endMonth).padStart(2, '0')}-31`,
    };
  }
  const [y, m] = key.split('-');
  const month = parseInt(m, 10);
  const lastDay = new Date(parseInt(y, 10), month, 0).getDate();
  return {
    from: `${y}-${m}-01`,
    to: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
  };
}

// 严格按原 views/tax.js 的算法：
// - 国内销售：所有税率合并，不过滤 status
// - 出口销售：单列净额
// - 进项税：进货 + 其他支出（is_output_tax = 0）
// - 附加销项税：其他支出（is_output_tax = 1）+ 车辆月度记录（car_expenses）
function calcForRange(from, to) {
  const domestic = db.prepare(`
    SELECT
      COALESCE(SUM(gi.selling_net_price * gi.quantity), 0) AS net,
      COALESCE(SUM(gi.selling_net_price * gi.quantity * gi.tax_rate / 100), 0) AS tax
    FROM goods_issues g
    JOIN goods_issue_items gi ON g.id = gi.issue_id
    WHERE g.date BETWEEN ? AND ? AND g.is_export = 0
  `).get(from, to);

  const exportSales = db.prepare(`
    SELECT COALESCE(SUM(gi.selling_net_price * gi.quantity), 0) AS net
    FROM goods_issues g
    JOIN goods_issue_items gi ON g.id = gi.issue_id
    WHERE g.date BETWEEN ? AND ? AND g.is_export = 1
  `).get(from, to);

  const inputTaxReceipts = db.prepare(`
    SELECT COALESCE(SUM(ri.quantity * ri.net_unit_price * ri.tax_rate / 100), 0) AS tax
    FROM goods_receipts r
    JOIN goods_receipt_items ri ON r.id = ri.receipt_id
    WHERE r.date BETWEEN ? AND ?
  `).get(from, to);

  const inputTaxExpenses = db.prepare(`
    SELECT COALESCE(SUM(input_tax), 0) AS tax FROM other_expenses
    WHERE date BETWEEN ? AND ? AND is_output_tax = 0
  `).get(from, to);

  const fromMonth = from.slice(0, 7);
  const toMonth = to.slice(0, 7);
  const additionalOutput = db.prepare(`
    SELECT (
      SELECT COALESCE(SUM(input_tax), 0) FROM other_expenses
      WHERE date BETWEEN ? AND ? AND is_output_tax = 1
    ) + (
      SELECT COALESCE(SUM(amount), 0) FROM car_expenses
      WHERE month >= ? AND month <= ?
    ) AS tax
  `).get(from, to, fromMonth, toMonth);

  const domesticNet = domestic.net;
  const domesticTax = domestic.tax;
  const exportNet = exportSales.net;
  const inputTaxPurchase = inputTaxReceipts.tax;
  const inputTaxExpense = inputTaxExpenses.tax;
  const inputTax = inputTaxPurchase + inputTaxExpense;
  const additionalTax = additionalOutput.tax;
  const totalOutputTax = domesticTax + additionalTax;
  const vatPayable = totalOutputTax - inputTax;

  return {
    domesticNet,
    domesticTax,
    exportNet,
    inputTax,
    inputTaxPurchase,
    inputTaxExpense,
    additionalTax,
    totalOutputTax,
    vatPayable,
  };
}

function calculate(from, to, granularity) {
  const summary = calcForRange(from, to);

  const dates = new Set();
  db.prepare('SELECT DISTINCT date FROM goods_issues WHERE date BETWEEN ? AND ?')
    .all(from, to)
    .forEach((r) => dates.add(r.date));
  db.prepare('SELECT DISTINCT date FROM goods_receipts WHERE date BETWEEN ? AND ?')
    .all(from, to)
    .forEach((r) => dates.add(r.date));
  db.prepare('SELECT DISTINCT date FROM other_expenses WHERE date BETWEEN ? AND ?')
    .all(from, to)
    .forEach((r) => dates.add(r.date));
  db.prepare('SELECT DISTINCT month FROM car_expenses WHERE month >= ? AND month <= ?')
    .all(from.slice(0, 7), to.slice(0, 7))
    .forEach((r) => dates.add(`${r.month}-01`));

  const keys = new Set();
  for (const d of dates) keys.add(getPeriodKey(d, granularity));

  const periods = [...keys]
    .sort()
    .map((key) => {
      const { from: pFrom, to: pTo } = periodRange(key, granularity);
      return {
        key,
        label: getPeriodLabel(key, granularity),
        ...calcForRange(pFrom, pTo),
      };
    });

  return { period: { from, to, granularity }, summary, periods };
}

function defaultRange() {
  const now = new Date();
  const year = now.getFullYear();
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export default async function taxRoutes(app) {
  app.get('/', async (req, reply) => {
    const def = defaultRange();
    const from = req.query.from || def.from;
    const to = req.query.to || def.to;
    const granularity = req.query.granularity || 'quarter';

    if (!granularities.includes(granularity)) {
      return reply.code(400).send({ error: 'granularity 必须是 month、quarter 或 year' });
    }

    return calculate(from, to, granularity);
  });

  app.get('/elster', async (req, reply) => {
    const def = defaultRange();
    const from = req.query.from || def.from;
    const to = req.query.to || def.to;
    const granularity = req.query.granularity || 'quarter';

    if (!granularities.includes(granularity)) {
      return reply.code(400).send({ error: 'granularity 必须是 month、quarter 或 year' });
    }

    const { periods } = calculate(from, to, granularity);

    const lines = [];
    for (const p of periods) {
      lines.push(`ELSTER Umsatzsteuer-Voranmeldung ${p.label}`);
      lines.push(`Zeile 13 (19% Umsatz): ${p.domesticNet.toFixed(2)} €`);
      lines.push(`Zeile 13 Steuer: ${p.domesticTax.toFixed(2)} €`);
      lines.push(`Zeile 22 (0% Ausfuhr): ${p.exportNet.toFixed(2)} €`);
      lines.push(`Zeile 38 Vorsteuer: ${p.inputTax.toFixed(2)} €`);
      lines.push(`Zusätzliche USt (1% usw.): ${p.additionalTax.toFixed(2)} €`);
      lines.push(`Zahllast: ${p.vatPayable.toFixed(2)} €`);
      lines.push('');
    }

    const filename = `elster_${from}_${to}_${granularity}.txt`;
    reply.header('Content-Type', 'text/plain; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return lines.join('\n');
  });
}