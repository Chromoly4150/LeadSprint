const crypto = require('crypto');
const { ensureDb, runMigrations, nowIso } = require('../src/db');

runMigrations();
const db = ensureDb();

const DEFAULT_ORG_ID = process.env.DEFAULT_ORG_ID || 'org_default';

const sample = [
  ['Jamie Carter', 'jamie@example.com', null, 'facebook_ads', 'Need estimate for bathroom remodel'],
  ['Priya Singh', null, '+1-555-0102', 'website_form', 'Looking for pest control this week'],
  ['Marcus Lee', 'marcus@example.com', null, 'google_ads', 'Interested in solar panel consultation'],
  ['Elena Ruiz', 'elena@example.com', null, 'referral', 'Can you quote monthly lawn service?'],
  ['Darnell Price', null, '+1-555-0105', 'landing_page', 'Need HVAC repair this weekend'],
];

for (const [fullName, email, phone, source, message] of sample) {
  const id = `lead_${crypto.randomUUID()}`;
  const ts = nowIso();
  db.prepare(
    `INSERT INTO leads (id, organization_id, full_name, email, phone, source, message, status, received_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`
  ).run(id, DEFAULT_ORG_ID, fullName, email, phone, source, message, ts, ts, ts);
}

console.log(`Seeded ${sample.length} leads.`);
