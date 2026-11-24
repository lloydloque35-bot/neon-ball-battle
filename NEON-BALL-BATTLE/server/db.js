'use strict';
/**
 * SQLite data layer (Node's built-in node:sqlite, no external dependencies).
 * WAL mode, foreign keys, numbered SQL migrations, prepared-statement cache and transactions.
 */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

class DB {
  constructor(file) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.file = file;
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
    this.cache = new Map();
    this.depth = 0;
  }
  stmt(sql) { let s = this.cache.get(sql); if (!s) { s = this.db.prepare(sql); this.cache.set(sql, s); } return s; }
  get(sql, ...p) { return this.stmt(sql).get(...p); }
  all(sql, ...p) { return this.stmt(sql).all(...p); }
  run(sql, ...p) { return this.stmt(sql).run(...p); }
  exec(sql) { return this.db.exec(sql); }
  /** synchronous transaction; nested calls join the outer transaction */
  tx(fn) {
    if (this.depth > 0) return fn();
    this.depth++;
    this.db.exec('BEGIN IMMEDIATE');
    try { const r = fn(); this.db.exec('COMMIT'); return r; }
    catch (e) { try { this.db.exec('ROLLBACK'); } catch (_) { /* ignore */ } throw e; }
    finally { this.depth--; }
  }
  migrate(dir = path.join(__dirname, 'migrations')) {
    this.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)');
    const done = new Set(this.all('SELECT version FROM schema_migrations').map(r => r.version));
    const files = fs.readdirSync(dir).filter(f => /^\d+_.+\.sql$/.test(f)).sort();
    const applied = [];
    for (const f of files) {
      const v = parseInt(f, 10);
      if (done.has(v)) continue;
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      this.tx(() => { this.exec(sql); this.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', v, f, Date.now()); });
      applied.push(f);
    }
    return applied;
  }
  /** consistent online backup (VACUUM INTO) */
  backup(target) { fs.mkdirSync(path.dirname(target), { recursive: true }); this.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`); return target; }
  close() { this.cache.clear(); this.db.close(); }
}

const json = (v, d = null) => { if (v == null || v === '') return d; try { return JSON.parse(v); } catch { return d; } };

module.exports = { DB, json };
