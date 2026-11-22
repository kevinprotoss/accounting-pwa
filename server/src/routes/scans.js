import fs from 'node:fs';
import path from 'node:path';
import { db, dataDir } from '../db.js';
import { ocrClient } from '../services/ocr-client.js';
import {
  getSnapshot,
  scanEvents,
  notifyScanUpdate,
} from '../services/scan-consumer.js';
import { trashFile } from '../utils/trash.js';

const ATTACH_DIR = path.join(dataDir, 'attachments');

function monthDir() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function safeName(name) {
  return String(name).replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 100);
}

function generateScanId() {
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const base = `JOB-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${rand}`;
}

async function saveUploads(req) {
  const month = monthDir();
  const dir = path.join(ATTACH_DIR, month);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const saved = [];
  for await (const part of req.parts()) {
    if (part.type !== 'file') continue;
    const clean = safeName(part.filename || 'file');
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const filename = `${ts}_${rand}_${clean}`;
    const fullPath = path.join(dir, filename);
    const buf = await part.toBuffer();
    if (buf.length === 0) continue;
    fs.writeFileSync(fullPath, buf);
    saved.push(`${month}/${filename}`);
  }
  return saved;
}

export default async function scansRoutes(app) {
  app.get('/health', async () => {
    try {
      const h = await ocrClient.health();
      return { available: h.model_loaded === true, status: h.status };
    } catch (err) {
      return { available: false, status: 'unreachable', error: err.message };
    }
  });

  app.get('/tasks', async () => {
    return getSnapshot();
  });

  app.get('/stream', async (req, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write('\n');

    const send = (tasks) => {
      reply.raw.write(`event: tasks\ndata: ${JSON.stringify(tasks)}\n\n`);
    };

    send(getSnapshot());

    const listener = (tasks) => send(tasks);
    scanEvents.on('update', listener);

    const keepAlive = setInterval(() => {
      try {
        reply.raw.write(': keepalive\n\n');
      } catch {}
    }, 30000);

    req.raw.on('close', () => {
      clearInterval(keepAlive);
      scanEvents.off('update', listener);
    });
  });

  app.post('/', async (req, reply) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return reply.code(400).send({ error: '需要 multipart/form-data' });
    }

    const fields = {};
    // 先把 target_type 从 parts 里读出来，同时收集文件
    const month = monthDir();
    const dir = path.join(ATTACH_DIR, month);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const imagePaths = [];
    for await (const part of req.parts()) {
      if (part.type === 'field' && part.fieldname === 'target_type') {
        fields.target_type = String(part.value);
      } else if (part.type === 'file') {
        const clean = safeName(part.filename || 'file');
        const ts = Date.now();
        const rand = Math.random().toString(36).slice(2, 8);
        const filename = `${ts}_${rand}_${clean}`;
        const fullPath = path.join(dir, filename);
        const buf = await part.toBuffer();
        if (buf.length === 0) continue;
        fs.writeFileSync(fullPath, buf);
        imagePaths.push(`${month}/${filename}`);
      }
    }

    const targetType = fields.target_type;
    if (targetType !== 'receipt' && targetType !== 'expense') {
      return reply.code(400).send({ error: 'target_type 必须是 receipt 或 expense' });
    }
    if (imagePaths.length === 0) {
      return reply.code(400).send({ error: '没有收到图片' });
    }

    const scanId = generateScanId();
    db.prepare(
      `INSERT INTO scan_jobs
        (scan_id, target_type, image_paths, status)
       VALUES (?, ?, ?, 'submitting')`
    ).run(scanId, targetType, JSON.stringify(imagePaths));

    try {
      const remote = await ocrClient.createScan(targetType, imagePaths);
      await ocrClient.processScan(remote.scan_id);
      db.prepare(
        `UPDATE scan_jobs
         SET remote_scan_id=?, status='pending', updated_at=CURRENT_TIMESTAMP
         WHERE scan_id=?`
      ).run(remote.scan_id, scanId);
    } catch (err) {
      db.prepare(
        `UPDATE scan_jobs
         SET status='failed', error_message=?, updated_at=CURRENT_TIMESTAMP
         WHERE scan_id=?`
      ).run(String(err.message || err), scanId);
    }

    notifyScanUpdate();
    const job = db
      .prepare('SELECT * FROM scan_jobs WHERE scan_id=?')
      .get(scanId);
    return reply.code(201).send(job);
  });

  app.post('/:id/retry', async (req, reply) => {
    const id = req.params.id;
    const job = db.prepare('SELECT * FROM scan_jobs WHERE scan_id=?').get(id);
    if (!job) return reply.code(404).send({ error: '任务不存在' });

    if (job.status === 'consume_failed') {
      db.prepare(
        "UPDATE scan_jobs SET status='ready', error_message=NULL, updated_at=CURRENT_TIMESTAMP WHERE scan_id=?"
      ).run(id);
      notifyScanUpdate();
      return { ok: true };
    }

    if (job.status === 'failed') {
      if (job.remote_scan_id) {
        try {
          await ocrClient.processScan(job.remote_scan_id);
          db.prepare(
            "UPDATE scan_jobs SET status='pending', error_message=NULL, updated_at=CURRENT_TIMESTAMP WHERE scan_id=?"
          ).run(id);
          notifyScanUpdate();
          return { ok: true };
        } catch (err) {
          db.prepare(
            'UPDATE scan_jobs SET error_message=?, updated_at=CURRENT_TIMESTAMP WHERE scan_id=?'
          ).run(String(err.message || err), id);
          notifyScanUpdate();
          return reply.code(500).send({ error: String(err.message || err) });
        }
      }

      try {
        const paths = JSON.parse(job.image_paths);
        const remote = await ocrClient.createScan(job.target_type, paths);
        await ocrClient.processScan(remote.scan_id);
        db.prepare(
          `UPDATE scan_jobs
           SET status='pending', remote_scan_id=?, error_message=NULL, updated_at=CURRENT_TIMESTAMP
           WHERE scan_id=?`
        ).run(remote.scan_id, id);
        notifyScanUpdate();
        return { ok: true };
      } catch (err) {
        db.prepare(
          'UPDATE scan_jobs SET error_message=?, updated_at=CURRENT_TIMESTAMP WHERE scan_id=?'
        ).run(String(err.message || err), id);
        notifyScanUpdate();
        return reply.code(500).send({ error: String(err.message || err) });
      }
    }

    return reply.code(400).send({ error: '当前状态不支持重试' });
  });

  app.delete('/:id', async (req, reply) => {
    const id = req.params.id;
    const job = db.prepare('SELECT * FROM scan_jobs WHERE scan_id=?').get(id);
    if (!job) return reply.code(404).send({ error: '任务不存在' });

    if (job.remote_scan_id) {
      try {
        await ocrClient.deleteScan(job.remote_scan_id);
      } catch {}
    }

    if (job.status !== 'consumed') {
      try {
        const paths = JSON.parse(job.image_paths || '[]');
        for (const rel of paths) {
          const full = path.join(dataDir, 'attachments', rel);
          if (fs.existsSync(full)) trashFile(full);
        }
      } catch {}
    }

    db.prepare('DELETE FROM scan_jobs WHERE scan_id=?').run(id);
    notifyScanUpdate();
    return reply.code(204).send();
  });

  app.post('/clear-completed', async () => {
    const jobs = db
      .prepare("SELECT * FROM scan_jobs WHERE status='consumed'")
      .all();
    let count = 0;
    for (const job of jobs) {
      if (job.remote_scan_id) {
        try {
          await ocrClient.deleteScan(job.remote_scan_id);
        } catch {}
      }
      db.prepare('DELETE FROM scan_jobs WHERE scan_id=?').run(job.scan_id);
      count++;
    }
    notifyScanUpdate();
    return { deleted: count };
  });

  app.post('/review/:recordType/:recordId', async (req, reply) => {
    const { recordType, recordId } = req.params;
    const id = Number(recordId);
    if (!['goods_receipts', 'other_expenses'].includes(recordType)) {
      return reply.code(400).send({ error: 'recordType 无效' });
    }
    const job = db
      .prepare(
        "SELECT * FROM scan_jobs WHERE record_type=? AND record_id=? AND status='consumed'"
      )
      .get(recordType, id);
    if (!job) {
      return { ok: true, already: true };
    }
    if (job.remote_scan_id) {
      try {
        await ocrClient.deleteScan(job.remote_scan_id);
      } catch {}
    }
    db.prepare('DELETE FROM scan_jobs WHERE scan_id=?').run(job.scan_id);
    notifyScanUpdate();
    return { ok: true };
  });
}