import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { optimizedImage } from '../lib/image-optimizer.js';
import { imageUrl } from '../lib/image-urls.js';

test('resizes to WebP, reuses persistent output, preserves original and deduplicates simultaneous requests', async () => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(),'cali-images-'));
 try {
  await fs.mkdir(path.join(root,'public/uploads'),{recursive:true});
  const original=await sharp({create:{width:1280,height:720,channels:3,background:'#569acd'}}).png().toBuffer();
  const source=path.join(root,'public/uploads/test.png');await fs.writeFile(source,original);
  const images=await Promise.all(Array.from({length:8},()=>optimizedImage('test.png',160,root)));
  assert.ok(images.every(b=>b.equals(images[0])));
  const meta=await sharp(images[0]).metadata();assert.equal(meta.format,'webp');assert.equal(meta.width,160);assert.equal(meta.height,90);
  assert.deepEqual(await fs.readFile(source),original);
  const files=await fs.readdir(path.join(root,'data/image-cache/v1'));assert.equal(files.length,1);
  const stat=await fs.stat(path.join(root,'data/image-cache/v1',files[0]));
  assert.deepEqual(await optimizedImage('test.png',160,root),images[0]);
  assert.equal((await fs.stat(path.join(root,'data/image-cache/v1',files[0]))).mtimeMs,stat.mtimeMs);
  await assert.rejects(optimizedImage('../test.png',160,root),{status:400});
  await assert.rejects(optimizedImage('test.png',9999,root),{status:400});
  await assert.rejects(optimizedImage('missing.png',160,root),{code:'ENOENT'});
  await fs.symlink(source,path.join(root,'public/uploads/link.png'));
  await assert.rejects(optimizedImage('link.png',160,root),{status:404});
 } finally { await fs.rm(root,{recursive:true,force:true}); }
});
test('only local flat raster uploads receive bounded optimizer URLs',()=>{
 assert.equal(imageUrl('/uploads/test.png',640),'/media/v1/640/test.png.webp');
 for(const u of ['https://external.test/photo.png','/uploads/../../secret.png','/uploads/foo.svg','/ads/banner.png']) assert.equal(imageUrl(u,640),u);
 assert.throws(()=>imageUrl('/uploads/test.png',9999));
});

test('database batch backs up, converts all references, preserves edits and is idempotent', async () => {
 const {default:Database}=await import('better-sqlite3');const {execFileSync}=await import('node:child_process');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'cali-batch-'));
 try {
  await fs.mkdir(path.join(root,'public/uploads'),{recursive:true});await fs.mkdir(path.join(root,'data'));
  await sharp({create:{width:1280,height:720,channels:3,background:'#987654'}}).png().toFile(path.join(root,'public/uploads/test.png'));
  const db=new Database(path.join(root,'data/cali-reporter.db'));
  db.exec("CREATE TABLE posts (id INTEGER PRIMARY KEY, hero_image TEXT); CREATE TABLE authors (id INTEGER PRIMARY KEY, headshot TEXT); CREATE TABLE share_queue (id INTEGER PRIMARY KEY, cover_image TEXT); INSERT INTO posts VALUES(1,'/uploads/test.png'),(2,'https://example.com/remote.jpg'); INSERT INTO authors VALUES(1,'/uploads/test.png'); INSERT INTO share_queue VALUES(1,'/uploads/test.png');");
  const script=path.resolve('scripts/optimize-images.js');const opts={cwd:root,encoding:'utf8',env:{...process.env,DATABASE_PATH:path.join(root,'data/cali-reporter.db')}};
  const dry=JSON.parse(execFileSync(process.execPath,[script],opts).trim().split('\n').pop());assert.equal(dry.converted,1);assert.equal(db.prepare('SELECT hero_image FROM posts WHERE id=1').get().hero_image,'/uploads/test.png');
  const applied=JSON.parse(execFileSync(process.execPath,[script,'--apply','--warm'],opts).trim().split('\n').pop());assert.equal(applied.updatedReferences,3);assert.equal(applied.warmed,6);assert.equal(applied.errors,0);
  const newUrl=db.prepare('SELECT hero_image FROM posts WHERE id=1').get().hero_image;assert.match(newUrl,/\.webp$/);
  assert.equal(db.prepare('SELECT headshot FROM authors').get().headshot,newUrl);assert.equal(db.prepare('SELECT cover_image FROM share_queue').get().cover_image,newUrl);
  assert.equal(db.prepare('SELECT hero_image FROM posts WHERE id=2').get().hero_image,'https://example.com/remote.jpg');
  await fs.access(path.join(root,'public/uploads/test.png'));
  const backups=(await fs.readdir(path.join(root,'data/image-optimization'))).filter(f=>f.endsWith('.db'));assert.equal(backups.length,1);
  const backup=new Database(path.join(root,'data/image-optimization',backups[0]),{readonly:true});assert.equal(backup.prepare('SELECT hero_image FROM posts WHERE id=1').get().hero_image,'/uploads/test.png');backup.close();
  const rerun=JSON.parse(execFileSync(process.execPath,[script,'--apply'],opts).trim().split('\n').pop());assert.equal(rerun.converted,0);assert.equal(rerun.updatedReferences,0);assert.equal(rerun.alreadyWebp,1);db.close();
 } finally {await fs.rm(root,{recursive:true,force:true});}
});
