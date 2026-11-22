import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from '../db.js';

const trashDir = path.join(dataDir, 'trash');

export function trashFile(filePath) {
  if (!filePath) return null;
  try {
    if (!fs.existsSync(filePath)) return null;
    if (!fs.existsSync(trashDir)) fs.mkdirSync(trashDir, { recursive: true });

    const now = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}`;

    const baseName = path.basename(filePath);
    const ext = path.extname(baseName);
    const stem = path.basename(baseName, ext);

    let targetName = `${ts}_${stem}${ext}`;
    let targetPath = path.join(trashDir, targetName);
    let counter = 1;
    while (fs.existsSync(targetPath)) {
      targetName = `${ts}_${stem}_${counter}${ext}`;
      targetPath = path.join(trashDir, targetName);
      counter++;
    }

    fs.renameSync(filePath, targetPath);
    return targetPath;
  } catch (err) {
    console.error('[trash] failed:', err.message);
    return null;
  }
}