const crypto = require('crypto');
const { refreshAccessToken } = require('./gmail-oauth');

function encodeMessage({ toEmail, subject, body }) {
  const raw = [
    `To: ${toEmail}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    body,
  ].join('\r\n');

  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function sendViaStub({ toEmail, subject, body }) {
  return {
    ok: true,
    providerMessageId: `stub_${crypto.randomUUID()}`,
    acceptedAt: new Date().toISOString(),
    preview: { toEmail, subject, body },
  };
}

async function sendViaGmail({ providerSettings, toEmail, subject, body, saveProviderSettings }) {
  if (!providerSettings?.client_id || !providerSettings?.client_secret || !providerSettings?.refresh_token) {
    throw new Error('Gmail provider is not fully configured');
  }

  let accessToken = providerSettings.access_token || null;
  let expiresAt = providerSettings.token_expires_at ? new Date(providerSettings.token_expires_at).getTime() : 0;

  if (!accessToken || !expiresAt || expiresAt <= Date.now() + 60_000) {
    const refreshed = await refreshAccessToken({
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

  const payload = { raw: encodeMessage({ toEmail, subject, body }) };
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Gmail send failed');

  return {
    ok: true,
    providerMessageId: json.id || `gmail_${crypto.randomUUID()}`,
    acceptedAt: new Date().toISOString(),
  };
}

const PROVIDERS = {
  stub: {
    key: 'stub',
    label: 'Stub Provider',
    needsAuth: false,
    send: sendViaStub,
  },
  gmail: {
    key: 'gmail',
    label: 'Gmail',
    needsAuth: true,
    send: sendViaGmail,
  },
};

function getProvider(key = 'stub') {
  return PROVIDERS[key] || PROVIDERS.stub;
}

module.exports = {
  getProvider,
  PROVIDERS,
};
