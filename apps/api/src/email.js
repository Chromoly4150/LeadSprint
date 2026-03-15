const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { refreshAccessToken, ensureValidGmailAccessToken } = require('./gmail-oauth');
const { refreshMicrosoftAccessToken } = require('./microsoft-oauth');

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



async function verifyGmailProvider({ providerSettings, saveProviderSettings }) {
  if (!providerSettings?.client_id || !providerSettings?.client_secret || !providerSettings?.refresh_token) {
    throw new Error('Gmail provider is not fully configured');
  }
  const accessToken = await ensureValidGmailAccessToken({ providerSettings, saveProviderSettings });
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Gmail verification failed');
  return { ok: true, account: json.emailAddress || null };
}

async function verifyMicrosoftProvider({ providerSettings, saveProviderSettings }) {
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
  const profile = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await profile.json();
  if (!profile.ok) throw new Error(json.error?.message || 'Microsoft verification failed');
  return { ok: true, account: json.mail || json.userPrincipalName || null };
}

async function verifyImapSmtpProvider({ providerSettings, emailAccount }) {
  const providerConfig = providerSettings?.config_json ? JSON.parse(providerSettings.config_json) : {};
  const accountConfig = emailAccount?.config_json ? JSON.parse(emailAccount.config_json) : {};
  const config = { ...providerConfig, ...accountConfig };
  if (!config.smtpHost || !config.smtpPort || !config.smtpUsername) {
    throw new Error('IMAP/SMTP account is not fully configured (smtpHost, smtpPort, smtpUsername required)');
  }
  const secure = typeof config.smtpSecure === 'boolean' ? config.smtpSecure : Number(config.smtpPort) === 465;
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: Number(config.smtpPort),
    secure,
    auth: config.smtpPassword ? { user: config.smtpUsername, pass: config.smtpPassword } : undefined,
  });
  await transporter.verify();
  return { ok: true, account: emailAccount?.email_address || config.smtpUsername || null };
}

async function sendViaMicrosoft({ providerSettings, toEmail, subject, body, saveProviderSettings }) {
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

  const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'Text', content: body },
        toRecipients: [{ emailAddress: { address: toEmail } }],
      },
      saveToSentItems: true,
    }),
  });

  if (!res.ok) {
    let message = 'Microsoft send failed';
    try {
      const json = await res.json();
      message = json.error?.message || message;
    } catch {}
    throw new Error(message);
  }

  return {
    ok: true,
    providerMessageId: `ms_${crypto.randomUUID()}`,
    acceptedAt: new Date().toISOString(),
  };
}

async function sendViaImapSmtpPlaceholder({ providerSettings, emailAccount, toEmail, subject, body }) {
  const providerConfig = providerSettings?.config_json ? JSON.parse(providerSettings.config_json) : {};
  const accountConfig = emailAccount?.config_json ? JSON.parse(emailAccount.config_json) : {};
  const config = { ...providerConfig, ...accountConfig };

  if (!config.smtpHost || !config.smtpPort || !config.smtpUsername) {
    throw new Error('IMAP/SMTP account is not fully configured (smtpHost, smtpPort, smtpUsername required)');
  }

  const secure = typeof config.smtpSecure === 'boolean'
    ? config.smtpSecure
    : Number(config.smtpPort) === 465;

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: Number(config.smtpPort),
    secure,
    auth: config.smtpPassword
      ? { user: config.smtpUsername, pass: config.smtpPassword }
      : undefined,
  });

  await transporter.verify();

  const info = await transporter.sendMail({
    from: emailAccount?.display_name
      ? `${emailAccount.display_name} <${emailAccount.email_address}>`
      : (emailAccount?.email_address || config.smtpUsername),
    to: toEmail,
    subject,
    text: body,
    replyTo: emailAccount?.email_address || config.smtpUsername,
  });

  return {
    ok: true,
    providerMessageId: info.messageId || `smtp_${crypto.randomUUID()}`,
    acceptedAt: new Date().toISOString(),
  };
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

  const accessToken = await ensureValidGmailAccessToken({ providerSettings, saveProviderSettings });

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
    verify: async () => ({ ok: true, account: 'stub' }),
  },
  gmail: {
    key: 'gmail',
    label: 'Gmail',
    needsAuth: true,
    send: sendViaGmail,
    verify: verifyGmailProvider,
  },
  microsoft: {
    key: 'microsoft',
    label: 'Microsoft 365',
    needsAuth: true,
    send: sendViaMicrosoft,
    verify: verifyMicrosoftProvider,
  },
  imap_smtp: {
    key: 'imap_smtp',
    label: 'IMAP/SMTP',
    needsAuth: true,
    send: sendViaImapSmtpPlaceholder,
    verify: verifyImapSmtpProvider,
  },
};

function getProvider(key = 'stub') {
  return PROVIDERS[key] || PROVIDERS.stub;
}

module.exports = {
  getProvider,
  PROVIDERS,
};
