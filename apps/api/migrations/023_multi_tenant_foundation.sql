PRAGMA foreign_keys=ON;

ALTER TABLE organizations ADD COLUMN environment TEXT NOT NULL DEFAULT 'customer' CHECK (environment IN ('customer', 'internal_test'));
ALTER TABLE users ADD COLUMN preferred_workspace_id TEXT;

CREATE TABLE IF NOT EXISTS organization_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, organization_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS platform_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('platform_admin', 'platform_support', 'platform_operator')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_actor_context (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  acting_as_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (acting_as_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON organization_memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON organization_memberships(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_platform_roles_user ON platform_roles(user_id);

INSERT OR IGNORE INTO organization_memberships (id, user_id, organization_id, role, status, created_at, updated_at)
SELECT 'mem_' || lower(hex(randomblob(16))), u.id, u.organization_id,
  CASE
    WHEN u.role IN ('owner', 'company_owner') THEN 'owner'
    WHEN u.role IN ('admin', 'company_admin') THEN 'admin'
    WHEN u.role IN ('agent', 'company_agent') THEN 'operator'
    ELSE 'viewer'
  END,
  CASE WHEN u.status = 'active' THEN 'active' ELSE 'disabled' END,
  COALESCE(u.created_at, datetime('now')),
  COALESCE(u.updated_at, datetime('now'))
FROM users u
WHERE u.organization_id IS NOT NULL;

INSERT OR IGNORE INTO platform_roles (id, user_id, role, created_at, updated_at)
SELECT 'prol_' || lower(hex(randomblob(16))), u.id,
  CASE
    WHEN u.role IN ('platform_owner', 'platform_admin') THEN 'platform_admin'
    WHEN u.role = 'platform_sme' THEN 'platform_support'
    WHEN u.role = 'platform_agent' THEN 'platform_operator'
    ELSE NULL
  END,
  COALESCE(u.created_at, datetime('now')),
  COALESCE(u.updated_at, datetime('now'))
FROM users u
WHERE u.role IN ('platform_owner', 'platform_admin', 'platform_sme', 'platform_agent');

UPDATE users
SET preferred_workspace_id = organization_id
WHERE preferred_workspace_id IS NULL AND organization_id IS NOT NULL;
