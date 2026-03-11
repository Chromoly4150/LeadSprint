ALTER TABLE leads ADD COLUMN assigned_user_id TEXT;
ALTER TABLE leads ADD COLUMN owner_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_assigned_user ON leads(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_owner_user ON leads(owner_user_id);
