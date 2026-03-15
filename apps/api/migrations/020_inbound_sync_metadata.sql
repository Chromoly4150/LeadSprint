ALTER TABLE communications ADD COLUMN provider_key TEXT;
ALTER TABLE communications ADD COLUMN provider_thread_id TEXT;
ALTER TABLE communications ADD COLUMN provider_message_id TEXT;
ALTER TABLE communications ADD COLUMN external_participants_json TEXT;

CREATE INDEX IF NOT EXISTS idx_communications_provider_thread ON communications(provider_key, provider_thread_id);
CREATE INDEX IF NOT EXISTS idx_communications_provider_message ON communications(provider_key, provider_message_id);
