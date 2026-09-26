#!/usr/bin/env node
// Dry run: node scripts/optimize-images.js
// Apply + pre-generate all responsive sizes: node scripts/optimize-images.js --apply --warm
import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { optimizedImage } from '../lib/image-optimizer.js';
import { IMAGE_WIDTHS } from '../lib/image-urls.js';

const apply = process.argv.includes('--apply');
const warm = process.argv.includes('--warm');
const root = process.cwd();
const dbPath = process.env.DATABASE_PATH || path.join(root, 'data/cali-reporter.db');
const db = new Database(dbPath, { fileMustExist: true, readonly: !apply });
db.pragma('busy_timeout = 10000');
const columns = [['posts', 'hero_image'], ['authors', 'headshot'], ['share_queue', 'cover_image']]
  .filter(([table, col]) => db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col));
const urls = new Set(columns.flatMap(([t, c]) => db.prepare(`SELECT DISTINCT ${c} AS url FROM ${t} WHERE ${c} IS NOT NULL AND ${c} != ''`).all().map(r => r.url)));
const result = { mode: apply ? 'apply' : 'dry-run', uniqueReferences: urls.size, converted: 0, alreadyWebp: 0, externalOrUnsupported: 0, errors: 0, originalBytes: 0, optimizedBytes: 0, updatedReferences: 0, warmed: 0 };
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const auditDirectory = path.join(root, 'data/image-optimization');
const manifest = path.join(auditDirectory, `${stamp}.jsonl`);
if (apply) {
  await fs.mkdir(auditDirectory, { recursive: true });
  const backup = path.join(auditDirectory, `before-${stamp}.db`);
  await db.backup(backup); // Consistent online SQLite backup, including committed WAL.
  console.log(JSON.stringify({ backup, manifest }));
}
const updates = apply ? columns.map(([t,c]) => db.prepare(`UPDATE ${t} SET ${c} = ? WHERE ${c} = ?`)) : [];
const replace = db.transaction((oldUrl, newUrl) => updates.reduce((n, s) => n + s.run(newUrl, oldUrl).changes, 0));
for (const url of urls) {
  const local = /^\/uploads\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/i.test(url);
  // The existing database also uses four shared Unsplash fallbacks. Import
  // those once; never turn a database value into an arbitrary network fetch.
  const remote = /^https:\/\/images\.unsplash\.com\/photo-[a-zA-Z0-9-]+(?:\?[^#]*)?$/.test(url);
  if (!local && !remote) { result.externalOrUnsupported++; continue; }
  let filename = local ? url.slice('/uploads/'.length) : `import-${crypto.createHash('sha256').update(url).digest('hex').slice(0,16)}.jpg`;
  try {
    const source = path.join(root, 'public/uploads', filename);
    if (local && !(await fs.lstat(source)).isFile()) throw new Error('Source is not a regular file');
    if (local && /\.webp$/i.test(filename)) result.alreadyWebp++;
    else {
      let bytes;
      if (remote) {
        const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`Image download HTTP ${response.status}`);
        const chunks = []; let size = 0;
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > 20_000_000) throw new Error('Remote image exceeds 20 MB');
          chunks.push(chunk);
        }
        bytes = Buffer.concat(chunks);
      } else bytes = await fs.readFile(source);
      const output = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate()
        .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 }).toBuffer();
      const hash = crypto.createHash('sha256').update(output).digest('hex').slice(0, 16);
      filename = `${path.parse(filename).name}-web-${hash}.webp`;
      const newUrl = `/uploads/${filename}`;
      result.originalBytes += bytes.length; result.optimizedBytes += output.length;
      if (apply) {
        const target = path.join(root, 'public/uploads', filename);
        const temporary = `${target}.${crypto.randomUUID()}.tmp`;
        await fs.writeFile(temporary, output); await fs.rename(temporary, target);
        // Journal before mutation. A restart safely recomputes deterministic files;
        // conditional updates cannot overwrite a newly generated image reference.
        await fs.appendFile(manifest, JSON.stringify({ oldUrl: url, newUrl, before: bytes.length, after: output.length }) + '\n');
        result.updatedReferences += replace(url, newUrl);
      }
      result.converted++;
    }
    if (apply && warm) for (const width of IMAGE_WIDTHS) { await optimizedImage(filename, width, root); result.warmed++; }
  } catch (error) { result.errors++; console.error(JSON.stringify({ url, error: error.message })); }
  if ((result.converted + result.alreadyWebp) % 50 === 0) console.log(JSON.stringify(result));
}
db.close();
console.log(JSON.stringify(result));
if (apply) await fs.writeFile(path.join(auditDirectory, `${stamp}-summary.json`), JSON.stringify(result, null, 2));
if (result.errors) process.exitCode = 1;
