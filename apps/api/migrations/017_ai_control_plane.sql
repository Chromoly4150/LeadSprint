PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS organization_ai_settings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE,
  ai_enabled INTEGER NOT NULL DEFAULT 0,
  default_mode TEXT NOT NULL DEFAULT 'draft_only' CHECK (default_mode IN ('draft_only', 'approval_required', 'guarded_autopilot')),
  allowed_channels_json TEXT NOT NULL DEFAULT '[]',
  allowed_actions_json TEXT NOT NULL DEFAULT '[]',
  response_sla_target_minutes INTEGER NOT NULL DEFAULT 5,
  tone_profile_json TEXT NOT NULL DEFAULT '{}',
  business_context_json TEXT NOT NULL DEFAULT '{}',
  compliance_policy_json TEXT NOT NULL DEFAULT '{}',
  usage_plan TEXT NOT NULL DEFAULT 'standard',
  monthly_message_limit INTEGER NOT NULL DEFAULT 250,
  monthly_ai_token_budget INTEGER NOT NULL DEFAULT 250000,
  model_policy_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS ai_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  workflow_type TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_id TEXT,
  lead_id TEXT,
  conversation_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'blocked')),
  mode TEXT NOT NULL DEFAULT 'draft_only' CHECK (mode IN ('draft_only', 'approval_required', 'guarded_autopilot')),
  provider TEXT,
  model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost REAL NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE TABLE IF NOT EXISTS ai_run_outputs (
  id TEXT PRIMARY KEY,
  ai_run_id TEXT NOT NULL,
  output_type TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (ai_run_id) REFERENCES ai_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_runs_org_created ON ai_runs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_runs_lead_created ON ai_runs(lead_id, created_at DESC);
