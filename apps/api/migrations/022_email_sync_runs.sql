ALTER TABLE email_sync_state ADD COLUMN locked_by TEXT;
ALTER TABLE email_sync_state ADD COLUMN lock_expires_at TEXT;
ALTER TABLE email_sync_state ADD COLUMN sync_interval_minutes INTEGER NOT NULL DEFAULT 15;

CREATE TABLE IF NOT EXISTS email_sync_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email_account_id TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'ok', 'error')),
  locked_by TEXT,
  imported_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  checked_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (email_account_id) REFERENCES email_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_email_sync_runs_account_started ON email_sync_runs(email_account_id, started_at DESC);
