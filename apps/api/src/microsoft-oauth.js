const crypto = require('crypto');

const MICROSOFT_SCOPES = [
  'offline_access',
  'openid',
  'email',
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/Mail.Read',
].join(' ');

function buildMicrosoftAuthUrl({ clientId, redirectUri, state }) {
  const url = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', MICROSOFT_SCOPES);
  url.searchParams.set('state', state || `ms_${crypto.randomUUID()}`);
  return url.toString();
}

async function exchangeMicrosoftCodeForTokens({ clientId, clientSecret, redirectUri, code }) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
    grant_type: 'authorization_code',
  });

  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.error || 'Microsoft token exchange failed');
  return json;
}

async function refreshMicrosoftAccessToken({ clientId, clientSecret, refreshToken }) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: MICROSOFT_SCOPES,
  });

  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.error || 'Microsoft token refresh failed');
  return json;
}


async function ensureValidMicrosoftAccessToken({ providerSettings, saveProviderSettings }) {
  if (!providerSettings?.client_id || !providerSettings?.client_secret || !providerSettings?.refresh_token) {
    throw new Error('Microsoft provider is not fully configured');
  }

  let accessToken = providerSettings.access_token || null;
  let expiresAt = providerSettings.token_expires_at ? new Date(providerSettings.token_expires_at).getTime() : 0;

  if (!accessToken || !expiresAt || expiresAt <= Date.now() + 60_000) {
    const refreshed = await refreshMicrosoftAccessToken({
      clientId: providerSettings.client_id,
      clientSecret: providerSettings.client_secret,
      refreshToken: providerSettings.refresh_token,
    });
    accessToken = refreshed.access_token;
    expiresAt = Date.now() + Number(refreshed.expires_in || 3600) * 1000;
    await saveProviderSettings({
      ...providerSettings,
      access_token: accessToken,
      token_expires_at: new Date(expiresAt).toISOString(),
      status: 'connected',
    });
  }

  return accessToken;
}

async function fetchMicrosoftProfile(accessToken) {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch Microsoft profile');
  return json;
}

module.exports = {
  MICROSOFT_SCOPES,
  buildMicrosoftAuthUrl,
  exchangeMicrosoftCodeForTokens,
  refreshMicrosoftAccessToken,
  fetchMicrosoftProfile,
  ensureValidMicrosoftAccessToken,
};
