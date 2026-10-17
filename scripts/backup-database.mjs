#!/usr/bin/env node
// SQLite's online backup API includes committed WAL transactions safely.
import Database from 'better-sqlite3';
import path from 'node:path';
const source=process.env.DATABASE_PATH || 'data/cali-reporter.db';
const target=path.join(path.dirname(source),`backup-${new Date().toISOString().slice(0,10)}.db`);
const db=new Database(source,{readonly:true,fileMustExist:true});
try {
  await db.backup(target);
  console.log(JSON.stringify({event:'database-backup',target}));
} finally {db.close();}
