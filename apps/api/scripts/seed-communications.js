const crypto = require('crypto');
const { ensureDb, runMigrations, nowIso } = require('../src/db');

runMigrations();
const db = ensureDb();
const DEFAULT_ORG_ID = process.env.DEFAULT_ORG_ID || 'org_default';

const leads = db.prepare('SELECT id, full_name FROM leads WHERE organization_id = ? ORDER BY created_at ASC LIMIT 3').all(DEFAULT_ORG_ID);

for (const lead of leads) {
  const ts = nowIso();
  db.prepare(
    `INSERT INTO communications (id, organization_id, lead_id, channel, direction, actor_type, actor_name, subject, summary, content, occurred_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `com_${crypto.randomUUID()}`,
    DEFAULT_ORG_ID,
    lead.id,
    'email',
    'outbound',
    'user',
    'Organization Owner',
    'Quick follow-up',
    `Initial outreach sent to ${lead.full_name}.`,
    `Hi ${lead.full_name}, just following up on your request and next steps.`,
    ts,
    ts,
    ts
  );
}

console.log(`Seeded communications for ${leads.length} leads.`);
