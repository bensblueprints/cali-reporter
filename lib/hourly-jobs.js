export const HOUR = 3600000;
export function ensureHourlyJobs(db) {
 db.exec(`CREATE TABLE IF NOT EXISTS hourly_writer_jobs (
  id INTEGER PRIMARY KEY,author_id INTEGER NOT NULL REFERENCES authors(id),category TEXT NOT NULL,
  slot INTEGER NOT NULL,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt INTEGER NOT NULL DEFAULT 0,lease_until INTEGER NOT NULL DEFAULT 0,
  post_id INTEGER,error TEXT,UNIQUE(author_id,slot));
  CREATE TABLE IF NOT EXISTS hourly_source_claims (url TEXT PRIMARY KEY,job_id INTEGER NOT NULL,expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS hourly_source_failures (
   url TEXT PRIMARY KEY,retry_after INTEGER NOT NULL,error TEXT NOT NULL,failures INTEGER NOT NULL DEFAULT 1);`);
}
export function enqueueHour(db,writers,now=Date.now()) {
 const slot=Math.floor(now/HOUR)*HOUR;
 const insert=db.prepare('INSERT OR IGNORE INTO hourly_writer_jobs(author_id,category,slot,state,post_id) VALUES (?,?,?,?,?)');
 let inserted=0;
 db.transaction(()=>{for(const writer of writers) {
  const existing=db.prepare('SELECT id FROM posts WHERE author_id=? AND julianday(published_at)>=julianday(?) AND julianday(published_at)<julianday(?) ORDER BY id LIMIT 1').get(writer.id,new Date(slot).toISOString(),new Date(slot+HOUR).toISOString());
  inserted+=insert.run(writer.id,writer.desk,slot,existing?'complete':'pending',existing?.id||null).changes;
 }})();
 return inserted;
}
export function claimJob(db,now=Date.now(),allowedIds=null) {
 return db.transaction(()=>{
  db.prepare("UPDATE hourly_writer_jobs SET state='expired',error='Hour ended without an approved article' WHERE state IN ('pending','running','retry') AND slot+?<=?").run(HOUR,now);
  db.prepare("UPDATE hourly_writer_jobs SET state='retry',error='Recovered interrupted worker' WHERE state='running' AND lease_until<?").run(now);
  // Carry the rotation across hour boundaries. Slow/failing desks must not take
  // the first slots every hour merely because their latest publication is old.
  const job=db.prepare("SELECT j.*,a.name,a.slug AS author_slug,a.beat,a.voice_prompt FROM hourly_writer_jobs j JOIN authors a ON a.id=j.author_id WHERE j.state IN ('pending','retry') AND j.attempts<3 AND j.next_attempt<=? AND j.slot+?>? AND (? IS NULL OR j.author_id IN (SELECT value FROM json_each(?))) ORDER BY  (SELECT COALESCE(SUM(k.attempts),0) FROM hourly_writer_jobs k WHERE k.category=j.category AND k.slot=j.slot),  COALESCE((SELECT MAX(k.slot) FROM hourly_writer_jobs k WHERE k.category=j.category AND k.attempts>0),0),  COALESCE((SELECT MAX(julianday(p.published_at)) FROM posts p WHERE p.category=j.category),0),  j.attempts,  COALESCE((SELECT MAX(julianday(p.published_at)) FROM posts p WHERE p.author_id=j.author_id),0),  j.author_id LIMIT 1").get(now,HOUR,now,allowedIds?JSON.stringify(allowedIds):null,JSON.stringify(allowedIds||[]));
  if(!job)return null;
  db.prepare("UPDATE hourly_writer_jobs SET state='running',attempts=attempts+1,lease_until=? WHERE id=?").run(now+15*60000,job.id);
  return {...job,attempts:job.attempts+1};
 })();
}
export function retryJob(db,job,error,now=Date.now()) {
 db.prepare("UPDATE hourly_writer_jobs SET state=?,error=?,next_attempt=?,lease_until=0 WHERE id=? AND state='running'")
  .run(job.attempts>=3?'failed':'retry',String(error).slice(0,300),now+5*60000,job.id);
 db.prepare('DELETE FROM hourly_source_claims WHERE job_id=?').run(job.id);
}
export function reserveSource(db,job,url,now=Date.now()) {
 return db.transaction(()=>{
  db.prepare('DELETE FROM hourly_source_claims WHERE expires<?').run(now);
  if(db.prepare('SELECT 1 FROM hourly_source_failures WHERE url=? AND retry_after>?').get(url,now))return false;
  if(db.prepare('SELECT 1 FROM posts WHERE source_url=?').get(url))return false;
  return !!db.prepare('INSERT OR IGNORE INTO hourly_source_claims VALUES (?,?,?)').run(url,job.id,now+15*60000).changes;
 })();
}
export function deferSource(db,url,error,now=Date.now()) {
 // Let other workers reach deeper into the feeds instead of retrying the same
 // inadequate/rejected article immediately. Infrastructure failures get a short pause.
 const reason=String(error);
 const delay=/Insufficient full source material/.test(reason)?6*HOUR:
  /HTTP (?:429|5\d\d)|Inference upstream|fetch failed|timeout|timed out|aborted/i.test(reason)?5*60000:HOUR;
 db.prepare(`INSERT INTO hourly_source_failures(url,retry_after,error) VALUES (?,?,?)
  ON CONFLICT(url) DO UPDATE SET retry_after=excluded.retry_after,error=excluded.error,failures=failures+1`)
  .run(url,now+delay,reason.slice(0,300));
}
export function publishJob(db,job,post,now=Date.now()) {
 return db.transaction(()=>{
  const row=db.prepare('SELECT * FROM hourly_writer_jobs WHERE id=?').get(job.id);
  if(row?.state!=='running'||row.slot+HOUR<=now)throw new Error('Publishing slot expired or already completed');
  if(post.category!==row.category||post.author_id!==row.author_id)throw new Error('Writer/category mismatch');
  const existing=db.prepare('SELECT id FROM posts WHERE author_id=? AND julianday(published_at)>=julianday(?) AND julianday(published_at)<julianday(?) LIMIT 1').get(job.author_id,new Date(row.slot).toISOString(),new Date(row.slot+HOUR).toISOString());
  if(existing) {
   db.prepare("UPDATE hourly_writer_jobs SET state='complete',post_id=?,error='Existing article satisfies hourly slot',lease_until=0 WHERE id=?").run(existing.id,job.id);
   db.prepare('DELETE FROM hourly_source_claims WHERE job_id=?').run(job.id);
   return {id:existing.id,inserted:false};
  }
  if(db.prepare('SELECT 1 FROM posts WHERE source_url=? OR source_guid=?').get(post.source_url,post.source_guid))throw new Error('Source already published');
  const result=db.prepare(`INSERT INTO posts(slug,title,deck,content_html,hero_image,hero_alt,category,origin,source_name,source_url,source_guid,published_at,author_id)
   VALUES (@slug,@title,@deck,@content_html,@hero_image,@hero_alt,@category,'aggregated',@source_name,@source_url,@source_guid,@published_at,@author_id)`).run(post);
  db.prepare("UPDATE hourly_writer_jobs SET state='complete',post_id=?,error=NULL,lease_until=0 WHERE id=?").run(result.lastInsertRowid,job.id);
  db.prepare('DELETE FROM hourly_source_claims WHERE job_id=?').run(job.id);
  return {id:Number(result.lastInsertRowid),inserted:true};
 })();
}
