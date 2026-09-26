import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { IMAGE_WIDTHS } from './image-urls.js';

sharp.concurrency(1);
const pending = new Map();
let running = 0;
const waiters = [];
async function limited(fn) {
  if (running >= 2) await new Promise(resolve => waiters.push(resolve));
  else running++;
  try { return await fn(); }
  finally { const next = waiters.shift(); if (next) next(); else running--; }
}

export async function optimizedImage(filename, width, root = process.cwd()) {
  if (!IMAGE_WIDTHS.includes(width) || !/^[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/i.test(filename || '')) {
    const error = new Error('Invalid image'); error.status = 400; throw error;
  }
  const uploads = path.join(root, 'public', 'uploads');
  const source = path.join(uploads, filename);
  const info = await fs.lstat(source);
  if (!info.isFile() || info.isSymbolicLink()) {
    const error = new Error('Not found'); error.status = 404; throw error;
  }
  const key = crypto.createHash('sha256').update(`v1:${filename}:${info.size}:${info.mtimeMs}:${width}`).digest('hex');
  const directory = path.join(root, 'data', 'image-cache', 'v1');
  const target = path.join(directory, `${key}.webp`);
  try { return await fs.readFile(target); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (!pending.has(target)) {
    // Bound outstanding distinct jobs as well as CPU use on a cold cache.
    if (pending.size >= 64) { const error = new Error('Busy'); error.status = 503; throw error; }
    pending.set(target, limited(async () => {
      const bytes = await sharp(source, { limitInputPixels: 40_000_000 })
        .rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78, effort: 4 }).toBuffer();
      await fs.mkdir(directory, { recursive: true });
      const temporary = `${target}.${crypto.randomUUID()}.tmp`;
      await fs.writeFile(temporary, bytes);
      await fs.rename(temporary, target);
      return bytes;
    }).finally(() => pending.delete(target)));
  }
  return pending.get(target);
}
