import { EventEmitter } from 'node:events';
import { db, enqueueWrite, logChange } from '../db.js';
import { ocrClient } from './ocr-client.js';
import { invoiceToReceipt, invoiceToExpense } from './scan-mapping.js';

export const scanEvents = new EventEmitter();
scanEvents.setMaxListeners(50);

let snapshot = [];
let running = false;
let timer = null;

export function getSnapshot() {
  return snapshot;
}

function rowToTask(row) {
  let uncertain = [];
  if (row.raw_result) {
    try {
      const r = JSON.parse(row.raw_result);
      uncertain = r.uncertain_items || [];
    } catch {
      uncertain = [];
    }
  }
  return {
    scan_id: row.scan_id,
    remote_scan_id: row.remote_scan_id,
    target_type: row.target_type,
    image_paths: (() => {
      try {
        return JSON.parse(row.image_paths || '[]');
      } catch {
        return [];
      }
    })(),
    status: row.status,
    error_message: row.error_message,
    record_type: row.record_type,
    record_id: row.record_id,
    uncertain_items: uncertain,
    uncertain_count: uncertain.length,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rebuildSnapshot() {
  const rows = db
    .prepare('SELECT * FROM scan_jobs ORDER BY created_at DESC')
    .all();
  snapshot = rows.map(rowToTask);
}

function emitUpdate() {
  rebuildSnapshot();
  scanEvents.emit('update', snapshot);
}

async function refreshFromPython() {
  let remoteScans;
  try {
    remoteScans = await ocrClient.listScans();
  } catch (err) {
    return;
  }
  const remoteMap = new Map(remoteScans.map((s) => [s.scan_id, s]));

  const jobs = db
    .prepare(
      "SELECT * FROM scan_jobs WHERE status IN ('pending','processing','ready') AND remote_scan_id IS NOT NULL"
    )
    .all();

  for (const job of jobs) {
    const remote = remoteMap.get(job.remote_scan_id);
    if (!remote) continue;
    if (remote.status === job.status) continue;

    if (remote.status === 'ready') {
      try {
        const result = await ocrClient.getResult(job.remote_scan_id);
        db.prepare(
          "UPDATE scan_jobs SET status='ready', raw_result=?, updated_at=CURRENT_TIMESTAMP WHERE scan_id=?"
        ).run(JSON.stringify(result), job.scan_id);
      } catch (err) {
        console.error('[scan] getResult failed:', err.message);
      }
    } else if (remote.status === 'failed') {
      db.prepare(
        "UPDATE scan_jobs SET status='failed', error_message=?, updated_at=CURRENT_TIMESTAMP WHERE scan_id=?"
      ).run(remote.error_message || 'OCR failed', job.scan_id);
    } else {
      db.prepare(
        'UPDATE scan_jobs SET status=?, updated_at=CURRENT_TIMESTAMP WHERE scan_id=?'
      ).run(remote.status, job.scan_id);
    }
  }
}

function insertReceipt(payload) {
  return enqueueWrite(() => {
    const tx = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO goods_receipts
            (receipt_number, date, supplier, supplier_invoice, remarks, attachment_path)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          payload.receipt_number,
          payload.date,
          payload.supplier,
          payload.supplier_invoice,
          payload.remarks,
          payload.attachment_path
        );
      const receiptId = info.lastInsertRowid;
      const stmt = db.prepare(
        `INSERT INTO goods_receipt_items
          (receipt_id, product_name, quantity, net_unit_price, tax_rate)
         VALUES (?, ?, ?, ?, ?)`
      );
      for (const it of payload.items) {
        stmt.run(
          receiptId,
          it.product_name,
          it.quantity,
          it.net_unit_price,
          it.tax_rate
        );
      }
      return receiptId;
    });
    const id = tx();
    logChange('goods_receipts', id, 'create', null, { id, ...payload });
    return id;
  });
}

function insertExpense(payload) {
  return enqueueWrite(() => {
    const info = db
      .prepare(
        `INSERT INTO other_expenses
          (date, category, description, net_amount, tax_rate, input_tax,
           is_output_tax, attachment_path, supplier_invoice, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        payload.date,
        payload.category,
        payload.description,
        payload.net_amount,
        payload.tax_rate,
        payload.input_tax,
        payload.is_output_tax,
        payload.attachment_path,
        payload.supplier_invoice,
        payload.remarks
      );
    const id = info.lastInsertRowid;
    logChange('other_expenses', id, 'create', null, { id, ...payload });
    return id;
  });
}

async function consumeReadyJobs() {
  const jobs = db.prepare("SELECT * FROM scan_jobs WHERE status='ready'").all();

  for (const job of jobs) {
    try {
      const invoice = JSON.parse(job.raw_result);
      const imagePaths = (() => {
        try {
          return JSON.parse(job.image_paths || '[]');
        } catch {
          return [];
        }
      })();

      let recordId;
      let recordType;
      if (job.target_type === 'receipt') {
        const payload = invoiceToReceipt(invoice, imagePaths);
        recordId = await insertReceipt(payload);
        recordType = 'goods_receipts';
      } else {
        const payload = invoiceToExpense(invoice, imagePaths);
        recordId = await insertExpense(payload);
        recordType = 'other_expenses';
      }

      db.prepare(
        `UPDATE scan_jobs
         SET status='consumed', record_type=?, record_id=?,
             consumed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
         WHERE scan_id=?`
      ).run(recordType, recordId, job.scan_id);

      if (job.remote_scan_id) {
        try {
          await ocrClient.deleteScan(job.remote_scan_id);
        } catch {}
      }
    } catch (err) {
      db.prepare(
        `UPDATE scan_jobs
         SET status='consume_failed', error_message=?, updated_at=CURRENT_TIMESTAMP
         WHERE scan_id=?`
      ).run(String(err.message || err), job.scan_id);
    }
  }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    await refreshFromPython();
    await consumeReadyJobs();
    emitUpdate();
  } catch (err) {
    console.error('[scan] tick failed:', err.message);
  } finally {
    running = false;
  }
}

export function startScanConsumer(intervalMs = 3000) {
  if (timer) return;
  rebuildSnapshot();
  tick();
  timer = setInterval(tick, intervalMs);
}

export function stopScanConsumer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function notifyScanUpdate() {
  emitUpdate();
}