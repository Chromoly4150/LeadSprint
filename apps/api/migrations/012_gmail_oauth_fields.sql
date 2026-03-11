ALTER TABLE email_provider_settings ADD COLUMN client_id TEXT;
ALTER TABLE email_provider_settings ADD COLUMN client_secret TEXT;
ALTER TABLE email_provider_settings ADD COLUMN redirect_uri TEXT;
ALTER TABLE email_provider_settings ADD COLUMN access_token TEXT;
ALTER TABLE email_provider_settings ADD COLUMN refresh_token TEXT;
ALTER TABLE email_provider_settings ADD COLUMN token_expires_at TEXT;
