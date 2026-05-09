import BetterSQLite from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../migrations');

// Wraps better-sqlite3 in Cloudflare D1's async prepared-statement interface.
export function createD1Mock() {
  const db = new BetterSQLite(':memory:');
  db.exec(readFileSync(join(migrationsDir, '0001_create_drafts.sql'), 'utf8'));

  return {
    prepare(sql) {
      let args = [];
      const stmt = {
        bind(...params) { args = params; return stmt; },
        async all()   { return { results: db.prepare(sql).all(...args) }; },
        async first()  { return db.prepare(sql).get(...args) ?? null; },
        async run()    { db.prepare(sql).run(...args); return { success: true }; },
      };
      return stmt;
    },
  };
}
