import Database from 'better-sqlite3';
import PQueue from 'p-queue';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'system.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS company_info (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT,
    street TEXT,
    postcode TEXT,
    city TEXT,
    ust_idnr TEXT,
    tax_number TEXT,
    bank_name TEXT,
    iban TEXT,
    bic TEXT
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    street TEXT,
    postcode TEXT,
    city TEXT,
    country TEXT,
    ust_idnr TEXT,
    email TEXT,
    phone TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS goods_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_number TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    supplier TEXT,
    supplier_invoice TEXT,
    remarks TEXT,
    attachment_path TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS goods_receipt_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    net_unit_price REAL NOT NULL,
    tax_rate INTEGER DEFAULT 19,
    FOREIGN KEY(receipt_id) REFERENCES goods_receipts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS goods_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_number TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    customer_id INTEGER,
    customer_name TEXT,
    customer_address TEXT,
    customer_vat_id TEXT,
    invoice_number TEXT UNIQUE,
    is_export BOOLEAN DEFAULT 0,
    carrier TEXT,
    tracking_number TEXT,
    shipping_date TEXT,
    export_customs_number TEXT,
    export_customs_date TEXT,
    export_location TEXT,
    export_attachment_path TEXT,
    payment_attachment_paths TEXT,
    bank_reference TEXT,
    payment_received_date TEXT,
    status TEXT DEFAULT 'open',
    remarks TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS goods_issue_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL,
    receipt_item_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    selling_net_price REAL NOT NULL,
    tax_rate INTEGER DEFAULT 19,
    FOREIGN KEY(issue_id) REFERENCES goods_issues(id) ON DELETE CASCADE,
    FOREIGN KEY(receipt_item_id) REFERENCES goods_receipt_items(id)
  );

  CREATE TABLE IF NOT EXISTS payment_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE NOT NULL,
    trade_id TEXT,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'EUR',
    description TEXT,
    qrcode_url TEXT,
    status TEXT DEFAULT 'pending',
    pay_time TEXT,
    source TEXT DEFAULT 'local',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payment_order_issues (
    payment_order_id INTEGER NOT NULL,
    issue_id INTEGER NOT NULL UNIQUE,
    PRIMARY KEY (payment_order_id, issue_id),
    FOREIGN KEY (payment_order_id) REFERENCES payment_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (issue_id) REFERENCES goods_issues(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    issue_id INTEGER NOT NULL UNIQUE,
    pdf_path TEXT,
    net_total REAL,
    tax_total REAL,
    gross_total REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(issue_id) REFERENCES goods_issues(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS other_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    category TEXT,
    description TEXT,
    net_amount REAL,
    tax_rate INTEGER DEFAULT 19,
    input_tax REAL,
    is_output_tax BOOLEAN DEFAULT 0,
    attachment_path TEXT,
    supplier_invoice TEXT,
    remarks TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS company_cars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_plate TEXT UNIQUE NOT NULL,
    gross_list_price REAL NOT NULL,
    acquisition_date TEXT NOT NULL,
    active BOOLEAN DEFAULT 1,
    tax_rule_percent REAL DEFAULT 1,
    deactivated_at TEXT,
    reactivated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS car_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    car_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    amount REAL NOT NULL,
    tax_rule_percent REAL NOT NULL,
    UNIQUE(car_id, month),
    FOREIGN KEY(car_id) REFERENCES company_cars(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS logbook (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT,
    record_id INTEGER,
    action TEXT,
    old_values TEXT,
    new_values TEXT,
    user TEXT DEFAULT 'system',
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS scan_jobs (
    scan_id TEXT PRIMARY KEY,
    remote_scan_id TEXT,
    target_type TEXT NOT NULL,
    image_paths TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitting',
    error_message TEXT,
    record_type TEXT,
    record_id INTEGER,
    raw_result TEXT,
    consumed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status);
  CREATE INDEX IF NOT EXISTS idx_scan_jobs_remote ON scan_jobs(remote_scan_id);
  CREATE INDEX IF NOT EXISTS idx_scan_jobs_record ON scan_jobs(record_type, record_id);

  CREATE VIEW IF NOT EXISTS current_stock AS
  SELECT
    ri.id AS receipt_item_id,
    ri.product_name,
    ri.net_unit_price AS purchase_price,
    ri.tax_rate,
    ri.quantity AS received_qty,
    COALESCE(SUM(gi.quantity), 0) AS issued_qty,
    (ri.quantity - COALESCE(SUM(gi.quantity), 0)) AS remaining_qty,
    gr.date AS receipt_date,
    gr.supplier,
    gr.supplier_invoice
  FROM goods_receipt_items ri
  JOIN goods_receipts gr ON ri.receipt_id = gr.id
  LEFT JOIN goods_issue_items gi ON ri.id = gi.receipt_item_id
  GROUP BY ri.id
  HAVING remaining_qty > 0;
`);

const writeQueue = new PQueue({ concurrency: 1 });

export function enqueueWrite(fn) {
  return writeQueue.add(fn);
}

export function logChange(tableName, recordId, action, oldValues, newValues) {
  const stmt = db.prepare(`
    INSERT INTO logbook (table_name, record_id, action, old_values, new_values)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(tableName, recordId, action, JSON.stringify(oldValues), JSON.stringify(newValues));
}

export { db, dataDir };