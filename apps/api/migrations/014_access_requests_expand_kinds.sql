PRAGMA foreign_keys=OFF;

CREATE TABLE access_requests_new (
  id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  request_kind TEXT NOT NULL CHECK (request_kind IN ('individual_workspace', 'business_workspace')),
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

INSERT INTO access_requests_new (
  id, clerk_user_id, email, full_name, request_kind, role_title, organization_name, website,
  line_of_business, requested_features_json, team_size, authority_attestation,
  verification_materials_json, notes, status, review_notes, reviewed_by_user_id,
  reviewed_at, created_at, updated_at
)
SELECT
  id, clerk_user_id, email, full_name, request_kind, role_title, organization_name, website,
  line_of_business, requested_features_json, team_size, authority_attestation,
  verification_materials_json, notes, status, review_notes, reviewed_by_user_id,
  reviewed_at, created_at, updated_at
FROM access_requests;

DROP TABLE access_requests;
ALTER TABLE access_requests_new RENAME TO access_requests;

CREATE INDEX IF NOT EXISTS idx_access_requests_clerk_user_id ON access_requests(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(email);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);

PRAGMA foreign_keys=ON;
