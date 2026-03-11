CREATE TABLE IF NOT EXISTS communications (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  direction TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_name TEXT,
  subject TEXT,
  summary TEXT,
  content TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS idx_communications_lead_occurred ON communications(lead_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_communications_org_channel ON communications(organization_id, channel);
