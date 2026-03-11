CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (organization_id, key),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  body TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (template_id) REFERENCES templates(id)
);

CREATE INDEX IF NOT EXISTS idx_templates_org_key ON templates(organization_id, key);
CREATE INDEX IF NOT EXISTS idx_template_versions_template_changed ON template_versions(template_id, changed_at DESC);
