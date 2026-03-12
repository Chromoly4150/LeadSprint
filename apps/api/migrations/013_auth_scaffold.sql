ALTER TABLE organizations ADD COLUMN workspace_type TEXT NOT NULL DEFAULT 'business_verified' CHECK (workspace_type IN ('individual', 'business_verified'));
ALTER TABLE users ADD COLUMN clerk_user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);

CREATE TABLE IF NOT EXISTS access_requests (
  id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  request_kind TEXT NOT NULL CHECK (request_kind IN ('business_workspace')),
  role_title TEXT,
  organization_name TEXT NOT NULL,
  website TEXT,
  line_of_business TEXT,
  requested_features_json TEXT NOT NULL DEFAULT '[]',
  team_size TEXT,
  authority_attestation INTEGER NOT NULL DEFAULT 0,
  verification_materials_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'needs_follow_up', 'approved', 'rejected')),
  review_notes TEXT,
  reviewed_by_user_id TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_access_requests_clerk_user_id ON access_requests(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(email);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);

CREATE TABLE IF NOT EXISTS user_invitations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'agent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by_user_id TEXT NOT NULL,
  accepted_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id),
  FOREIGN KEY (accepted_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_org_status ON user_invitations(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
