CREATE TABLE IF NOT EXISTS email_provider_settings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(organization_id, provider_key),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
