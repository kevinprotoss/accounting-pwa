import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { dataDir } from '../db.js';
import { trashFile } from '../utils/trash.js';

const ATTACH_DIR = path.join(dataDir, 'attachments');
const MAX_SIZE = 20 * 1024 * 1024;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeName(name) {
  return String(name).replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 100);
}

function monthDir() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function guessMime(name) {
  const ext = path.extname(name).toLowerCase();
  const map = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.doc': 'application/msword',
    '.docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx':
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return map[ext] ?? 'application/octet-stream';
}

export default async function attachmentsRoutes(app) {
  app.post('/', async (req, reply) => {
    const parts = req.parts();
    const saved = [];
    const month = monthDir();
    const dir = path.join(ATTACH_DIR, month);
    ensureDir(dir);

    for await (const part of parts) {
      if (part.type !== 'file') continue;
      const original = part.filename || 'file';
      const clean = safeName(original);
      const ts = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const filename = `${ts}_${rand}_${clean}`;
      const fullPath = path.join(dir, filename);
      await pipeline(part.file, fs.createWriteStream(fullPath));
      if (part.file.truncated) {
        try {
          fs.unlinkSync(fullPath);
        } catch {
          /* ignore */
        }
        return reply.code(413).send({ error: '文件超过大小限制' });
      }
      const stat = fs.statSync(fullPath);
      saved.push({
        path: `${month}/${filename}`,
        originalName: original,
        size: stat.size,
      });
    }

    if (saved.length === 0) {
      return reply.code(400).send({ error: '没有收到文件' });
    }
    return saved;
  });

  app.delete('/', async (req, reply) => {
    const relPath = req.body?.path;
    if (!relPath || typeof relPath !== 'string') {
      return reply.code(400).send({ error: 'path 必填' });
    }
    if (relPath.includes('..')) {
      return reply.code(400).send({ error: '非法路径' });
    }
    const fullPath = path.join(ATTACH_DIR, relPath);
    if (!fullPath.startsWith(ATTACH_DIR)) {
      return reply.code(400).send({ error: '非法路径' });
    }
    trashFile(fullPath);
    return { ok: true };
  });

  app.get('/:month/:filename', async (req, reply) => {
    const { month, filename } = req.params;
    if (
      month.includes('..') ||
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\')
    ) {
      return reply.code(400).send({ error: '非法路径' });
    }
    const fullPath = path.join(ATTACH_DIR, month, filename);
    if (!fullPath.startsWith(ATTACH_DIR)) {
      return reply.code(400).send({ error: '非法路径' });
    }
    if (!fs.existsSync(fullPath)) {
      return reply.code(404).send({ error: '文件不存在' });
    }
    const stat = fs.statSync(fullPath);
    const mime = guessMime(filename);
    reply
      .header('Content-Type', mime)
      .header('Content-Length', stat.size)
      .header(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(filename)}"`
      );
    return reply.send(fs.createReadStream(fullPath));
  });
}