const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'leadgen.sqlite');
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

let db;

function ensureDb() {
  if (db) return db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function runMigrations() {
  const database = ensureDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const insertMigration = database.prepare('INSERT INTO schema_migrations (id) VALUES (?)');

  for (const file of files) {
    const alreadyApplied = database
      .prepare('SELECT 1 FROM schema_migrations WHERE id = ? LIMIT 1')
      .get(file);

    if (alreadyApplied) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    database.exec(sql);
    insertMigration.run(file);
  }
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = {
  ensureDb,
  runMigrations,
  nowIso,
};
