CREATE TABLE IF NOT EXISTS email_outbox (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  email_draft_id TEXT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  provider_key TEXT,
  send_status TEXT NOT NULL DEFAULT 'queued',
  queued_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  failed_at TEXT,
  last_error TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (email_draft_id) REFERENCES email_drafts(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_lead_created ON email_outbox(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_outbox_status ON email_outbox(send_status, queued_at DESC);
