#!/usr/bin/env node
// 从旧 Electron 应用的 system.db 迁移到新 PWA 的 system.db
// 用法: node scripts/migrate-from-electron.mjs --old <旧库路径> [选项]

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    old: null,
    dataDir: path.join(projectRoot, 'server/data'),
    force: false,
    dryRun: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--old' && args[i + 1]) opts.old = args[++i];
    else if (a === '--data-dir' && args[i + 1]) opts.dataDir = args[++i];
    else if (a === '--force') opts.force = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    else { console.error(`未知参数: ${a}`); printHelp(); process.exit(1); }
  }
  if (!opts.old) {
    console.error('错误: --old 必需');
    printHelp();
    process.exit(1);
  }
  opts.old = path.resolve(opts.old);
  opts.dataDir = path.resolve(opts.dataDir);
  return opts;
}

function printHelp() {
  console.log(`用法: node scripts/migrate-from-electron.mjs --old <旧库路径> [选项]

选项:
  --old <path>        旧 system.db 路径（必需）
  --data-dir <path>   新数据目录（默认 server/data），新库为 <data-dir>/system.db
  --force             新库非空时清空
  --dry-run           只验证，不写入
  --help              显示帮助

示例:
  node scripts/migrate-from-electron.mjs --old ../accounting-desktop/data/system.db
  node scripts/migrate-from-electron.mjs --old ../accounting-desktop/data/system.db --force
`);
}

function normalizeAttachments(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') {
    if (Array.isArray(value)) return JSON.stringify(value);
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return JSON.stringify(parsed);
    } catch {
      /* 不是合法 JSON，按字符串处理 */
    }
  }
  return JSON.stringify([value]);
}

function migrateTable(oldDb, newDb, table, transform, dryRun) {
  const oldCount = oldDb.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
  if (oldCount === 0) {
    return { table, oldCount: 0, newCount: 0, inserted: 0, skipped: 0, ok: true };
  }

  const rows = oldDb.prepare(`SELECT * FROM ${table}`).all();
  const oldCols = Object.keys(rows[0]);
  const newCols = newDb.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  const cols = oldCols.filter((c) => newCols.includes(c));

  if (cols.length === 0) throw new Error(`表 ${table} 没有共同列`);

  const placeholders = cols.map((c) => `@${c}`).join(', ');
  const stmt = newDb.prepare(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
  );

  let inserted = 0;
  let skipped = 0;

  if (!dryRun) {
    const insertAll = newDb.transaction((rows) => {
      for (const row of rows) {
        const data = transform ? transform(row) : row;
        if (data === null) {
          skipped++;
          continue;
        }
        const clean = {};
        for (const c of cols) clean[c] = data[c] ?? null;
        try {
          stmt.run(clean);
          inserted++;
        } catch (err) {
          if (
            err.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
            err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
            err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY'
          ) {
            skipped++;
          } else {
            throw err;
          }
        }
      }
    });
    insertAll(rows);
  }

  const newCount = dryRun ? 0 : newDb.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
  return {
    table,
    oldCount,
    newCount,
    inserted,
    skipped,
    ok: dryRun || oldCount === newCount + skipped,
  };
}

function migrateReceipts(oldDb, newDb, dryRun) {
  return migrateTable(
    oldDb,
    newDb,
    'goods_receipts',
    (row) => ({ ...row, attachment_path: normalizeAttachments(row.attachment_path) }),
    dryRun
  );
}

function migrateIssues(oldDb, newDb, dryRun) {
  return migrateTable(
    oldDb,
    newDb,
    'goods_issues',
    (row) => ({
      ...row,
      export_attachment_path: normalizeAttachments(row.export_attachment_path),
      payment_attachment_paths: normalizeAttachments(row.payment_attachment_paths),
    }),
    dryRun
  );
}

function migrateExpenses(oldDb, newDb, dryRun) {
  return migrateTable(
    oldDb,
    newDb,
    'other_expenses',
    (row) => ({ ...row, attachment_path: normalizeAttachments(row.attachment_path) }),
    dryRun
  );
}

function migrateInvoices(oldDb, newDb, dryRun) {
  const oldCount = oldDb.prepare('SELECT COUNT(*) AS c FROM invoices').get().c;
  if (oldCount === 0) {
    return { table: 'invoices', oldCount: 0, newCount: 0, inserted: 0, skipped: 0, ok: true };
  }

  // 新库 invoices.issue_id 有 UNIQUE 约束，旧库没有
  // 按 issue_id 去重，保留 id 最大的一条（最新）
  const rows = oldDb
    .prepare(
      `SELECT * FROM invoices
       WHERE id IN (SELECT MAX(id) FROM invoices GROUP BY issue_id)`
    )
    .all();

  const cols = ['id', 'invoice_number', 'issue_id', 'pdf_path', 'net_total', 'tax_total', 'gross_total', 'created_at'];
  const placeholders = cols.map((c) => `@${c}`).join(', ');
  const stmt = newDb.prepare(
    `INSERT INTO invoices (${cols.join(', ')}) VALUES (${placeholders})`
  );

  let inserted = 0;
  let skipped = 0;

  if (!dryRun) {
    const insertAll = newDb.transaction((rows) => {
      for (const row of rows) {
        const clean = {};
        for (const c of cols) clean[c] = row[c] ?? null;
        try {
          stmt.run(clean);
          inserted++;
        } catch (err) {
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') skipped++;
          else throw err;
        }
      }
    });
    insertAll(rows);
  }

  const newCount = dryRun ? 0 : newDb.prepare('SELECT COUNT(*) AS c FROM invoices').get().c;
  const note = oldCount > rows.length ? `去重 ${oldCount - rows.length} 条（同 issue_id 保留最新）` : '';
  return { table: 'invoices', oldCount, newCount, inserted, skipped, note, ok: true };
}

function migrateCars(oldDb, newDb, dryRun) {
  const rows = oldDb.prepare('SELECT * FROM company_cars').all();
  if (rows.length === 0) {
    return { table: 'company_cars', oldCount: 0, newCount: 0, inserted: 0, skipped: 0, ok: true };
  }

  const cols = ['id', 'license_plate', 'gross_list_price', 'acquisition_date', 'active', 'tax_rule_percent'];
  const placeholders = cols.map((c) => `@${c}`).join(', ');
  const stmt = newDb.prepare(
    `INSERT INTO company_cars (${cols.join(', ')}) VALUES (${placeholders})`
  );

  let inserted = 0;
  let skipped = 0;
  const warnings = [];

  if (!dryRun) {
    const insertAll = newDb.transaction((rows) => {
      for (const row of rows) {
        const data = {
          id: row.id,
          license_plate: row.license_plate,
          gross_list_price: row.gross_list_price,
          acquisition_date: row.acquisition_date || '2000-01-01',
          active: row.active ?? 1,
          tax_rule_percent: 1,
        };
        if (!row.acquisition_date) {
          warnings.push(
            `车辆「${row.license_plate}」的购车日期为空，已用 2000-01-01 占位，请手动修正`
          );
        }
        try {
          stmt.run(data);
          inserted++;
        } catch (err) {
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') skipped++;
          else throw err;
        }
      }
    });
    insertAll(rows);
  }

  const newCount = dryRun ? 0 : newDb.prepare('SELECT COUNT(*) AS c FROM company_cars').get().c;
  return { table: 'company_cars', oldCount: rows.length, newCount, inserted, skipped, warnings, ok: rows.length === newCount + skipped };
}

function validate(oldDb, newDb) {
  console.log('\n=== 记录数验证 ===');

  const tables = [
    'company_info', 'customers',
    'goods_receipts', 'goods_receipt_items',
    'goods_issues', 'goods_issue_items',
    'payment_orders', 'payment_order_issues',
    'other_expenses', 'company_cars', 'logbook',
  ];

  let allMatch = true;
  for (const t of tables) {
    const oldCount = oldDb.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
    const newCount = newDb.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
    const match = oldCount === newCount;
    if (!match) allMatch = false;
    console.log(`${match ? '✓' : '✗'} ${t}: 旧=${oldCount} 新=${newCount}`);
  }

  const oldInv = oldDb.prepare('SELECT COUNT(*) AS c FROM invoices').get().c;
  const newInv = newDb.prepare('SELECT COUNT(*) AS c FROM invoices').get().c;
  const invMatch = oldInv === newInv;
  console.log(
    `${invMatch ? '✓' : '△'} invoices: 旧=${oldInv} 新=${newInv}${
      invMatch ? '' : ' (去重导致，正常)'
    }`
  );

  console.log('\n=== 金额验证 ===');

  const checks = [
    ['进货明细净额', 'SELECT COALESCE(SUM(quantity * net_unit_price), 0) AS s FROM goods_receipt_items'],
    ['销售明细净额', 'SELECT COALESCE(SUM(quantity * selling_net_price), 0) AS s FROM goods_issue_items'],
    ['销售明细税额', 'SELECT COALESCE(SUM(quantity * selling_net_price * tax_rate / 100.0), 0) AS s FROM goods_issue_items'],
    ['支出净额', 'SELECT COALESCE(SUM(net_amount), 0) AS s FROM other_expenses'],
    ['支出税额', 'SELECT COALESCE(SUM(input_tax), 0) AS s FROM other_expenses'],
    ['发票净额', 'SELECT COALESCE(SUM(net_total), 0) AS s FROM invoices'],
    ['发票税额', 'SELECT COALESCE(SUM(tax_total), 0) AS s FROM invoices'],
    ['发票总额', 'SELECT COALESCE(SUM(gross_total), 0) AS s FROM invoices'],
    ['库存视图行数', 'SELECT COUNT(*) AS s FROM current_stock'],
  ];

  for (const [label, sql] of checks) {
    const oldVal = oldDb.prepare(sql).get().s;
    const newVal = newDb.prepare(sql).get().s;
    const match = Math.abs(oldVal - newVal) < 0.01;
    if (!match) allMatch = false;
    console.log(
      `${match ? '✓' : '✗'} ${label}: 旧=${Number(oldVal).toFixed(2)} 新=${Number(newVal).toFixed(2)}`
    );
  }

  console.log(`\n${allMatch ? '✓ 迁移验证通过' : '✗ 存在不一致，请检查上方输出'}`);
}

async function main() {
  const opts = parseArgs();

  if (!fs.existsSync(opts.old)) {
    console.error(`旧库不存在: ${opts.old}`);
    process.exit(1);
  }

  const backupPath = `${opts.old}.bak-${Date.now()}`;
  fs.copyFileSync(opts.old, backupPath);
  console.log(`✓ 已备份旧库: ${backupPath}`);

  const oldDb = new Database(opts.old, { readonly: true });
  console.log(`✓ 已打开旧库: ${opts.old}`);

  if (!fs.existsSync(opts.dataDir)) {
    fs.mkdirSync(opts.dataDir, { recursive: true });
  }

  // 用新应用的 db.js 创建 schema，避免 SQL 重复
  process.env.DATA_DIR = opts.dataDir;
  const dbModuleUrl = pathToFileURL(path.join(projectRoot, 'server/src/db.js')).href;
  const { db: newDb } = await import(dbModuleUrl);
  console.log(`✓ 已打开新库: ${path.join(opts.dataDir, 'system.db')}`);

  const tables = [
    'company_info', 'customers',
    'goods_receipts', 'goods_receipt_items',
    'goods_issues', 'goods_issue_items',
    'payment_orders', 'payment_order_issues',
    'invoices', 'other_expenses', 'company_cars', 'logbook',
  ];

  const nonEmpty = [];
  for (const t of tables) {
    const count = newDb.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
    if (count > 0) nonEmpty.push(`${t}(${count})`);
  }

  if (nonEmpty.length > 0) {
    if (!opts.force) {
      console.error(`\n新库已有数据: ${nonEmpty.join(', ')}`);
      console.error('如需清空后迁移，加 --force 参数');
      oldDb.close();
      newDb.close();
      process.exit(1);
    }
    console.log(`\n⚠ 清空新库: ${nonEmpty.join(', ')}`);
    newDb.pragma('foreign_keys = OFF');
    for (const t of [...tables].reverse()) newDb.prepare(`DELETE FROM ${t}`).run();
    newDb.pragma('foreign_keys = ON');
  }

  console.log('\n=== 开始迁移 ===');
  if (opts.dryRun) console.log('(dry-run 模式，不写入)');

  const results = [];
  results.push(migrateTable(oldDb, newDb, 'company_info', null, opts.dryRun));
  results.push(migrateTable(oldDb, newDb, 'customers', null, opts.dryRun));
  results.push(migrateReceipts(oldDb, newDb, opts.dryRun));
  results.push(migrateTable(oldDb, newDb, 'goods_receipt_items', null, opts.dryRun));
  results.push(migrateIssues(oldDb, newDb, opts.dryRun));
  results.push(migrateTable(oldDb, newDb, 'goods_issue_items', null, opts.dryRun));
  results.push(migrateTable(oldDb, newDb, 'payment_orders', null, opts.dryRun));
  results.push(migrateTable(oldDb, newDb, 'payment_order_issues', null, opts.dryRun));
  results.push(migrateInvoices(oldDb, newDb, opts.dryRun));
  results.push(migrateExpenses(oldDb, newDb, opts.dryRun));
  results.push(migrateCars(oldDb, newDb, opts.dryRun));
  results.push(migrateTable(oldDb, newDb, 'logbook', null, opts.dryRun));

  console.log('\n=== 迁移结果 ===');
  console.table(
    results.map((r) => ({
      table: r.table,
      oldCount: r.oldCount,
      newCount: r.newCount,
      inserted: r.inserted,
      skipped: r.skipped,
      note: r.note || '',
      ok: r.ok ? '✓' : '✗',
    }))
  );

  const allWarnings = results.flatMap((r) => r.warnings || []);
  if (allWarnings.length > 0) {
    console.log('\n=== 警告 ===');
    allWarnings.forEach((w) => console.log(`⚠ ${w}`));
  }

  if (!opts.dryRun) {
    validate(oldDb, newDb);

    const onePercentCount = newDb
      .prepare("SELECT COUNT(*) AS c FROM other_expenses WHERE category = '1percent'")
      .get().c;
    if (onePercentCount > 0) {
      console.log(`\n⚠ 注意: other_expenses 中有 ${onePercentCount} 条 category='1percent' 的记录。`);
      console.log('  新应用会根据 company_cars 自动生成 car_expenses 记录，可能导致税务重复计算。');
      console.log('  建议：进入车辆页确认自动生成的记录后，手动删除 other_expenses 中重复的 1% 规则记录。');
    }

    const carsCount = newDb.prepare('SELECT COUNT(*) AS c FROM company_cars').get().c;
    if (carsCount > 0) {
      const carExpCount = newDb.prepare('SELECT COUNT(*) AS c FROM car_expenses').get().c;
      console.log(`\nℹ 公司车 ${carsCount} 辆，car_expenses 表当前 ${carExpCount} 条。`);
      console.log('  下次进入车辆页或税务页时，会自动补齐历史月份的月度记录。');
    }

    console.log('\n=== 附件文件 ===');
    console.log(`旧附件目录: ${path.join(path.dirname(opts.old), 'issues')} 等`);
    console.log(`新应用期望位置: ${opts.dataDir}/attachments/ 和 ${opts.dataDir}/invoices/`);
    console.log('数据库中的附件路径保留旧值，如果前端访问失败，需要手动迁移文件。');
    console.log('这一步可以后续用文件迁移脚本处理。');
  }

  console.log('\n迁移完成。');
  oldDb.close();
  newDb.close();
}

main().catch((err) => {
  console.error('\n迁移失败:', err);
  process.exit(1);
});