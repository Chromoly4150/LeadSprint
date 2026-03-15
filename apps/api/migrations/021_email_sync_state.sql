CREATE TABLE IF NOT EXISTS email_sync_state (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email_account_id TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  sync_mode TEXT NOT NULL DEFAULT 'manual' CHECK (sync_mode IN ('manual', 'background')),
  last_cursor TEXT,
  last_synced_at TEXT,
  last_status TEXT NOT NULL DEFAULT 'idle' CHECK (last_status IN ('idle', 'running', 'ok', 'error')),
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(email_account_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (email_account_id) REFERENCES email_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_email_sync_state_org_provider ON email_sync_state(organization_id, provider_key);
