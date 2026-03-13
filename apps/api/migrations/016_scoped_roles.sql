PRAGMA foreign_keys=OFF;

CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('platform_owner', 'platform_admin', 'platform_sme', 'platform_agent', 'company_owner', 'company_admin', 'company_agent')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactivated', 'suspended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  permissions_json TEXT,
  clerk_user_id TEXT,
  UNIQUE (organization_id, email),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

INSERT INTO users_new (
  id, organization_id, full_name, email, role, status, created_at, updated_at, permissions_json, clerk_user_id
)
SELECT
  id,
  organization_id,
  full_name,
  email,
  CASE
    WHEN role = 'owner' THEN 'company_owner'
    WHEN role = 'admin' THEN 'company_admin'
    WHEN role = 'agent' THEN 'company_agent'
    ELSE role
  END,
  status,
  created_at,
  updated_at,
  permissions_json,
  clerk_user_id
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_org_role ON users(organization_id, role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);

PRAGMA foreign_keys=ON;
