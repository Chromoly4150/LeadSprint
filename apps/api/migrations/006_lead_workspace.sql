ALTER TABLE leads ADD COLUMN urgency_status TEXT NOT NULL DEFAULT 'warm';
ALTER TABLE leads ADD COLUMN last_contacted_at TEXT;

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  author_user_id TEXT,
  note_type TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (author_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_notes_lead_created ON notes(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_org_urgency ON leads(organization_id, urgency_status);
