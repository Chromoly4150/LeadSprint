const crypto = require('crypto');
const { ensureDb, runMigrations, nowIso } = require('../src/db');

runMigrations();
const db = ensureDb();
const DEFAULT_ORG_ID = process.env.DEFAULT_ORG_ID || 'org_default';
const users = [
  ['Ava Operations', 'ava@leadsprint.local', 'admin'],
  ['Noah Sales', 'noah@leadsprint.local', 'agent'],
  ['Mia Support', 'mia@leadsprint.local', 'agent'],
];

for (const [fullName, email, role] of users) {
  const existing = db.prepare('SELECT id FROM users WHERE organization_id = ? AND email = ? LIMIT 1').get(DEFAULT_ORG_ID, email);
  if (existing) continue;
  const ts = nowIso();
  db.prepare(
    `INSERT INTO users (id, organization_id, full_name, email, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
  ).run(`usr_${crypto.randomUUID()}`, DEFAULT_ORG_ID, fullName, email, role, ts, ts);
}

console.log('Seeded demo users.');
