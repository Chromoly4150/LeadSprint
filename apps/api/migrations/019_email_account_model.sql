PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS organization_email_policies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE,
  allow_user_mailboxes INTEGER NOT NULL DEFAULT 0,
  default_send_mode TEXT NOT NULL DEFAULT 'org_default' CHECK (default_send_mode IN ('org_default', 'user_optional', 'user_preferred')),
  restrict_outbound_to_company_domains INTEGER NOT NULL DEFAULT 0,
  allowed_user_mailbox_roles_json TEXT NOT NULL DEFAULT '["company_admin"]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS email_accounts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('organization', 'user')),
  provider_type TEXT NOT NULL CHECK (provider_type IN ('google', 'microsoft', 'imap_smtp', 'smtp_only', 'api_provider', 'stub')),
  provider_key TEXT,
  account_role TEXT NOT NULL DEFAULT 'inbox_and_send' CHECK (account_role IN ('inbox_and_send', 'send_only', 'inbox_only')),
  email_address TEXT NOT NULL,
  display_name TEXT,
  signature TEXT,
  auth_method TEXT NOT NULL DEFAULT 'oauth' CHECK (auth_method IN ('oauth', 'app_password', 'credentials', 'token', 'none')),
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  config_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'needs_reauth', 'degraded', 'disconnected')),
  is_default_for_org INTEGER NOT NULL DEFAULT 0,
  is_default_for_user INTEGER NOT NULL DEFAULT 0,
  last_sync_at TEXT,
  last_send_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_email_accounts_org_scope ON email_accounts(organization_id, scope_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_accounts_user ON email_accounts(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_accounts_org_default ON email_accounts(organization_id, is_default_for_org) WHERE is_default_for_org = 1;
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_accounts_user_default ON email_accounts(user_id, is_default_for_user) WHERE is_default_for_user = 1;
