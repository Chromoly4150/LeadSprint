const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ensureDb, runMigrations, nowIso } = require('./db');
const { getProvider, PROVIDERS } = require('./email');
const { buildAuthUrl, exchangeCodeForTokens, fetchGoogleProfile, ensureValidGmailAccessToken } = require('./gmail-oauth');
const { buildMicrosoftAuthUrl, exchangeMicrosoftCodeForTokens, fetchMicrosoftProfile, ensureValidMicrosoftAccessToken } = require('./microsoft-oauth');
const { runDraftOnlyLeadResponse } = require('./ai');
const { createProviderDispatcher } = require('../../../packages/email-sync/providerDispatcher');
const { createRunAccountSyncRuntime } = require('../../../packages/email-sync/runAccountSync');
const { createSyncRunner } = require('../../../packages/email-sync/syncRunner');

runMigrations();
const db = ensureDb();

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-user-email,x-clerk-user-id,x-internal-auth-ts,x-internal-auth-signature');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

const DEFAULT_ORG_ID = process.env.DEFAULT_ORG_ID || 'org_default';
const DEFAULT_ORG_NAME = process.env.DEFAULT_ORG_NAME || 'Default Organization';
const FIRST_RESPONSE_TEMPLATE_KEY = 'first_response';
const BUSINESS_SETTINGS_KEY = 'business_profile';
const USER_ROLES = new Set(['platform_owner', 'platform_admin', 'platform_sme', 'platform_agent', 'platform_support', 'platform_operator', 'company_owner', 'company_admin', 'company_agent']);
const PLATFORM_ROLES = new Set(['platform_owner', 'platform_admin', 'platform_sme', 'platform_agent', 'platform_support', 'platform_operator']);
const COMPANY_ROLES = new Set(['company_owner', 'company_admin', 'company_agent']);
const USER_STATUSES = new Set(['active', 'deactivated', 'suspended']);
const LEAD_STATUSES = new Set(['new', 'contacted', 'booked', 'closed']);
const URGENCY_STATUSES = new Set(['hot', 'warm', 'cold', 'needs_attention', 'sla_risk']);
const KNOWN_PERMISSIONS = new Set([
  'platform.accessRequests.review',
  'platform.users.manage',
  'team.manageUsers',
  'settings.manageBusiness',
  'settings.manageTemplates',
  'leads.view',
  'leads.edit',
  'leads.updateStatus',
  'notes.viewInternal',
  'notes.createInternal',
  'reports.view',
  'communications.view',
  'communications.create',
  'emailDrafts.manage',
  'emailOutbox.manage',
]);
const ROLE_DEFAULT_PERMISSIONS = {
  platform_owner: {
    'platform.accessRequests.review': true,
    'platform.users.manage': true,
    'team.manageUsers': true,
    'settings.manageBusiness': true,
    'settings.manageTemplates': true,
    'leads.view': true,
    'leads.edit': true,
    'leads.updateStatus': true,
    'notes.viewInternal': true,
    'notes.createInternal': true,
    'reports.view': true,
    'communications.view': true,
    'communications.create': true,
    'emailDrafts.manage': true,
    'emailOutbox.manage': true,
  },
  platform_admin: {
    'platform.accessRequests.review': true,
    'platform.users.manage': true,
    'team.manageUsers': true,
    'settings.manageBusiness': true,
    'settings.manageTemplates': true,
    'leads.view': true,
    'leads.edit': true,
    'leads.updateStatus': true,
    'notes.viewInternal': true,
    'notes.createInternal': true,
    'reports.view': true,
    'communications.view': true,
    'communications.create': true,
    'emailDrafts.manage': true,
    'emailOutbox.manage': true,
  },
  platform_sme: {
    'platform.accessRequests.review': true,
    'platform.users.manage': false,
    'team.manageUsers': false,
    'settings.manageBusiness': true,
    'settings.manageTemplates': true,
    'leads.view': true,
    'leads.edit': true,
    'leads.updateStatus': true,
    'notes.viewInternal': true,
    'notes.createInternal': true,
    'reports.view': true,
    'communications.view': true,
    'communications.create': true,
    'emailDrafts.manage': true,
    'emailOutbox.manage': true,
  },
  platform_agent: {
    'platform.accessRequests.review': false,
    'platform.users.manage': false,
    'team.manageUsers': false,
    'settings.manageBusiness': false,
    'settings.manageTemplates': false,
    'leads.view': true,
    'leads.edit': true,
    'leads.updateStatus': true,
    'notes.viewInternal': true,
    'notes.createInternal': true,
    'reports.view': true,
    'communications.view': true,
    'communications.create': true,
    'emailDrafts.manage': true,
    'emailOutbox.manage': true,
  },
  company_owner: {
    'platform.accessRequests.review': false,
    'platform.users.manage': false,
    'team.manageUsers': true,
    'settings.manageBusiness': true,
    'settings.manageTemplates': true,
    'leads.view': true,
    'leads.edit': true,
    'leads.updateStatus': true,
    'notes.viewInternal': true,
    'notes.createInternal': true,
    'reports.view': true,
    'communications.view': true,
    'communications.create': true,
    'emailDrafts.manage': true,
    'emailOutbox.manage': true,
  },
  company_admin: {
    'platform.accessRequests.review': false,
    'platform.users.manage': false,
    'team.manageUsers': true,
    'settings.manageBusiness': true,
    'settings.manageTemplates': true,
    'leads.view': true,
    'leads.edit': true,
    'leads.updateStatus': true,
    'notes.viewInternal': true,
    'notes.createInternal': true,
    'reports.view': true,
    'communications.view': true,
    'communications.create': true,
    'emailDrafts.manage': true,
    'emailOutbox.manage': true,
  },
  company_agent: {
    'platform.accessRequests.review': false,
    'platform.users.manage': false,
    'team.manageUsers': false,
    'settings.manageBusiness': false,
    'settings.manageTemplates': false,
    'leads.view': true,
    'leads.edit': true,
    'leads.updateStatus': true,
    'notes.viewInternal': true,
    'notes.createInternal': true,
    'reports.view': true,
    'communications.view': true,
    'communications.create': true,
    'emailDrafts.manage': true,
    'emailOutbox.manage': true,
  },
};

db.prepare(`INSERT OR IGNORE INTO organizations (id, name, timezone, slug) VALUES (?, ?, ?, ?)`).run(
  DEFAULT_ORG_ID,
  DEFAULT_ORG_NAME,
  'America/New_York',
  'default-organization'
);

db.prepare(`UPDATE organizations SET slug = COALESCE(NULLIF(slug, ''), ?) WHERE id = ?`).run('default-organization', DEFAULT_ORG_ID);

const defaultTemplateBody =
  'Hey {{name}} — thanks for reaching out to {{business_name}}. We got your request and can help. You can book here: {{booking_link}}';

const existingTemplate = db
  .prepare('SELECT id FROM templates WHERE organization_id = ? AND key = ?')
  .get(DEFAULT_ORG_ID, FIRST_RESPONSE_TEMPLATE_KEY);
if (!existingTemplate) {
  const templateId = `tpl_${crypto.randomUUID()}`;
  const versionId = `tplv_${crypto.randomUUID()}`;
  const ts = nowIso();

  db.prepare(
    `INSERT INTO templates (id, organization_id, key, name, body, is_enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(
    templateId,
    DEFAULT_ORG_ID,
    FIRST_RESPONSE_TEMPLATE_KEY,
    'First Response',
    defaultTemplateBody,
    ts,
    ts
  );

  db.prepare(
    `INSERT INTO template_versions (id, template_id, body, changed_at)
     VALUES (?, ?, ?, ?)`
  ).run(versionId, templateId, defaultTemplateBody, ts);
}

const defaultBusinessSettings = {
  businessName: DEFAULT_ORG_NAME,
  timezone: 'America/New_York',
  hours: {
    mon: '09:00-17:00',
    tue: '09:00-17:00',
    wed: '09:00-17:00',
    thu: '09:00-17:00',
    fri: '09:00-17:00',
    sat: 'closed',
    sun: 'closed',
  },
  bookingLink: 'https://calendly.com/your-link',
};

const existingSettings = db
  .prepare('SELECT id FROM settings WHERE organization_id = ? AND key = ?')
  .get(DEFAULT_ORG_ID, BUSINESS_SETTINGS_KEY);

if (!existingSettings) {
  const settingsId = `set_${crypto.randomUUID()}`;
  const ts = nowIso();
  db.prepare(
    `INSERT INTO settings (id, organization_id, key, value_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(settingsId, DEFAULT_ORG_ID, BUSINESS_SETTINGS_KEY, JSON.stringify(defaultBusinessSettings), ts, ts);
}

const existingAiSettings = db.prepare('SELECT id FROM organization_ai_settings WHERE organization_id = ?').get(DEFAULT_ORG_ID);
if (!existingAiSettings) {
  const ts = nowIso();
  db.prepare(`INSERT INTO organization_ai_settings (id, organization_id, ai_enabled, default_mode, allowed_channels_json, allowed_actions_json, response_sla_target_minutes, tone_profile_json, business_context_json, compliance_policy_json, usage_plan, monthly_message_limit, monthly_ai_token_budget, model_policy_json, created_at, updated_at) VALUES (?, ?, 0, 'draft_only', ?, ?, 5, ?, ?, ?, 'standard', 250, 250000, ?, ?, ?)`).run(
    `aiset_${crypto.randomUUID()}`,
    DEFAULT_ORG_ID,
    JSON.stringify(['email', 'sms']),
    JSON.stringify(['draft_message']),
    JSON.stringify({ defaultTone: 'professional and warm' }),
    JSON.stringify({ businessName: DEFAULT_ORG_NAME, bookingLink: defaultBusinessSettings.bookingLink }),
    JSON.stringify({ requireHumanApprovalForOutbound: true }),
    JSON.stringify({ primaryProvider: 'stub', allowedModels: ['stub/draft-v1'] }),
    ts,
    ts,
  );
}

const defaultOwnerEmail = normalizeString(process.env.DEFAULT_OWNER_EMAIL || 'owner@leadsprint.local').toLowerCase();
const defaultOwnerName = normalizeString(process.env.DEFAULT_OWNER_NAME || 'Organization Owner');
const platformOwnerEmail = normalizeString(process.env.PLATFORM_OWNER_EMAIL || 'josiahricheson@gmail.com').toLowerCase();
const platformOwnerName = normalizeString(process.env.PLATFORM_OWNER_NAME || 'Josiah Richeson');
const INTERNAL_API_AUTH_SECRET = normalizeString(process.env.INTERNAL_API_AUTH_SECRET);
const GMAIL_JSON_PATH = path.join(__dirname, '..', '..', 'client_secret_852799874294-rtj7qmccrb77pi9lqn7ep9lfuf2d8pm6.apps.googleusercontent.com.json');
const GMAIL_FALLBACK = {
  clientId: process.env.GMAIL_CLIENT_ID || '',
  clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
  redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://127.0.0.1:4000/api/auth/gmail/callback',
};

const existingCompanyOwner = db
  .prepare(`SELECT id FROM users WHERE organization_id = ? AND role IN ('owner', 'company_owner') LIMIT 1`)
  .get(DEFAULT_ORG_ID);

if (!existingCompanyOwner) {
  const ts = nowIso();
  db.prepare(
    `INSERT INTO users (id, organization_id, full_name, email, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'company_owner', 'active', ?, ?)`
  ).run(`usr_${crypto.randomUUID()}`, DEFAULT_ORG_ID, defaultOwnerName, defaultOwnerEmail, ts, ts);
} else {
  db.prepare(`UPDATE users SET role = 'company_owner', updated_at = ? WHERE organization_id = ? AND role = 'owner'`).run(nowIso(), DEFAULT_ORG_ID);
}

const existingPlatformOwner = db
  .prepare(`SELECT id FROM users WHERE lower(email) = ? LIMIT 1`)
  .get(platformOwnerEmail);

if (!existingPlatformOwner) {
  const ts = nowIso();
  db.prepare(
    `INSERT INTO users (id, organization_id, full_name, email, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'platform_owner', 'active', ?, ?)`
  ).run(`usr_${crypto.randomUUID()}`, DEFAULT_ORG_ID, platformOwnerName, platformOwnerEmail, ts, ts);
}

function normalizeString(v) {
  if (typeof v !== 'string') return '';
  return v.trim();
}

function normalizePhoneDigits(value) {
  return normalizeString(value).replace(/\D/g, '');
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}


function slugifyWorkspaceName(value, fallback = 'workspace') {
  const slug = normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug || fallback;
}

function ensureUniqueWorkspaceSlug(baseSlug, excludeOrgId = null) {
  const seed = slugifyWorkspaceName(baseSlug);
  let attempt = seed;
  let index = 2;
  while (true) {
    const existing = excludeOrgId
      ? db.prepare(`SELECT id FROM organizations WHERE slug = ? AND id != ? LIMIT 1`).get(attempt, excludeOrgId)
      : db.prepare(`SELECT id FROM organizations WHERE slug = ? LIMIT 1`).get(attempt);
    if (!existing) return attempt;
    attempt = `${seed}-${index}`;
    index += 1;
  }
}

function serializeWorkspaceRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug || ensureUniqueWorkspaceSlug(row.name || row.id, row.id),
    workspaceType: row.workspace_type || 'business_verified',
    timezone: row.timezone || 'America/New_York',
  };
}

function getSurfaceForRole(role) {
  return PLATFORM_ROLES.has(role) ? 'control' : 'workspace';
}


function extractEmailParticipants(headers = []) {
  const pairs = [];
  for (const header of headers) {
    const name = String(header.name || '').toLowerCase();
    if (!['from', 'to', 'cc', 'bcc', 'reply-to'].includes(name)) continue;
    pairs.push({ name, value: header.value || '' });
  }
  return pairs;
}

function extractEmails(values = []) {
  return values
    .flatMap((value) => String(value || '').split(/[;,]/))
    .map((part) => {
      const match = part.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      return match ? match[0].toLowerCase() : null;
    })
    .filter(Boolean);
}

function findLeadByEmail(orgId, emails = []) {
  const normalized = extractEmails(emails);
  for (const email of normalized) {
    const lead = db.prepare(`SELECT * FROM leads WHERE organization_id = ? AND lower(email) = ? LIMIT 1`).get(orgId, email);
    if (lead) return lead;
  }
  return null;
}

function filterExternalEmails(emails = [], accountEmail = null) {
  const own = String(accountEmail || '').toLowerCase();
  return extractEmails(emails).filter((email) => email && email !== own);
}

function cleanMessageSnippet(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/ /g, ' ')
    .trim()
    .slice(0, 280);
}

async function syncGmailInboundForAccount({ orgId, account, actorName = 'System' }) {
  const providerSettings = getProviderSettings(orgId, 'gmail');
  if (!providerSettings) throw new Error('Gmail provider settings are missing');
  const accessToken = await ensureValidGmailAccessToken({
    providerSettings,
    saveProviderSettings: (patch) => saveProviderSettingsRow(orgId, 'gmail', patch),
  });
  const syncState = getEmailSyncState(account.id);
  const query = syncState?.last_synced_at ? `after:${Math.floor(new Date(syncState.last_synced_at).getTime() / 1000)}` : 'newer_than:14d';
  upsertEmailSyncState({ organizationId: orgId, emailAccountId: account.id, providerKey: 'gmail', syncMode: syncState?.sync_mode || 'manual', lastCursor: syncState?.last_cursor || null, lastSyncedAt: syncState?.last_synced_at || null, lastStatus: 'running', lastError: null });
  const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const listJson = await listRes.json();
  if (!listRes.ok) throw new Error(listJson.error?.message || 'Failed to list Gmail messages');
  const messages = Array.isArray(listJson.messages) ? listJson.messages : [];
  const imported = [];
  const skipped = [];

  for (const messageRef of messages) {
    const existing = db.prepare(`SELECT id FROM communications WHERE organization_id = ? AND provider_key = 'gmail' AND provider_message_id = ? LIMIT 1`).get(orgId, messageRef.id);
    if (existing) { skipped.push({ messageId: messageRef.id, reason: 'already_imported' }); continue; }

    const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageRef.id}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const msgJson = await msgRes.json();
    if (!msgRes.ok) { skipped.push({ messageId: messageRef.id, reason: msgJson.error?.message || 'fetch_failed' }); continue; }

    const headers = msgJson.payload?.headers || [];
    const bodyData = msgJson.payload?.body?.data || msgJson.payload?.parts?.find((part) => part.mimeType === 'text/plain')?.body?.data || null;
    const subject = headers.find((h) => String(h.name).toLowerCase() === 'subject')?.value || '(no subject)';
    const fromValue = headers.find((h) => String(h.name).toLowerCase() === 'from')?.value || '';
    const toValue = headers.find((h) => String(h.name).toLowerCase() === 'to')?.value || '';
    const ccValue = headers.find((h) => String(h.name).toLowerCase() === 'cc')?.value || '';
    const lead = findLeadByEmail(orgId, [fromValue, toValue, ccValue]);
    if (!lead) { skipped.push({ messageId: messageRef.id, reason: 'no_matching_lead' }); continue; }

    const actorType = filterExternalEmails([fromValue], account.email_address).length === 0 ? 'user' : 'lead';
    const actorLabel = actorType === 'user' ? (account.display_name || account.email_address || actorName) : (fromValue || 'Lead');
    const decodedBody = bodyData ? Buffer.from(String(bodyData).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8') : '';
    const content = cleanMessageSnippet(decodedBody || msgJson.snippet || subject);
    const occurredAt = msgJson.internalDate ? new Date(Number(msgJson.internalDate)).toISOString() : nowIso();
    const threadExisting = db.prepare(`SELECT id FROM communications WHERE organization_id = ? AND lead_id = ? AND provider_key = 'gmail' AND provider_thread_id = ? AND subject = ? LIMIT 1`).get(orgId, lead.id, msgJson.threadId || '', subject);
    if (threadExisting) { skipped.push({ messageId: msgJson.id, reason: 'thread_duplicate' }); continue; }

    const communicationId = `com_${crypto.randomUUID()}`;
    const eventId = `evt_${crypto.randomUUID()}`;
    db.prepare(`INSERT INTO communications (id, organization_id, lead_id, channel, direction, actor_type, actor_name, subject, summary, content, occurred_at, created_at, updated_at, provider_key, provider_thread_id, provider_message_id, external_participants_json) VALUES (?, ?, ?, 'email', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'gmail', ?, ?, ?)`).run(
      communicationId,
      orgId,
      lead.id,
      actorType === 'user' ? 'outbound' : 'inbound',
      actorType,
      actorLabel,
      subject,
      subject,
      content,
      occurredAt,
      occurredAt,
      occurredAt,
      msgJson.threadId || null,
      msgJson.id,
      JSON.stringify(extractEmailParticipants(headers)),
    );
    db.prepare(`INSERT INTO events (id, organization_id, lead_id, event_type, payload_json, created_at) VALUES (?, ?, ?, 'lead.email_synced', ?, ?)`).run(eventId, orgId, lead.id, JSON.stringify({ provider: 'gmail', providerMessageId: msgJson.id, providerThreadId: msgJson.threadId || null, accountId: account.id }), occurredAt);
    imported.push({ leadId: lead.id, messageId: msgJson.id, threadId: msgJson.threadId || null, subject });
  }

  const syncedAt = nowIso();
  updateEmailAccount(account.id, orgId, { lastSyncAt: syncedAt, lastError: null, status: 'connected' });
  upsertEmailSyncState({ organizationId: orgId, emailAccountId: account.id, providerKey: 'gmail', syncMode: syncState?.sync_mode || 'manual', lastCursor: messages[0]?.id || syncState?.last_cursor || null, lastSyncedAt: syncedAt, lastStatus: 'ok', lastError: null });
  return { imported, skipped, checked: messages.length, syncedAt };
}

async function syncMicrosoftInboundForAccount({ orgId, account, actorName = 'System' }) {
  const providerSettings = getProviderSettings(orgId, 'microsoft');
  if (!providerSettings) throw new Error('Microsoft provider settings are missing');
  const accessToken = await ensureValidMicrosoftAccessToken({
    providerSettings,
    saveProviderSettings: (patch) => saveProviderSettingsRow(orgId, 'microsoft', patch),
  });

  const syncState = getEmailSyncState(account.id);
  upsertEmailSyncState({ organizationId: orgId, emailAccountId: account.id, providerKey: 'microsoft', syncMode: syncState?.sync_mode || 'manual', lastCursor: syncState?.last_cursor || null, lastSyncedAt: syncState?.last_synced_at || null, lastStatus: 'running', lastError: null });
  const listRes = await fetch("https://graph.microsoft.com/v1.0/me/messages?$top=10&$select=id,conversationId,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const listJson = await listRes.json();
  if (!listRes.ok) throw new Error(listJson.error?.message || 'Failed to list Microsoft messages');
  const messages = Array.isArray(listJson.value) ? listJson.value : [];
  const imported = [];
  const skipped = [];

  for (const msg of messages) {
    const existing = db.prepare(`SELECT id FROM communications WHERE organization_id = ? AND provider_key = 'microsoft' AND provider_message_id = ? LIMIT 1`).get(orgId, msg.id);
    if (existing) { skipped.push({ messageId: msg.id, reason: 'already_imported' }); continue; }

    const fromValue = msg.from?.emailAddress?.address || '';
    const toValue = Array.isArray(msg.toRecipients) ? msg.toRecipients.map((r) => r.emailAddress?.address).filter(Boolean).join(', ') : '';
    const ccValue = Array.isArray(msg.ccRecipients) ? msg.ccRecipients.map((r) => r.emailAddress?.address).filter(Boolean).join(', ') : '';
    const lead = findLeadByEmail(orgId, [fromValue, toValue, ccValue]);
    if (!lead) { skipped.push({ messageId: msg.id, reason: 'no_matching_lead' }); continue; }

    const actorType = filterExternalEmails([fromValue], account.email_address).length === 0 ? 'user' : 'lead';
    const actorLabel = actorType === 'user' ? (account.display_name || account.email_address || actorName) : (fromValue || 'Lead');
    const occurredAt = msg.receivedDateTime || nowIso();
    const participants = [
      { name: 'from', value: fromValue },
      { name: 'to', value: toValue },
      { name: 'cc', value: ccValue },
    ].filter((item) => item.value);

    const communicationId = `com_${crypto.randomUUID()}`;
    const eventId = `evt_${crypto.randomUUID()}`;
    db.prepare(`INSERT INTO communications (id, organization_id, lead_id, channel, direction, actor_type, actor_name, subject, summary, content, occurred_at, created_at, updated_at, provider_key, provider_thread_id, provider_message_id, external_participants_json) VALUES (?, ?, ?, 'email', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'microsoft', ?, ?, ?)`).run(
      communicationId, orgId, lead.id, actorType === 'user' ? 'outbound' : 'inbound', actorType, actorLabel, msg.subject || '(no subject)', msg.subject || '(no subject)', cleanMessageSnippet(msg.bodyPreview || msg.subject || '(no preview)'), occurredAt, occurredAt, occurredAt, msg.conversationId || null, msg.id, JSON.stringify(participants)
    );
    db.prepare(`INSERT INTO events (id, organization_id, lead_id, event_type, payload_json, created_at) VALUES (?, ?, ?, 'lead.email_synced', ?, ?)`).run(eventId, orgId, lead.id, JSON.stringify({ provider: 'microsoft', providerMessageId: msg.id, providerThreadId: msg.conversationId || null, accountId: account.id }), occurredAt);
    imported.push({ leadId: lead.id, messageId: msg.id, threadId: msg.conversationId || null, subject: msg.subject || '(no subject)' });
  }

  const syncedAt = nowIso();
  updateEmailAccount(account.id, orgId, { lastSyncAt: syncedAt, lastError: null, status: 'connected' });
  upsertEmailSyncState({ organizationId: orgId, emailAccountId: account.id, providerKey: 'gmail', syncMode: syncState?.sync_mode || 'manual', lastCursor: messages[0]?.id || syncState?.last_cursor || null, lastSyncedAt: syncedAt, lastStatus: 'ok', lastError: null });
  return { imported, skipped, checked: messages.length, syncedAt };
}

function getAiSettingsForOrg(orgId) {
  const row = db.prepare(`SELECT * FROM organization_ai_settings WHERE organization_id = ? LIMIT 1`).get(orgId);
  if (!row) return null;
  return {
    ...row,
    allowed_channels: safeJsonParse(row.allowed_channels_json, []),
    allowed_actions: safeJsonParse(row.allowed_actions_json, []),
    tone_profile: safeJsonParse(row.tone_profile_json, {}),
    business_context: safeJsonParse(row.business_context_json, {}),
    compliance_policy: safeJsonParse(row.compliance_policy_json, {}),
    model_policy: safeJsonParse(row.model_policy_json, {}),
  };
}

async function generateLeadDraftForLead({ orgId, leadId, triggerType = 'manual', triggerId = null }) {
  const lead = db.prepare(`SELECT * FROM leads WHERE organization_id = ? AND id = ? LIMIT 1`).get(orgId, leadId);
  if (!lead) throw new Error('Lead not found');
  const org = db.prepare(`SELECT * FROM organizations WHERE id = ? LIMIT 1`).get(orgId);
  const settings = getAiSettingsForOrg(orgId);
  if (!settings) throw new Error('AI settings not found');
  if (!settings.ai_enabled) throw new Error('AI is disabled for this organization');
  if (!settings.allowed_actions.includes('draft_message')) throw new Error('Draft generation is not allowed for this organization');

  const runId = `air_${crypto.randomUUID()}`;
  const outputId = `airo_${crypto.randomUUID()}`;
  const ts = nowIso();
  db.prepare(`INSERT INTO ai_runs (id, organization_id, workflow_type, trigger_type, trigger_id, lead_id, status, mode, started_at, created_at, updated_at) VALUES (?, ?, 'lead_reply_draft', ?, ?, ?, 'pending', ?, ?, ?, ?)`).run(runId, orgId, triggerType, triggerId || leadId, lead.id, settings.default_mode, ts, ts, ts);

  try {
    const result = await runDraftOnlyLeadResponse({ org, lead, settings });
    const draftId = `edr_${crypto.randomUUID()}`;
    const completedAt = nowIso();
    db.prepare(`UPDATE ai_runs SET status = 'completed', provider = ?, model = ?, input_tokens = ?, output_tokens = ?, estimated_cost = ?, completed_at = ?, updated_at = ? WHERE id = ?`).run(result.provider, result.model, result.inputTokens, result.outputTokens, result.estimatedCost, completedAt, completedAt, runId);
    db.prepare(`INSERT INTO ai_run_outputs (id, ai_run_id, output_type, content_json, created_at) VALUES (?, ?, 'draft_message', ?, ?)`).run(outputId, runId, JSON.stringify(result.output), completedAt);
    db.prepare(`INSERT INTO email_drafts (id, organization_id, lead_id, to_email, subject, body, status, source, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, NULL, ?, ?)`).run(draftId, orgId, lead.id, lead.email || 'unknown@example.com', result.output.subject, result.output.draft, triggerType === 'auto' ? 'ai_auto' : 'ai_generated', completedAt, completedAt);
    return { runId, draftId, draft: result.output, triggerType };
  } catch (error) {
    const failedAt = nowIso();
    db.prepare(`UPDATE ai_runs SET status = 'failed', error_code = ?, error_message = ?, completed_at = ?, updated_at = ? WHERE id = ?`).run('draft_failed', error?.message || 'AI draft failed', failedAt, failedAt, runId);
    throw error;
  }
}

function validateLead(payload) {
  const fullName = normalizeString(payload?.fullName || payload?.name);
  const email = normalizeString(payload?.email).toLowerCase();
  const phone = normalizeString(payload?.phone);
  const source = normalizeString(payload?.source) || 'webhook';
  const message = normalizeString(payload?.message);
  const urgencyStatus = normalizeString(payload?.urgencyStatus || 'warm').toLowerCase();

  const errors = [];

  if (!fullName) errors.push('fullName is required');
  if (!email && !phone) errors.push('At least one contact field is required: email or phone');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email format is invalid');
  if (!URGENCY_STATUSES.has(urgencyStatus)) errors.push('urgencyStatus is invalid');

  return {
    ok: errors.length === 0,
    errors,
    data: {
      fullName,
      email: email || null,
      phone: phone || null,
      source,
      message: message || null,
      urgencyStatus,
    },
  };
}

function findLeadDuplicates({ fullName, email, phone }) {
  const rows = db.prepare(`SELECT id, full_name, email, phone, source, status, urgency_status, received_at FROM leads WHERE organization_id = ? ORDER BY received_at DESC`).all(DEFAULT_ORG_ID);
  const nameKey = normalizeString(fullName).toLowerCase();
  const emailKey = normalizeString(email).toLowerCase();
  const phoneKey = normalizePhoneDigits(phone);

  const matches = rows.flatMap((row) => {
    const matchedOn = [];
    if (emailKey && normalizeString(row.email).toLowerCase() === emailKey) matchedOn.push('email');
    if (phoneKey && normalizePhoneDigits(row.phone) === phoneKey) matchedOn.push('phone');
    if (nameKey && normalizeString(row.full_name).toLowerCase() === nameKey && ((emailKey && normalizeString(row.email).toLowerCase() === emailKey) || (phoneKey && normalizePhoneDigits(row.phone) === phoneKey))) matchedOn.push('name_plus_contact');
    if (!matchedOn.length) return [];
    return [{
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      source: row.source,
      status: row.status,
      urgencyStatus: row.urgency_status,
      receivedAt: row.received_at,
      matchedOn,
    }];
  });

  return {
    isDuplicate: matches.length > 0,
    reason: matches.length ? `Matched existing lead by ${matches[0].matchedOn.join(', ')}.` : null,
    matches,
  };
}

function serializeLead(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    source: row.source,
    message: row.message,
    status: row.status,
    urgencyStatus: row.urgency_status || 'warm',
    assignedUserId: row.assigned_user_id || null,
    assignedUserName: row.assigned_user_name || null,
    ownerUserId: row.owner_user_id || null,
    ownerUserName: row.owner_user_name || null,
    receivedAt: row.received_at,
    lastContactedAt: row.last_contacted_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    roleLabel: getRoleDisplayLabel(row.role),
    status: row.status,
    permissionOverrides: getPermissionOverrides(row),
    permissions: resolvePermissions(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function renderTemplate(body, vars = {}) {
  return body.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_m, k) => vars[k] ?? `{{${k}}}`);
}


function serializeOutboxItem(row) {
  return {
    id: row.id,
    emailDraftId: row.email_draft_id || null,
    toEmail: row.to_email,
    subject: row.subject,
    body: row.body,
    providerKey: row.provider_key || 'stub',
    sendStatus: row.send_status,
    queuedAt: row.queued_at,
    sentAt: row.sent_at || null,
    failedAt: row.failed_at || null,
    lastError: row.last_error || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByName: row.created_by_name || row.created_by_user_id || 'System',
    lastAttemptAt: row.failed_at || row.sent_at || row.updated_at || row.queued_at,
    canProcess: row.send_status !== 'sent',
    isFailed: row.send_status === 'failed',
    isQueued: row.send_status === 'queued',
    isSent: row.send_status === 'sent',
  };
}

function getInternalSignaturePayload(req, clerkUserId, email, timestamp) {
  return [req.method.toUpperCase(), req.path, clerkUserId, email, timestamp].join('\n');
}

function verifyInternalRequest(req) {
  const email = normalizeString(req.header('x-user-email')).toLowerCase();
  const clerkUserId = normalizeString(req.header('x-clerk-user-id'));
  const timestamp = normalizeString(req.header('x-internal-auth-ts'));
  const signature = normalizeString(req.header('x-internal-auth-signature'));

  if (!email || !clerkUserId || !timestamp || !signature || !INTERNAL_API_AUTH_SECRET) {
    return { ok: false, email, clerkUserId };
  }

  const ts = Date.parse(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, email, clerkUserId };
  if (Math.abs(Date.now() - ts) > 5 * 60 * 1000) return { ok: false, email, clerkUserId };

  const expected = crypto
    .createHmac('sha256', INTERNAL_API_AUTH_SECRET)
    .update(getInternalSignaturePayload(req, clerkUserId, email, timestamp))
    .digest('hex');

  try {
    const ok = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    return { ok, email, clerkUserId };
  } catch {
    return { ok: false, email, clerkUserId };
  }
}

function getRequestIdentity(req) {
  const verified = verifyInternalRequest(req);
  if (verified.ok) {
    return {
      email: verified.email || null,
      clerkUserId: verified.clerkUserId || null,
      verified: true,
    };
  }

  const email = normalizeString(req.header('x-user-email')).toLowerCase();
  const clerkUserId = normalizeString(req.header('x-clerk-user-id'));
  return {
    email: email || null,
    clerkUserId: clerkUserId || null,
    verified: false,
  };
}

function ensureBootstrapActor(identity) {
  const email = normalizeString(identity?.email).toLowerCase();
  if (!email) return null;

  let actor = db.prepare(`SELECT * FROM users WHERE lower(email) = ? LIMIT 1`).get(email);
  if (!actor && email === platformOwnerEmail) {
    const ts = nowIso();
    const id = `usr_${crypto.randomUUID()}`;
    db.prepare(`INSERT INTO users (id, organization_id, full_name, email, role, status, clerk_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, 'platform_owner', 'active', ?, ?, ?)`).run(id, DEFAULT_ORG_ID, platformOwnerName, email, identity?.clerkUserId || null, ts, ts);
    db.prepare(`INSERT OR IGNORE INTO platform_roles (id, user_id, role, created_at, updated_at) VALUES (?, ?, 'platform_admin', ?, ?)`).run(`prol_${crypto.randomUUID()}`, id, ts, ts);
    actor = db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(id);
  }

  if (actor && actor.email.toLowerCase() === platformOwnerEmail) {
    if (actor.role !== 'platform_owner') {
      db.prepare(`UPDATE users SET role = 'platform_owner', updated_at = ? WHERE id = ?`).run(nowIso(), actor.id);
      actor = { ...actor, role: 'platform_owner' };
    }
    db.prepare(`INSERT OR IGNORE INTO platform_roles (id, user_id, role, created_at, updated_at) VALUES (?, ?, 'platform_admin', ?, ?)`).run(`prol_${crypto.randomUUID()}`, actor.id, nowIso(), nowIso());
  }

  if (actor && identity?.clerkUserId && !actor.clerk_user_id) {
    db.prepare(`UPDATE users SET clerk_user_id = ?, updated_at = ? WHERE id = ?`).run(identity.clerkUserId, nowIso(), actor.id);
    actor = { ...actor, clerk_user_id: identity.clerkUserId };
  }

  return actor;
}

function getActor(req) {
  const identity = getRequestIdentity(req);

  if (identity.clerkUserId) {
    const byClerk = db
      .prepare(`SELECT * FROM users WHERE clerk_user_id = ? LIMIT 1`)
      .get(identity.clerkUserId);
    if (byClerk) return byClerk;
  }

  if (!identity.email) return null;

  return ensureBootstrapActor(identity) || db
    .prepare(`SELECT * FROM users WHERE organization_id = ? AND email = ? LIMIT 1`)
    .get(DEFAULT_ORG_ID, identity.email);
}

function getMembershipsForUser(userId) {
  return db.prepare(`SELECT m.*, o.name AS organization_name, o.slug AS organization_slug, o.workspace_type, o.environment FROM organization_memberships m JOIN organizations o ON o.id = m.organization_id WHERE m.user_id = ? AND m.status = 'active' ORDER BY m.created_at ASC`).all(userId);
}

function getPlatformRolesForUser(userId) {
  return db.prepare(`SELECT role FROM platform_roles WHERE user_id = ? ORDER BY role ASC`).all(userId).map((row) => row.role);
}

function getPlatformRoleLabel(role) {
  switch (role) {
    case 'platform_admin': return 'Platform Admin';
    case 'platform_support': return 'Platform Support';
    case 'platform_operator': return 'Platform Operator';
    default: return role;
  }
}

function getActiveMembershipForUser(user) {
  if (!user?.id) return null;
  const memberships = getMembershipsForUser(user.id);
  if (!memberships.length) return null;
  const preferred = user.preferred_workspace_id
    ? memberships.find((membership) => membership.organization_id === user.preferred_workspace_id)
    : null;
  return preferred || memberships[0];
}

function mapMembershipRoleToLegacyRole(role) {
  switch (role) {
    case 'owner': return 'company_owner';
    case 'admin': return 'company_admin';
    case 'operator': return 'company_agent';
    default: return 'company_agent';
  }
}

function getResolvedActor(req) {
  const user = getActor(req);
  if (!user) return null;
  const platformRoles = getPlatformRolesForUser(user.id);
  const activeMembership = getActiveMembershipForUser(user);

  if (platformRoles.length > 0) {
    return {
      ...user,
      platform_roles: platformRoles,
      memberships: getMembershipsForUser(user.id),
      acting_as_user_id: null,
      role: platformRoles[0],
      role_label: getPlatformRoleLabel(platformRoles[0]),
      organization_id: activeMembership?.organization_id || user.organization_id,
      active_workspace_id: activeMembership?.organization_id || user.preferred_workspace_id || user.organization_id,
      active_membership_role: activeMembership?.role || null,
    };
  }

  if (activeMembership) {
    return {
      ...user,
      platform_roles: [],
      memberships: getMembershipsForUser(user.id),
      acting_as_user_id: null,
      role: mapMembershipRoleToLegacyRole(activeMembership.role),
      role_label: activeMembership.role,
      organization_id: activeMembership.organization_id,
      active_workspace_id: activeMembership.organization_id,
      active_membership_role: activeMembership.role,
    };
  }

  return {
    ...user,
    platform_roles: [],
    memberships: [],
    acting_as_user_id: null,
  };
}

function getPermissionOverrides(user) {
  if (!user?.permissions_json) return {};
  try {
    const parsed = JSON.parse(user.permissions_json);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function resolvePermissions(user) {
  const defaults = ROLE_DEFAULT_PERMISSIONS[user?.role] || {};
  const overrides = getPermissionOverrides(user);
  const effective = { ...defaults };

  for (const [key, value] of Object.entries(overrides)) {
    if (KNOWN_PERMISSIONS.has(key) && typeof value === 'boolean') effective[key] = value;
  }

  return effective;
}


function getProviderSettings(orgId, providerKey) {
  return db.prepare(`SELECT * FROM email_provider_settings WHERE organization_id = ? AND provider_key = ? LIMIT 1`).get(orgId, providerKey);
}

function saveProviderSettingsRow(orgId, providerKey, patch = {}) {
  const existing = getProviderSettings(orgId, providerKey);
  const ts = nowIso();
  const next = {
    status: patch.status ?? existing?.status ?? 'disconnected',
    config_json: JSON.stringify(patch.config ?? (existing?.config_json ? JSON.parse(existing.config_json) : {})),
    client_id: patch.client_id ?? existing?.client_id ?? null,
    client_secret: patch.client_secret ?? existing?.client_secret ?? null,
    redirect_uri: patch.redirect_uri ?? existing?.redirect_uri ?? null,
    access_token: patch.access_token ?? existing?.access_token ?? null,
    refresh_token: patch.refresh_token ?? existing?.refresh_token ?? null,
    token_expires_at: patch.token_expires_at ?? existing?.token_expires_at ?? null,
  };

  if (existing) {
    db.prepare(`UPDATE email_provider_settings SET status = ?, config_json = ?, client_id = ?, client_secret = ?, redirect_uri = ?, access_token = ?, refresh_token = ?, token_expires_at = ?, updated_at = ? WHERE id = ?`).run(next.status, next.config_json, next.client_id, next.client_secret, next.redirect_uri, next.access_token, next.refresh_token, next.token_expires_at, ts, existing.id);
    return getProviderSettings(orgId, providerKey);
  }

  db.prepare(`INSERT INTO email_provider_settings (id, organization_id, provider_key, status, config_json, client_id, client_secret, redirect_uri, access_token, refresh_token, token_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(`eps_${crypto.randomUUID()}`, orgId, providerKey, next.status, next.config_json, next.client_id, next.client_secret, next.redirect_uri, next.access_token, next.refresh_token, next.token_expires_at, ts, ts);
  return getProviderSettings(orgId, providerKey);
}


function getEmailPolicyForOrg(orgId) {
  const row = db.prepare(`SELECT * FROM organization_email_policies WHERE organization_id = ? LIMIT 1`).get(orgId);
  if (!row) {
    return {
      organization_id: orgId,
      allow_user_mailboxes: 0,
      default_send_mode: 'org_default',
      restrict_outbound_to_company_domains: 0,
      allowed_user_mailbox_roles: ['company_admin'],
      updated_at: null,
    };
  }
  return {
    ...row,
    allowed_user_mailbox_roles: safeJsonParse(row.allowed_user_mailbox_roles_json, ['company_admin']),
  };
}

function saveEmailPolicyForOrg(orgId, incoming = {}) {
  const current = getEmailPolicyForOrg(orgId);
  const ts = nowIso();
  const next = {
    allow_user_mailboxes: incoming.allowUserMailboxes ? 1 : 0,
    default_send_mode: ['org_default', 'user_optional', 'user_preferred'].includes(incoming.defaultSendMode) ? incoming.defaultSendMode : (current.default_send_mode || 'org_default'),
    restrict_outbound_to_company_domains: incoming.restrictOutboundToCompanyDomains ? 1 : 0,
    allowed_user_mailbox_roles_json: JSON.stringify(Array.isArray(incoming.allowedUserMailboxRoles) && incoming.allowedUserMailboxRoles.length ? incoming.allowedUserMailboxRoles : (current.allowed_user_mailbox_roles || ['company_admin'])),
  };
  const existing = db.prepare(`SELECT * FROM organization_email_policies WHERE organization_id = ? LIMIT 1`).get(orgId);
  if (existing) {
    db.prepare(`UPDATE organization_email_policies SET allow_user_mailboxes = ?, default_send_mode = ?, restrict_outbound_to_company_domains = ?, allowed_user_mailbox_roles_json = ?, updated_at = ? WHERE organization_id = ?`).run(next.allow_user_mailboxes, next.default_send_mode, next.restrict_outbound_to_company_domains, next.allowed_user_mailbox_roles_json, ts, orgId);
  } else {
    db.prepare(`INSERT INTO organization_email_policies (id, organization_id, allow_user_mailboxes, default_send_mode, restrict_outbound_to_company_domains, allowed_user_mailbox_roles_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(`epl_${crypto.randomUUID()}`, orgId, next.allow_user_mailboxes, next.default_send_mode, next.restrict_outbound_to_company_domains, next.allowed_user_mailbox_roles_json, ts, ts);
  }
  return getEmailPolicyForOrg(orgId);
}

function serializeEmailAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id || null,
    scopeType: row.scope_type,
    providerType: row.provider_type,
    providerKey: row.provider_key || null,
    accountRole: row.account_role,
    emailAddress: row.email_address,
    displayName: row.display_name || null,
    signature: row.signature || null,
    authMethod: row.auth_method,
    capabilities: safeJsonParse(row.capabilities_json, []),
    config: safeJsonParse(row.config_json, {}),
    status: row.status,
    isDefaultForOrg: Boolean(row.is_default_for_org),
    isDefaultForUser: Boolean(row.is_default_for_user),
    lastSyncAt: row.last_sync_at || null,
    lastSendAt: row.last_send_at || null,
    lastError: row.last_error || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerName: row.owner_name || null,
    ownerEmail: row.owner_email || null,
    senderEmailAddress: row.sender_email_address || null,
    senderDisplayName: row.sender_display_name || null,
  };
}

function listEmailAccountsForOrg(orgId) {
  const rows = db.prepare(`SELECT ea.*, u.full_name AS owner_name, u.email AS owner_email FROM email_accounts ea LEFT JOIN users u ON u.id = ea.user_id WHERE ea.organization_id = ? ORDER BY ea.scope_type ASC, ea.created_at DESC`).all(orgId);
  if (rows.length) return rows.map(serializeEmailAccount);

  const gmail = getProviderSettings(orgId, 'gmail');
  if (!gmail) return [];
  return [{
    id: `legacy_gmail_${orgId}`,
    organizationId: orgId,
    userId: null,
    scopeType: 'organization',
    providerType: 'google',
    providerKey: 'gmail',
    accountRole: 'inbox_and_send',
    emailAddress: 'workspace-email-not-yet-specified',
    displayName: null,
    signature: null,
    authMethod: 'oauth',
    capabilities: ['send'],
    config: gmail.config_json ? safeJsonParse(gmail.config_json, {}) : {},
    status: gmail.status || 'disconnected',
    isDefaultForOrg: true,
    isDefaultForUser: false,
    lastSyncAt: null,
    lastSendAt: null,
    lastError: null,
    createdAt: gmail.created_at,
    updatedAt: gmail.updated_at,
    ownerName: null,
    ownerEmail: null,
    isLegacyProviderSetting: true,
  }];
}

function createEmailAccount({ organizationId, userId = null, scopeType, providerType, providerKey = null, accountRole = 'inbox_and_send', emailAddress, displayName = null, signature = null, authMethod = 'oauth', capabilities = [], config = {}, status = 'disconnected', isDefaultForOrg = false, isDefaultForUser = false }) {
  const id = `emacct_${crypto.randomUUID()}`;
  const ts = nowIso();
  if (isDefaultForOrg) db.prepare(`UPDATE email_accounts SET is_default_for_org = 0, updated_at = ? WHERE organization_id = ?`).run(ts, organizationId);
  if (isDefaultForUser && userId) db.prepare(`UPDATE email_accounts SET is_default_for_user = 0, updated_at = ? WHERE user_id = ?`).run(ts, userId);
  db.prepare(`INSERT INTO email_accounts (id, organization_id, user_id, scope_type, provider_type, provider_key, account_role, email_address, display_name, signature, auth_method, capabilities_json, config_json, status, is_default_for_org, is_default_for_user, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, organizationId, userId, scopeType, providerType, providerKey, accountRole, emailAddress, displayName, signature, authMethod, JSON.stringify(capabilities), JSON.stringify(config), status, isDefaultForOrg ? 1 : 0, isDefaultForUser ? 1 : 0, ts, ts);
  return db.prepare(`SELECT ea.*, u.full_name AS owner_name, u.email AS owner_email FROM email_accounts ea LEFT JOIN users u ON u.id = ea.user_id WHERE ea.id = ? LIMIT 1`).get(id);
}

function getEmailAccountById(id, organizationId) {
  return db.prepare(`SELECT ea.*, u.full_name AS owner_name, u.email AS owner_email FROM email_accounts ea LEFT JOIN users u ON u.id = ea.user_id WHERE ea.id = ? AND ea.organization_id = ? LIMIT 1`).get(id, organizationId);
}

function updateEmailAccount(id, organizationId, patch = {}) {
  const existing = getEmailAccountById(id, organizationId);
  if (!existing) return null;
  const ts = nowIso();
  const next = {
    provider_key: patch.providerKey ?? existing.provider_key ?? null,
    display_name: patch.displayName ?? existing.display_name ?? null,
    signature: patch.signature ?? existing.signature ?? null,
    capabilities_json: JSON.stringify(patch.capabilities ?? safeJsonParse(existing.capabilities_json, [])),
    config_json: JSON.stringify(patch.config ?? safeJsonParse(existing.config_json, {})),
    status: patch.status ?? existing.status,
    is_default_for_org: patch.isDefaultForOrg == null ? existing.is_default_for_org : (patch.isDefaultForOrg ? 1 : 0),
    is_default_for_user: patch.isDefaultForUser == null ? existing.is_default_for_user : (patch.isDefaultForUser ? 1 : 0),
    last_sync_at: patch.lastSyncAt ?? existing.last_sync_at ?? null,
    last_send_at: patch.lastSendAt ?? existing.last_send_at ?? null,
    last_error: patch.lastError ?? existing.last_error ?? null,
  };
  if (next.is_default_for_org) db.prepare(`UPDATE email_accounts SET is_default_for_org = 0, updated_at = ? WHERE organization_id = ?`).run(ts, organizationId);
  if (next.is_default_for_user && existing.user_id) db.prepare(`UPDATE email_accounts SET is_default_for_user = 0, updated_at = ? WHERE user_id = ?`).run(ts, existing.user_id);
  db.prepare(`UPDATE email_accounts SET provider_key = ?, display_name = ?, signature = ?, capabilities_json = ?, config_json = ?, status = ?, is_default_for_org = ?, is_default_for_user = ?, last_sync_at = ?, last_send_at = ?, last_error = ?, updated_at = ? WHERE id = ? AND organization_id = ?`).run(next.provider_key, next.display_name, next.signature, next.capabilities_json, next.config_json, next.status, next.is_default_for_org, next.is_default_for_user, next.last_sync_at, next.last_send_at, next.last_error, ts, id, organizationId);
  return getEmailAccountById(id, organizationId);
}

function getDefaultEmailAccountForOrg(orgId, actor = null) {
  let row = null;
  if (actor?.id) {
    row = db.prepare(`SELECT ea.*, u.full_name AS owner_name, u.email AS owner_email FROM email_accounts ea LEFT JOIN users u ON u.id = ea.user_id WHERE ea.organization_id = ? AND ea.user_id = ? AND ea.is_default_for_user = 1 LIMIT 1`).get(orgId, actor.id);
    if (row) return row;
  }
  row = db.prepare(`SELECT ea.*, u.full_name AS owner_name, u.email AS owner_email FROM email_accounts ea LEFT JOIN users u ON u.id = ea.user_id WHERE ea.organization_id = ? AND ea.is_default_for_org = 1 LIMIT 1`).get(orgId);
  return row;
}

function getSelectableEmailAccountsForActor(orgId, actor) {
  const policy = getEmailPolicyForOrg(orgId);
  const rows = db.prepare(`SELECT ea.*, u.full_name AS owner_name, u.email AS owner_email FROM email_accounts ea LEFT JOIN users u ON u.id = ea.user_id WHERE ea.organization_id = ? AND (ea.scope_type = 'organization' OR ea.user_id = ?) ORDER BY ea.scope_type ASC, ea.created_at DESC`).all(orgId, actor?.id || '');
  return rows.filter((row) => row.scope_type === 'organization' || policy.allow_user_mailboxes || row.user_id === actor?.id);
}

function resolveEmailAccountForSend(orgId, actor, emailAccountId = null, providerKey = null) {
  if (emailAccountId) {
    const account = getEmailAccountById(emailAccountId, orgId);
    if (!account) throw new Error('Selected email account was not found');
    if (account.scope_type === 'user' && account.user_id !== actor?.id && !PLATFORM_ROLES.has(actor?.role)) throw new Error('You may not use that personal mailbox');
    return account;
  }
  if (providerKey) {
    const byProvider = getSelectableEmailAccountsForActor(orgId, actor).find((row) => (row.provider_key || row.provider_type) === providerKey);
    if (byProvider) return byProvider;
  }
  return getDefaultEmailAccountForOrg(orgId, actor);
}


function getEmailSyncState(emailAccountId) {
  return db.prepare(`SELECT * FROM email_sync_state WHERE email_account_id = ? LIMIT 1`).get(emailAccountId);
}

function upsertEmailSyncState({ organizationId, emailAccountId, providerKey, syncMode = 'manual', lastCursor = null, lastSyncedAt = null, lastStatus = 'idle', lastError = null, lockedBy = null, lockExpiresAt = null, syncIntervalMinutes = 15 }) {
  const existing = getEmailSyncState(emailAccountId);
  const ts = nowIso();
  if (existing) {
    db.prepare(`UPDATE email_sync_state SET provider_key = ?, sync_mode = ?, last_cursor = ?, last_synced_at = ?, last_status = ?, last_error = ?, locked_by = ?, lock_expires_at = ?, sync_interval_minutes = ?, updated_at = ? WHERE email_account_id = ?`).run(providerKey, syncMode, lastCursor, lastSyncedAt, lastStatus, lastError, lockedBy, lockExpiresAt, syncIntervalMinutes, ts, emailAccountId);
  } else {
    db.prepare(`INSERT INTO email_sync_state (id, organization_id, email_account_id, provider_key, sync_mode, last_cursor, last_synced_at, last_status, last_error, locked_by, lock_expires_at, sync_interval_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(`esync_${crypto.randomUUID()}`, organizationId, emailAccountId, providerKey, syncMode, lastCursor, lastSyncedAt, lastStatus, lastError, lockedBy, lockExpiresAt, syncIntervalMinutes, ts, ts);
  }
  return getEmailSyncState(emailAccountId);
}

function claimDueEmailSyncAccounts({ workerId, limit = 10, now = new Date() }) {
  const nowIsoValue = now.toISOString();
  const rows = db.prepare(`SELECT ess.*, ea.organization_id, ea.provider_key, ea.provider_type, ea.status AS account_status FROM email_sync_state ess JOIN email_accounts ea ON ea.id = ess.email_account_id WHERE ess.sync_mode = 'background' AND ea.status IN ('connected', 'degraded', 'needs_reauth') AND (ess.last_status != 'running' OR ess.lock_expires_at IS NULL OR ess.lock_expires_at < ?) ORDER BY COALESCE(ess.last_synced_at, '1970-01-01T00:00:00.000Z') ASC LIMIT ?`).all(nowIsoValue, limit);
  const claimed = [];
  for (const row of rows) {
    const lastSyncedMs = row.last_synced_at ? new Date(row.last_synced_at).getTime() : 0;
    const intervalMs = Math.max(Number(row.sync_interval_minutes || 15), 1) * 60_000;
    if (lastSyncedMs && Date.now() - lastSyncedMs < intervalMs) continue;
    const leaseUntil = new Date(Date.now() + 5 * 60_000).toISOString();
    const result = db.prepare(`UPDATE email_sync_state SET last_status = 'running', locked_by = ?, lock_expires_at = ?, updated_at = ? WHERE email_account_id = ? AND (last_status != 'running' OR lock_expires_at IS NULL OR lock_expires_at < ? )`).run(workerId, leaseUntil, nowIsoValue, row.email_account_id, nowIsoValue);
    if (result.changes) claimed.push(getEmailSyncState(row.email_account_id));
  }
  return claimed;
}

function recordEmailSyncRunStart({ organizationId, emailAccountId, providerKey, workerId }) {
  const id = `esr_${crypto.randomUUID()}`;
  const ts = nowIso();
  db.prepare(`INSERT INTO email_sync_runs (id, organization_id, email_account_id, provider_key, started_at, status, locked_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?)`).run(id, organizationId, emailAccountId, providerKey, ts, workerId, ts, ts);
  return id;
}

function recordEmailSyncRunFinish({ runId, status, importedCount = 0, skippedCount = 0, checkedCount = 0, error = null, details = null }) {
  const ts = nowIso();
  db.prepare(`UPDATE email_sync_runs SET completed_at = ?, status = ?, imported_count = ?, skipped_count = ?, checked_count = ?, error = ?, details_json = ?, updated_at = ? WHERE id = ?`).run(ts, status, importedCount, skippedCount, checkedCount, error, details ? JSON.stringify(details) : null, ts, runId);
}

const emailSyncProviderDispatcher = createProviderDispatcher({
  syncGmailInboundForAccount,
  syncMicrosoftInboundForAccount,
});

const runEmailSyncForAccount = createRunAccountSyncRuntime({
  db,
  nowIso,
  getEmailAccountById,
  getEmailSyncState,
  upsertEmailSyncState,
  recordEmailSyncRunStart,
  recordEmailSyncRunFinish,
  providerDispatcher: emailSyncProviderDispatcher,
});

const runDueEmailSyncs = createSyncRunner({
  claimDueEmailSyncAccounts,
  runAccountSync: runEmailSyncForAccount,
});

function loadGmailClientConfig() {
  if (fs.existsSync(GMAIL_JSON_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(GMAIL_JSON_PATH, 'utf8'));
      const web = parsed.web || parsed.installed || {};
      return {
        clientId: web.client_id || GMAIL_FALLBACK.clientId,
        clientSecret: web.client_secret || GMAIL_FALLBACK.clientSecret,
        redirectUri: (web.redirect_uris && web.redirect_uris[0]) || GMAIL_FALLBACK.redirectUri,
      };
    } catch {}
  }
  return GMAIL_FALLBACK;
}

function requireAuthenticated(req, res, next) {
  const identity = getRequestIdentity(req);
  if (!identity.verified) {
    return res.status(401).json({ ok: false, error: 'Verified internal identity is required' });
  }

  const actor = getResolvedActor(req);
  if (!actor) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  if (actor.status !== 'active') return res.status(403).json({ ok: false, error: 'User is not active' });

  req.actor = actor;
  req.actorPermissions = resolvePermissions(actor);
  next();
}

function requireIdentity(req, res, next) {
  const identity = getRequestIdentity(req);
  if (!identity.email || !identity.clerkUserId) {
    return res.status(401).json({ ok: false, error: 'Authenticated identity is required' });
  }

  if (!identity.verified) {
    return res.status(401).json({ ok: false, error: 'Verified internal identity is required' });
  }

  req.identity = identity;
  next();
}

function getWorkspaceByIdentity(identity) {
  if (!identity) return null;

  if (identity.clerkUserId) {
    const byClerk = db.prepare(`SELECT o.*, u.id AS user_id, u.role AS user_role, u.status AS user_status, u.email AS user_email FROM users u JOIN organizations o ON o.id = u.organization_id WHERE u.clerk_user_id = ? LIMIT 1`).get(identity.clerkUserId);
    if (byClerk) return byClerk;
  }

  if (identity.email) {
    return db.prepare(`SELECT o.*, u.id AS user_id, u.role AS user_role, u.status AS user_status, u.email AS user_email FROM users u JOIN organizations o ON o.id = u.organization_id WHERE u.email = ? LIMIT 1`).get(identity.email);
  }

  return null;
}

function getAccessRequestForIdentity(identity) {
  if (!identity) return null;

  if (identity.clerkUserId) {
    const byClerk = db.prepare(`SELECT * FROM access_requests WHERE clerk_user_id = ? ORDER BY created_at DESC LIMIT 1`).get(identity.clerkUserId);
    if (byClerk) return byClerk;
  }

  if (identity.email) {
    const byEmail = db.prepare(`SELECT * FROM access_requests WHERE lower(email) = ? ORDER BY created_at DESC LIMIT 1`).get(identity.email);
    if (byEmail && !byEmail.clerk_user_id && identity.clerkUserId) {
      db.prepare(`UPDATE access_requests SET clerk_user_id = ?, activation_token = NULL, updated_at = ? WHERE id = ?`).run(identity.clerkUserId, nowIso(), byEmail.id);
      return { ...byEmail, clerk_user_id: identity.clerkUserId };
    }
    return byEmail;
  }

  return null;
}

function provisionApprovedRequest(request, reviewedByUserId = null, reviewNotes = null) {
  const fullName = normalizeString(request.full_name);
  const email = normalizeString(request.email).toLowerCase();
  const orgName = normalizeString(request.organization_name);
  const ts = nowIso();
  const workspaceType = request.request_kind === 'individual_workspace' ? 'individual' : 'business_verified';
  const orgId = `org_${crypto.randomUUID()}`;
  const userId = `usr_${crypto.randomUUID()}`;
  const workspaceSlug = ensureUniqueWorkspaceSlug(orgName || orgId);

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO organizations (id, name, timezone, workspace_type, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(orgId, orgName, 'America/New_York', workspaceType, workspaceSlug, ts, ts);
    db.prepare(`INSERT INTO users (id, organization_id, full_name, email, role, status, clerk_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, 'company_owner', 'active', ?, ?, ?)`).run(userId, orgId, fullName, email, request.clerk_user_id || null, ts, ts);
    db.prepare(`INSERT INTO settings (id, organization_id, key, value_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).run(`set_${crypto.randomUUID()}`, orgId, BUSINESS_SETTINGS_KEY, JSON.stringify({
      businessName: orgName,
      timezone: 'America/New_York',
      lineOfBusiness: request.line_of_business || '',
      bookingLink: 'https://calendly.com/your-link',
      hours: defaultBusinessSettings.hours,
      requestKind: request.request_kind,
      onboardingNotes: request.notes || '',
    }), ts, ts);
    db.prepare(`UPDATE access_requests SET status = 'approved', review_notes = COALESCE(?, review_notes), reviewed_by_user_id = COALESCE(?, reviewed_by_user_id), reviewed_at = COALESCE(reviewed_at, ?), activation_token = NULL, activated_at = COALESCE(activated_at, ?), updated_at = ? WHERE id = ?`).run(reviewNotes, reviewedByUserId, ts, ts, ts, request.id);
  });

  tx();
  return { organization: { id: orgId, name: orgName, slug: workspaceSlug, workspaceType }, user: { id: userId, email, role: 'company_owner' } };
}

function getRoleDisplayLabel(role) {
  switch (role) {
    case 'platform_owner': return 'Platform Owner';
    case 'platform_admin': return 'Platform Admin';
    case 'platform_sme': return 'SME';
    case 'platform_agent': return 'Agent';
    case 'company_owner': return 'Company Owner';
    case 'company_admin': return 'Admin';
    case 'company_agent': return 'Agent';
    case 'owner': return 'Company Owner';
    case 'admin': return 'Admin';
    case 'agent': return 'Agent';
    default: return role || 'Unknown role';
  }
}

function canManageRole(actorRole, targetRole) {
  if (actorRole === 'platform_owner') return true;
  if (actorRole === 'platform_admin') return !['platform_owner'].includes(targetRole);
  if (actorRole === 'company_owner') return COMPANY_ROLES.has(targetRole) && targetRole !== 'company_owner';
  if (actorRole === 'company_admin') return targetRole === 'company_agent';
  return false;
}

function requireRoles(roles) {
  return (req, res, next) => {
    requireAuthenticated(req, res, () => {
      if (!roles.includes(req.actor.role)) {
        return res.status(403).json({ ok: false, error: 'Insufficient permissions' });
      }
      next();
    });
  };
}

function requirePermission(permissionKey) {
  return (req, res, next) => {
    requireAuthenticated(req, res, () => {
      if (!req.actorPermissions?.[permissionKey]) {
        return res.status(403).json({ ok: false, error: `Missing permission: ${permissionKey}` });
      }
      next();
    });
  };
}

function getActorOrgId(req) {
  return req.actor?.active_workspace_id || req.actor?.organization_id || DEFAULT_ORG_ID;
}

function getManageableUserById(req, userId) {
  if (PLATFORM_ROLES.has(req.actor?.role)) {
    return db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(userId);
  }
  const orgId = getActorOrgId(req);
  return db.prepare(`SELECT * FROM users WHERE organization_id = ? AND id = ? LIMIT 1`).get(orgId, userId);
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/api/access/me', requireIdentity, (req, res) => {
  const actor = getResolvedActor(req);
  if (actor && PLATFORM_ROLES.has(actor.role)) {
    const org = db.prepare(`SELECT * FROM organizations WHERE id = ? LIMIT 1`).get(actor.organization_id);
    return res.json({
      ok: true,
      state: 'approved',
      workspace: {
        id: org?.id || actor.organization_id,
        name: org?.name || DEFAULT_ORG_NAME,
        slug: org?.slug || 'platform',
        workspaceType: 'platform',
        surface: 'control',
      },
      user: {
        id: actor.id,
        role: actor.role,
        roleLabel: getRoleDisplayLabel(actor.role),
        status: actor.status,
        email: actor.email,
      },
    });
  }

  let workspace = getWorkspaceByIdentity(req.identity);
  let pendingRequest = getAccessRequestForIdentity(req.identity);
  const pendingInvitations = db.prepare(`SELECT i.id, i.organization_id, i.email, i.role, i.status, i.created_at, o.name AS organization_name FROM user_invitations i JOIN organizations o ON o.id = i.organization_id WHERE lower(i.email) = ? AND i.status = 'pending' ORDER BY i.created_at DESC`).all(req.identity.email);

  if (!workspace && pendingRequest?.status === 'approved' && pendingRequest.clerk_user_id) {
    const existingUserByClerk = db.prepare(`SELECT * FROM users WHERE clerk_user_id = ? LIMIT 1`).get(pendingRequest.clerk_user_id);
    if (!existingUserByClerk) {
      provisionApprovedRequest(pendingRequest);
      workspace = getWorkspaceByIdentity(req.identity);
    }
  }

  if (workspace) {
    return res.json({
      ok: true,
      state: 'approved',
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug || ensureUniqueWorkspaceSlug(workspace.name || workspace.id, workspace.id),
        workspaceType: workspace.workspace_type,
        surface: getSurfaceForRole(workspace.user_role),
      },
      workspaces: actor?.memberships?.map((membership) => ({
        id: membership.organization_id,
        name: membership.organization_name,
        slug: membership.organization_slug,
        workspaceType: membership.workspace_type,
        environment: membership.environment || 'customer',
        membershipRole: membership.role,
        active: membership.organization_id === actor.active_workspace_id,
      })) || [],
      user: {
        id: workspace.user_id,
        role: workspace.user_role,
        status: workspace.user_status,
        email: workspace.user_email,
      },
    });
  }

  if (pendingRequest) {
    return res.json({
      ok: true,
      state: pendingRequest.status,
      request: {
        id: pendingRequest.id,
        organizationName: pendingRequest.organization_name,
        requestKind: pendingRequest.request_kind,
        roleTitle: pendingRequest.role_title,
        lineOfBusiness: pendingRequest.line_of_business,
        notes: pendingRequest.notes,
        createdAt: pendingRequest.created_at,
        updatedAt: pendingRequest.updated_at,
      },
      invitations: pendingInvitations,
    });
  }

  if (pendingInvitations.length > 0) {
    return res.json({ ok: true, state: 'invited', invitations: pendingInvitations });
  }

  return res.json({ ok: true, state: 'authenticated_not_onboarded' });
});

app.post('/api/public/access/individual', (req, res) => {
  const fullName = normalizeString(req.body?.fullName);
  const email = normalizeString(req.body?.email).toLowerCase();
  const workspaceName = normalizeString(req.body?.workspaceName);
  const lineOfBusiness = normalizeString(req.body?.lineOfBusiness);
  const useCase = normalizeString(req.body?.useCase);
  const notes = normalizeString(req.body?.notes);

  if (!fullName) return res.status(400).json({ ok: false, error: 'fullName is required' });
  if (!email) return res.status(400).json({ ok: false, error: 'email is required' });
  if (!workspaceName) return res.status(400).json({ ok: false, error: 'workspaceName is required' });

  const existingWorkspace = db.prepare(`SELECT u.id FROM users u WHERE lower(u.email) = ? LIMIT 1`).get(email);
  if (existingWorkspace) {
    return res.status(409).json({ ok: false, error: 'An account for this email already exists. Please sign in instead.' });
  }

  const existingRequest = db.prepare(`SELECT * FROM access_requests WHERE lower(email) = ? AND status != 'approved' ORDER BY created_at DESC LIMIT 1`).get(email);
  const ts = nowIso();
  const combinedNotes = [useCase, notes].filter(Boolean).join('\n\n') || null;

  if (existingRequest) {
    db.prepare(`UPDATE access_requests SET full_name = ?, request_kind = 'individual_workspace', role_title = NULL, organization_name = ?, website = NULL, line_of_business = ?, requested_features_json = '[]', team_size = NULL, authority_attestation = 0, notes = ?, status = 'pending', updated_at = ? WHERE id = ?`).run(fullName, workspaceName, lineOfBusiness || null, combinedNotes, ts, existingRequest.id);
    return res.json({ ok: true, request: { id: existingRequest.id, status: 'pending', requestKind: 'individual_workspace', organizationName: workspaceName, updatedAt: ts } });
  }

  const requestId = `req_${crypto.randomUUID()}`;
  db.prepare(`INSERT INTO access_requests (id, clerk_user_id, email, full_name, request_kind, role_title, organization_name, website, line_of_business, requested_features_json, team_size, authority_attestation, notes, status, created_at, updated_at) VALUES (?, NULL, ?, ?, 'individual_workspace', NULL, ?, NULL, ?, '[]', NULL, 0, ?, 'pending', ?, ?)`).run(requestId, email, fullName, workspaceName, lineOfBusiness || null, combinedNotes, ts, ts);

  res.status(201).json({ ok: true, request: { id: requestId, status: 'pending', requestKind: 'individual_workspace', organizationName: workspaceName, createdAt: ts } });
});

app.post('/api/access/individual', requireIdentity, (req, res) => {
  const existingWorkspace = getWorkspaceByIdentity(req.identity);
  if (existingWorkspace) {
    return res.status(409).json({ ok: false, error: 'This identity is already provisioned' });
  }

  const fullName = normalizeString(req.body?.fullName);
  const email = normalizeString(req.body?.email).toLowerCase();
  const workspaceName = normalizeString(req.body?.workspaceName);
  const lineOfBusiness = normalizeString(req.body?.lineOfBusiness);
  const useCase = normalizeString(req.body?.useCase);
  const notes = normalizeString(req.body?.notes);

  if (!fullName) return res.status(400).json({ ok: false, error: 'fullName is required' });
  if (!email) return res.status(400).json({ ok: false, error: 'email is required' });
  if (!workspaceName) return res.status(400).json({ ok: false, error: 'workspaceName is required' });

  const existingRequest = getAccessRequestForIdentity(req.identity);
  const ts = nowIso();

  if (existingRequest) {
    db.prepare(`UPDATE access_requests SET clerk_user_id = ?, email = ?, full_name = ?, request_kind = 'individual_workspace', role_title = NULL, organization_name = ?, website = NULL, line_of_business = ?, requested_features_json = '[]', team_size = NULL, authority_attestation = 0, notes = ?, status = 'pending', updated_at = ? WHERE id = ?`).run(req.identity.clerkUserId, email, fullName, workspaceName, lineOfBusiness || null, [useCase, notes].filter(Boolean).join('\n\n') || null, ts, existingRequest.id);
    return res.json({ ok: true, request: { id: existingRequest.id, status: 'pending', requestKind: 'individual_workspace', organizationName: workspaceName, updatedAt: ts } });
  }

  const requestId = `req_${crypto.randomUUID()}`;
  db.prepare(`INSERT INTO access_requests (id, clerk_user_id, email, full_name, request_kind, role_title, organization_name, website, line_of_business, requested_features_json, team_size, authority_attestation, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'individual_workspace', NULL, ?, NULL, ?, '[]', NULL, 0, ?, 'pending', ?, ?)`).run(requestId, req.identity.clerkUserId, email, fullName, workspaceName, lineOfBusiness || null, [useCase, notes].filter(Boolean).join('\n\n') || null, ts, ts);

  res.status(201).json({ ok: true, request: { id: requestId, status: 'pending', requestKind: 'individual_workspace', organizationName: workspaceName, createdAt: ts } });
});

app.post('/api/public/access/business-request', (req, res) => {
  const fullName = normalizeString(req.body?.fullName);
  const email = normalizeString(req.body?.email).toLowerCase();
  const roleTitle = normalizeString(req.body?.roleTitle);
  const organizationName = normalizeString(req.body?.organizationName);
  const website = normalizeString(req.body?.website);
  const lineOfBusiness = normalizeString(req.body?.lineOfBusiness);
  const teamSize = normalizeString(req.body?.teamSize);
  const requestedFeatures = Array.isArray(req.body?.requestedFeatures) ? req.body.requestedFeatures.map((v) => normalizeString(v)).filter(Boolean) : [];
  const authorityAttestation = Boolean(req.body?.authorityAttestation);
  const notes = normalizeString(req.body?.notes);

  if (!fullName) return res.status(400).json({ ok: false, error: 'fullName is required' });
  if (!email) return res.status(400).json({ ok: false, error: 'email is required' });
  if (!organizationName) return res.status(400).json({ ok: false, error: 'organizationName is required' });
  if (!authorityAttestation) return res.status(400).json({ ok: false, error: 'authorityAttestation is required' });

  const existingWorkspace = db.prepare(`SELECT u.id FROM users u WHERE lower(u.email) = ? LIMIT 1`).get(email);
  if (existingWorkspace) {
    return res.status(409).json({ ok: false, error: 'An account for this email already exists. Please sign in instead.' });
  }

  const existingRequest = db.prepare(`SELECT * FROM access_requests WHERE lower(email) = ? AND status != 'approved' ORDER BY created_at DESC LIMIT 1`).get(email);
  const ts = nowIso();

  if (existingRequest) {
    db.prepare(`UPDATE access_requests SET full_name = ?, request_kind = 'business_workspace', role_title = ?, organization_name = ?, website = ?, line_of_business = ?, requested_features_json = ?, team_size = ?, authority_attestation = ?, notes = ?, status = 'pending', updated_at = ? WHERE id = ?`).run(fullName, roleTitle || null, organizationName, website || null, lineOfBusiness || null, JSON.stringify(requestedFeatures), teamSize || null, authorityAttestation ? 1 : 0, notes || null, ts, existingRequest.id);
    return res.json({ ok: true, request: { id: existingRequest.id, status: 'pending', organizationName, updatedAt: ts } });
  }

  const requestId = `req_${crypto.randomUUID()}`;
  db.prepare(`INSERT INTO access_requests (id, clerk_user_id, email, full_name, request_kind, role_title, organization_name, website, line_of_business, requested_features_json, team_size, authority_attestation, notes, status, created_at, updated_at) VALUES (?, NULL, ?, ?, 'business_workspace', ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`).run(requestId, email, fullName, roleTitle || null, organizationName, website || null, lineOfBusiness || null, JSON.stringify(requestedFeatures), teamSize || null, authorityAttestation ? 1 : 0, notes || null, ts, ts);

  res.status(201).json({ ok: true, request: { id: requestId, status: 'pending', organizationName, createdAt: ts } });
});

app.post('/api/access/business-request', requireIdentity, (req, res) => {
  const existingWorkspace = getWorkspaceByIdentity(req.identity);
  if (existingWorkspace) {
    return res.status(409).json({ ok: false, error: 'This identity is already provisioned' });
  }

  const fullName = normalizeString(req.body?.fullName);
  const email = normalizeString(req.body?.email).toLowerCase();
  const roleTitle = normalizeString(req.body?.roleTitle);
  const organizationName = normalizeString(req.body?.organizationName);
  const website = normalizeString(req.body?.website);
  const lineOfBusiness = normalizeString(req.body?.lineOfBusiness);
  const teamSize = normalizeString(req.body?.teamSize);
  const requestedFeatures = Array.isArray(req.body?.requestedFeatures) ? req.body.requestedFeatures.map((v) => normalizeString(v)).filter(Boolean) : [];
  const authorityAttestation = Boolean(req.body?.authorityAttestation);
  const notes = normalizeString(req.body?.notes);

  if (!fullName) return res.status(400).json({ ok: false, error: 'fullName is required' });
  if (!email) return res.status(400).json({ ok: false, error: 'email is required' });
  if (!organizationName) return res.status(400).json({ ok: false, error: 'organizationName is required' });
  if (!authorityAttestation) return res.status(400).json({ ok: false, error: 'authorityAttestation is required' });

  const existingRequest = getAccessRequestForIdentity(req.identity);
  const ts = nowIso();

  if (existingRequest) {
    db.prepare(`UPDATE access_requests SET clerk_user_id = ?, email = ?, full_name = ?, request_kind = 'business_workspace', role_title = ?, organization_name = ?, website = ?, line_of_business = ?, requested_features_json = ?, team_size = ?, authority_attestation = ?, notes = ?, status = 'pending', updated_at = ? WHERE id = ?`).run(req.identity.clerkUserId, email, fullName, roleTitle || null, organizationName, website || null, lineOfBusiness || null, JSON.stringify(requestedFeatures), teamSize || null, authorityAttestation ? 1 : 0, notes || null, ts, existingRequest.id);
    return res.json({ ok: true, request: { id: existingRequest.id, status: 'pending', organizationName, updatedAt: ts } });
  }

  const requestId = `req_${crypto.randomUUID()}`;
  db.prepare(`INSERT INTO access_requests (id, clerk_user_id, email, full_name, request_kind, role_title, organization_name, website, line_of_business, requested_features_json, team_size, authority_attestation, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'business_workspace', ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`).run(requestId, req.identity.clerkUserId, email, fullName, roleTitle || null, organizationName, website || null, lineOfBusiness || null, JSON.stringify(requestedFeatures), teamSize || null, authorityAttestation ? 1 : 0, notes || null, ts, ts);

  res.status(201).json({ ok: true, request: { id: requestId, status: 'pending', organizationName, createdAt: ts } });
});

app.get('/api/me/permissions', requireAuthenticated, (req, res) => {
  res.json({
    ok: true,
    actor: {
      id: req.actor.id,
      email: req.actor.email,
      role: req.actor.role,
      roleLabel: getRoleDisplayLabel(req.actor.role),
      status: req.actor.status,
    },
    permissions: req.actorPermissions,
  });
});

app.get('/api/settings/ai', requirePermission('settings.manageBusiness'), (req, res) => {
  const orgId = getActorOrgId(req);
  const settings = getAiSettingsForOrg(orgId);
  if (!settings) return res.status(404).json({ ok: false, error: 'AI settings not found' });
  res.json({ ok: true, settings, updatedAt: settings.updated_at || null });
});

app.put('/api/settings/ai', requirePermission('settings.manageBusiness'), (req, res) => {
  const orgId = getActorOrgId(req);
  const current = getAiSettingsForOrg(orgId);
  const incoming = req.body || {};
  const next = {
    ai_enabled: Boolean(incoming.aiEnabled),
    default_mode: ['draft_only', 'approval_required', 'guarded_autopilot'].includes(incoming.defaultMode) ? incoming.defaultMode : (current?.default_mode || 'draft_only'),
    allowed_channels_json: JSON.stringify(Array.isArray(incoming.allowedChannels) ? incoming.allowedChannels : (current?.allowed_channels || ['email', 'sms'])),
    allowed_actions_json: JSON.stringify(Array.isArray(incoming.allowedActions) ? incoming.allowedActions : (current?.allowed_actions || ['draft_message'])),
    response_sla_target_minutes: Math.max(1, Number(incoming.responseSlaTargetMinutes || current?.response_sla_target_minutes || 5)),
    tone_profile_json: JSON.stringify(incoming.toneProfile && typeof incoming.toneProfile === 'object' ? incoming.toneProfile : (current?.tone_profile || { defaultTone: 'professional and warm' })),
    business_context_json: JSON.stringify(incoming.businessContext && typeof incoming.businessContext === 'object' ? incoming.businessContext : (current?.business_context || {})),
    compliance_policy_json: JSON.stringify(incoming.compliancePolicy && typeof incoming.compliancePolicy === 'object' ? incoming.compliancePolicy : (current?.compliance_policy || {})),
    usage_plan: normalizeString(incoming.usagePlan) || current?.usage_plan || 'standard',
    monthly_message_limit: Math.max(1, Number(incoming.monthlyMessageLimit || current?.monthly_message_limit || 250)),
    monthly_ai_token_budget: Math.max(1000, Number(incoming.monthlyAiTokenBudget || current?.monthly_ai_token_budget || 250000)),
    model_policy_json: JSON.stringify(incoming.modelPolicy && typeof incoming.modelPolicy === 'object' ? incoming.modelPolicy : (current?.model_policy || { primaryProvider: 'stub', primaryModel: 'stub/draft-v1', allowedModels: ['stub/draft-v1'] })),
  };
  const ts = nowIso();
  if (current) {
    db.prepare(`UPDATE organization_ai_settings SET ai_enabled = ?, default_mode = ?, allowed_channels_json = ?, allowed_actions_json = ?, response_sla_target_minutes = ?, tone_profile_json = ?, business_context_json = ?, compliance_policy_json = ?, usage_plan = ?, monthly_message_limit = ?, monthly_ai_token_budget = ?, model_policy_json = ?, updated_at = ? WHERE organization_id = ?`).run(
      next.ai_enabled ? 1 : 0,
      next.default_mode,
      next.allowed_channels_json,
      next.allowed_actions_json,
      next.response_sla_target_minutes,
      next.tone_profile_json,
      next.business_context_json,
      next.compliance_policy_json,
      next.usage_plan,
      next.monthly_message_limit,
      next.monthly_ai_token_budget,
      next.model_policy_json,
      ts,
      orgId,
    );
  } else {
    db.prepare(`INSERT INTO organization_ai_settings (id, organization_id, ai_enabled, default_mode, allowed_channels_json, allowed_actions_json, response_sla_target_minutes, tone_profile_json, business_context_json, compliance_policy_json, usage_plan, monthly_message_limit, monthly_ai_token_budget, model_policy_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      `aiset_${crypto.randomUUID()}`,
      orgId,
      next.ai_enabled ? 1 : 0,
      next.default_mode,
      next.allowed_channels_json,
      next.allowed_actions_json,
      next.response_sla_target_minutes,
      next.tone_profile_json,
      next.business_context_json,
      next.compliance_policy_json,
      next.usage_plan,
      next.monthly_message_limit,
      next.monthly_ai_token_budget,
      next.model_policy_json,
      ts,
      ts,
    );
  }
  res.json({ ok: true, updatedAt: ts, settings: getAiSettingsForOrg(orgId) });
});

app.get('/api/ai/runs', requirePermission('communications.view'), (req, res) => {
  const orgId = getActorOrgId(req);
  const limit = Math.min(Number(req.query.limit || 25), 100);
  const rows = db.prepare(`SELECT * FROM ai_runs WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?`).all(orgId, limit);
  res.json({ ok: true, runs: rows });
});

app.get('/api/ai/runs/:id', requirePermission('communications.view'), (req, res) => {
  const orgId = getActorOrgId(req);
  const run = db.prepare(`SELECT r.*, l.full_name AS lead_full_name, l.email AS lead_email, l.status AS lead_status, l.urgency_status AS lead_urgency_status FROM ai_runs r LEFT JOIN leads l ON l.id = r.lead_id WHERE r.organization_id = ? AND r.id = ? LIMIT 1`).get(orgId, req.params.id);
  if (!run) return res.status(404).json({ ok: false, error: 'AI run not found' });

  const outputs = db.prepare(`SELECT id, output_type, content_json, created_at FROM ai_run_outputs WHERE ai_run_id = ? ORDER BY created_at ASC`).all(run.id).map((row) => ({
    id: row.id,
    outputType: row.output_type,
    content: safeJsonParse(row.content_json, null),
    createdAt: row.created_at,
  }));

  res.json({
    ok: true,
    run: {
      ...run,
      lead: run.lead_id ? {
        id: run.lead_id,
        fullName: run.lead_full_name || null,
        email: run.lead_email || null,
        status: run.lead_status || null,
        urgencyStatus: run.lead_urgency_status || null,
      } : null,
    },
    outputs,
  });
});

app.get('/api/platform/directory', requirePermission('platform.users.manage'), (req, res) => {
  const q = normalizeString(req.query.q || '').toLowerCase();
  const limit = Math.min(Number(req.query.limit || 25), 100);

  const users = q
    ? db.prepare(`SELECT u.*, o.name AS organization_name FROM users u LEFT JOIN organizations o ON o.id = u.organization_id WHERE lower(u.full_name) LIKE ? OR lower(u.email) LIKE ? OR lower(o.name) LIKE ? ORDER BY u.created_at DESC LIMIT ?`).all(`%${q}%`, `%${q}%`, `%${q}%`, limit)
    : db.prepare(`SELECT u.*, o.name AS organization_name FROM users u LEFT JOIN organizations o ON o.id = u.organization_id ORDER BY u.created_at DESC LIMIT ?`).all(limit);

  const organizations = q
    ? db.prepare(`SELECT * FROM organizations WHERE lower(name) LIKE ? OR lower(COALESCE(slug, '')) LIKE ? ORDER BY created_at DESC LIMIT ?`).all(`%${q}%`, `%${q}%`, limit)
    : db.prepare(`SELECT * FROM organizations ORDER BY created_at DESC LIMIT ?`).all(limit);

  res.json({
    ok: true,
    users: users.map((row) => ({ ...serializeUser(row), organizationName: row.organization_name })),
    organizations: organizations.map((org) => ({ ...org, slug: org.slug || ensureUniqueWorkspaceSlug(org.name || org.id, org.id) })),
  });
});

app.get('/api/admin/access-requests', requirePermission('platform.accessRequests.review'), (req, res) => {
  const rows = db.prepare(`SELECT id, clerk_user_id, email, full_name, request_kind, role_title, organization_name, website, line_of_business, requested_features_json, team_size, authority_attestation, notes, status, review_notes, reviewed_at, activation_token, activated_at, created_at, updated_at FROM access_requests ORDER BY created_at DESC`).all();
  res.json({
    ok: true,
    requests: rows.map((row) => ({
      ...row,
      requested_features: safeJsonParse(row.requested_features_json, []),
      authority_attestation: Boolean(row.authority_attestation),
    })),
  });
});

app.post('/api/admin/access-requests/:id/approve', requirePermission('platform.accessRequests.review'), (req, res) => {
  const request = db.prepare(`SELECT * FROM access_requests WHERE id = ? LIMIT 1`).get(req.params.id);
  if (!request) return res.status(404).json({ ok: false, error: 'Request not found' });
  if (request.status === 'approved') return res.json({ ok: true, alreadyApproved: true });

  const reviewNotes = normalizeString(req.body?.reviewNotes) || null;
  const ts = nowIso();

  if (request.clerk_user_id) {
    const existingUserByClerk = db.prepare(`SELECT * FROM users WHERE clerk_user_id = ? LIMIT 1`).get(request.clerk_user_id);
    if (existingUserByClerk) {
      return res.status(409).json({ ok: false, error: 'This Clerk identity is already linked to a user' });
    }

    const provisioned = provisionApprovedRequest(request, req.actor.id, reviewNotes);
    return res.json({ ok: true, ...provisioned });
  }

  const activationToken = crypto.randomUUID();
  db.prepare(`UPDATE access_requests SET status = 'approved', review_notes = ?, reviewed_by_user_id = ?, reviewed_at = ?, activation_token = ?, updated_at = ? WHERE id = ?`).run(reviewNotes, req.actor.id, ts, activationToken, ts, request.id);
  res.json({ ok: true, request: { id: request.id, status: 'approved', approvedAt: ts, activationToken }, awaitingActivation: true, activationUrl: `/sign-up?activation_token=${activationToken}` });
});

app.get('/api/public/access/activation/:token', (req, res) => {
  const token = normalizeString(req.params.token);
  if (!token) return res.status(400).json({ ok: false, error: 'activation token is required' });

  const request = db.prepare(`SELECT id, email, full_name, organization_name, request_kind, status, activation_token, activated_at, created_at, updated_at FROM access_requests WHERE activation_token = ? LIMIT 1`).get(token);
  if (!request) return res.status(404).json({ ok: false, error: 'Activation token not found' });
  if (request.status !== 'approved') return res.status(409).json({ ok: false, error: 'Request is not approved for activation' });

  res.json({
    ok: true,
    activation: {
      requestId: request.id,
      email: request.email,
      fullName: request.full_name,
      organizationName: request.organization_name,
      requestKind: request.request_kind,
      status: request.status,
      activatedAt: request.activated_at,
      createdAt: request.created_at,
      updatedAt: request.updated_at,
    },
  });
});

app.post('/api/admin/access-requests/:id/reject', requirePermission('platform.accessRequests.review'), (req, res) => {
  const request = db.prepare(`SELECT * FROM access_requests WHERE id = ? LIMIT 1`).get(req.params.id);
  if (!request) return res.status(404).json({ ok: false, error: 'Request not found' });
  const ts = nowIso();
  db.prepare(`UPDATE access_requests SET status = 'rejected', review_notes = ?, reviewed_by_user_id = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`).run(normalizeString(req.body?.reviewNotes) || null, req.actor.id, ts, ts, request.id);
  res.json({ ok: true, request: { id: request.id, status: 'rejected', reviewedAt: ts } });
});

app.post('/api/admin/access-requests/:id/needs-follow-up', requirePermission('platform.accessRequests.review'), (req, res) => {
  const request = db.prepare(`SELECT * FROM access_requests WHERE id = ? LIMIT 1`).get(req.params.id);
  if (!request) return res.status(404).json({ ok: false, error: 'Request not found' });
  const ts = nowIso();
  db.prepare(`UPDATE access_requests SET status = 'needs_follow_up', review_notes = ?, reviewed_by_user_id = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`).run(normalizeString(req.body?.reviewNotes) || null, req.actor.id, ts, ts, request.id);
  res.json({ ok: true, request: { id: request.id, status: 'needs_follow_up', reviewedAt: ts } });
});

app.get('/api/organizations/:id/invitations', requirePermission('team.manageUsers'), (req, res) => {
  if (req.actor.organization_id !== req.params.id) return res.status(403).json({ ok: false, error: 'Cannot view invitations for another organization' });
  const org = db.prepare(`SELECT * FROM organizations WHERE id = ? LIMIT 1`).get(req.params.id);
  if (!org) return res.status(404).json({ ok: false, error: 'Organization not found' });
  if (org.workspace_type !== 'business_verified') return res.status(403).json({ ok: false, error: 'Only verified business workspaces can invite users' });

  const invitations = db.prepare(`SELECT * FROM user_invitations WHERE organization_id = ? ORDER BY created_at DESC`).all(req.params.id);
  res.json({ ok: true, invitations });
});

app.post('/api/organizations/:id/invitations', requirePermission('team.manageUsers'), (req, res) => {
  if (req.actor.organization_id !== req.params.id) return res.status(403).json({ ok: false, error: 'Cannot invite into another organization' });
  const org = db.prepare(`SELECT * FROM organizations WHERE id = ? LIMIT 1`).get(req.params.id);
  if (!org) return res.status(404).json({ ok: false, error: 'Organization not found' });
  if (org.workspace_type !== 'business_verified') return res.status(403).json({ ok: false, error: 'Only verified business workspaces can invite users' });

  const email = normalizeString(req.body?.email).toLowerCase();
  const role = normalizeString(req.body?.role) || 'company_agent';
  if (!email) return res.status(400).json({ ok: false, error: 'email is required' });
  if (!['company_admin', 'company_agent', 'admin', 'agent'].includes(role)) return res.status(400).json({ ok: false, error: 'role must be company_admin or company_agent' });

  const existingInvitation = db.prepare(`SELECT * FROM user_invitations WHERE organization_id = ? AND email = ? AND status = 'pending' LIMIT 1`).get(req.params.id, email);
  if (existingInvitation) return res.json({ ok: true, invitation: existingInvitation, alreadyPending: true });

  const invitationId = `inv_${crypto.randomUUID()}`;
  const ts = nowIso();
  const normalizedRole = role === 'admin' ? 'company_admin' : role === 'agent' ? 'company_agent' : role;
  db.prepare(`INSERT INTO user_invitations (id, organization_id, email, role, status, invited_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`).run(invitationId, req.params.id, email, normalizedRole, req.actor.id, ts, ts);
  const invitation = db.prepare(`SELECT * FROM user_invitations WHERE id = ? LIMIT 1`).get(invitationId);
  res.status(201).json({ ok: true, invitation });
});

app.post('/api/invitations/:id/revoke', requirePermission('team.manageUsers'), (req, res) => {
  const invitation = db.prepare(`SELECT * FROM user_invitations WHERE id = ? LIMIT 1`).get(req.params.id);
  if (!invitation) return res.status(404).json({ ok: false, error: 'Invitation not found' });
  if (invitation.organization_id !== req.actor.organization_id) {
    return res.status(403).json({ ok: false, error: 'Cannot revoke invitations for another organization' });
  }
  if (invitation.status !== 'pending') return res.status(409).json({ ok: false, error: 'Only pending invitations can be revoked' });
  const ts = nowIso();
  db.prepare(`UPDATE user_invitations SET status = 'revoked', updated_at = ? WHERE id = ?`).run(ts, invitation.id);
  res.json({ ok: true, invitation: { ...invitation, status: 'revoked', updated_at: ts } });
});

app.post('/api/invitations/:id/accept', requireIdentity, (req, res) => {
  const invitation = db.prepare(`SELECT * FROM user_invitations WHERE id = ? LIMIT 1`).get(req.params.id);
  if (!invitation) return res.status(404).json({ ok: false, error: 'Invitation not found' });
  if (invitation.status !== 'pending') return res.status(409).json({ ok: false, error: 'Invitation is not pending' });
  if (normalizeString(invitation.email).toLowerCase() !== req.identity.email) return res.status(403).json({ ok: false, error: 'Invitation email does not match your account' });

  const existingWorkspace = getWorkspaceByIdentity(req.identity);
  if (existingWorkspace) return res.status(409).json({ ok: false, error: 'This identity is already provisioned' });

  const org = db.prepare(`SELECT * FROM organizations WHERE id = ? LIMIT 1`).get(invitation.organization_id);
  if (!org) return res.status(404).json({ ok: false, error: 'Organization not found' });
  if (org.workspace_type !== 'business_verified') return res.status(403).json({ ok: false, error: 'Invitation target is not a verified business workspace' });

  const userId = `usr_${crypto.randomUUID()}`;
  const ts = nowIso();
  db.transaction(() => {
    db.prepare(`INSERT INTO users (id, organization_id, full_name, email, role, status, clerk_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`).run(userId, org.id, req.identity.email, req.identity.email, invitation.role, req.identity.clerkUserId, ts, ts);
    db.prepare(`UPDATE user_invitations SET status = 'accepted', accepted_by_user_id = ?, updated_at = ? WHERE id = ?`).run(userId, ts, invitation.id);
  })();

  res.json({ ok: true, organization: { id: org.id, name: org.name }, user: { id: userId, email: req.identity.email, role: invitation.role } });
});

app.get('/api/users', requirePermission('team.manageUsers'), (req, res) => {
  const rows = PLATFORM_ROLES.has(req.actor?.role)
    ? db.prepare(`SELECT * FROM users ORDER BY role IN ('platform_owner','company_owner') DESC, created_at ASC`).all()
    : db.prepare(`SELECT * FROM users WHERE organization_id = ? ORDER BY role IN ('platform_owner','company_owner') DESC, created_at ASC`).all(getActorOrgId(req));

  res.json({ ok: true, users: rows.map(serializeUser) });
});

app.get('/api/users/:id/permissions', requirePermission('team.manageUsers'), (req, res) => {
  const orgId = getActorOrgId(req);
  const user = db
    .prepare(`SELECT * FROM users WHERE organization_id = ? AND id = ? LIMIT 1`)
    .get(orgId, req.params.id);

  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  res.json({
    ok: true,
    userId: user.id,
    role: user.role,
    permissionOverrides: getPermissionOverrides(user),
    permissions: resolvePermissions(user),
  });
});

app.put('/api/users/:id/permissions', requirePermission('team.manageUsers'), (req, res) => {
  const user = getManageableUserById(req, req.params.id);

  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
  if (!canManageRole(req.actor.role, user.role)) {
    return res.status(403).json({ ok: false, error: 'You cannot modify permissions for this user' });
  }

  const incoming = req.body?.permissions;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return res.status(400).json({ ok: false, error: 'permissions object is required' });
  }

  for (const [key, value] of Object.entries(incoming)) {
    if (!KNOWN_PERMISSIONS.has(key) || typeof value !== 'boolean') {
      return res.status(400).json({ ok: false, error: 'permissions must use known keys with boolean values' });
    }
  }

  const ts = nowIso();
  db.prepare(`UPDATE users SET permissions_json = ?, updated_at = ? WHERE id = ?`).run(
    JSON.stringify(incoming),
    ts,
    user.id
  );

  const updated = db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(user.id);
  res.json({
    ok: true,
    userId: updated.id,
    permissionOverrides: getPermissionOverrides(updated),
    permissions: resolvePermissions(updated),
    updatedAt: updated.updated_at,
  });
});

app.post('/api/users', requirePermission('team.manageUsers'), (req, res) => {
  const orgId = getActorOrgId(req);
  const fullName = normalizeString(req.body?.fullName);
  const email = normalizeString(req.body?.email).toLowerCase();
  const role = normalizeString(req.body?.role || 'company_agent').toLowerCase();

  if (!fullName) return res.status(400).json({ ok: false, error: 'fullName is required' });
  if (!email) return res.status(400).json({ ok: false, error: 'email is required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'email format is invalid' });
  }
  const normalizedRole = role === 'owner' ? 'company_owner' : role === 'admin' ? 'company_admin' : role === 'agent' ? 'company_agent' : role;
  if (!USER_ROLES.has(normalizedRole)) {
    return res.status(400).json({ ok: false, error: 'role is invalid' });
  }
  if (COMPANY_ROLES.has(normalizedRole) && normalizedRole === 'company_owner') {
    return res.status(400).json({ ok: false, error: 'company_owner creation is not supported here' });
  }
  if (PLATFORM_ROLES.has(normalizedRole) && !['platform_owner', 'platform_admin'].includes(req.actor.role)) {
    return res.status(403).json({ ok: false, error: 'Only platform leadership can create internal operators' });
  }
  if (COMPANY_ROLES.has(normalizedRole) && !['company_owner', 'company_admin', 'platform_owner', 'platform_admin'].includes(req.actor.role)) {
    return res.status(403).json({ ok: false, error: 'You cannot create company users' });
  }

  const duplicate = db.prepare(`SELECT id FROM users WHERE lower(email) = ? LIMIT 1`).get(email);
  if (duplicate) return res.status(409).json({ ok: false, error: 'A user with this email already exists' });

  const targetOrgId = PLATFORM_ROLES.has(normalizedRole) ? DEFAULT_ORG_ID : orgId;
  const id = `usr_${crypto.randomUUID()}`;
  const ts = nowIso();
  db.prepare(
    `INSERT INTO users (id, organization_id, full_name, email, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
  ).run(id, targetOrgId, fullName, email, normalizedRole, ts, ts);

  const user = db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(id);
  res.status(201).json({ ok: true, user: serializeUser(user) });
});

app.patch('/api/users/:id', requirePermission('team.manageUsers'), (req, res) => {
  const existing = getManageableUserById(req, req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'User not found' });

  if (!canManageRole(req.actor.role, existing.role) && req.actor.id !== existing.id) {
    return res.status(403).json({ ok: false, error: 'You cannot modify this user' });
  }

  const fullName = req.body?.fullName == null ? existing.full_name : normalizeString(req.body.fullName);
  const role = req.body?.role == null ? existing.role : normalizeString(req.body.role).toLowerCase();
  const status = req.body?.status == null ? existing.status : normalizeString(req.body.status).toLowerCase();

  if (!fullName) return res.status(400).json({ ok: false, error: 'fullName is required' });
  const normalizedRole = role === 'owner' ? 'company_owner' : role === 'admin' ? 'company_admin' : role === 'agent' ? 'company_agent' : role;
  if (!USER_ROLES.has(normalizedRole)) return res.status(400).json({ ok: false, error: 'role is invalid' });
  if (!USER_STATUSES.has(status)) {
    return res.status(400).json({ ok: false, error: 'status must be one of active|deactivated|suspended' });
  }

  if (existing.role === 'company_owner' && normalizedRole !== 'company_owner') {
    return res.status(400).json({ ok: false, error: 'Cannot change role for the company owner' });
  }

  if (COMPANY_ROLES.has(existing.role) && PLATFORM_ROLES.has(normalizedRole)) {
    return res.status(400).json({ ok: false, error: 'Cannot promote company users into platform roles from workspace settings' });
  }

  db.prepare(`UPDATE users SET full_name = ?, role = ?, status = ?, updated_at = ? WHERE id = ?`).run(
    fullName,
    normalizedRole,
    status,
    nowIso(),
    req.params.id
  );

  const updated = db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(req.params.id);
  res.json({ ok: true, user: serializeUser(updated) });
});

app.delete('/api/users/:id', requirePermission('team.manageUsers'), (req, res) => {
  const existing = getManageableUserById(req, req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'User not found' });

  if (existing.role === 'company_owner' || existing.role === 'platform_owner') {
    return res.status(400).json({ ok: false, error: 'Cannot remove the protected owner account' });
  }
  if (!canManageRole(req.actor.role, existing.role)) {
    return res.status(403).json({ ok: false, error: 'You cannot remove this user' });
  }

  db.prepare(`DELETE FROM users WHERE id = ?`).run(req.params.id);
  res.json({ ok: true, removedUserId: req.params.id });
});

app.get('/api/users-lite', requirePermission('leads.view'), (req, res) => {
  const orgId = getActorOrgId(req);
  const rows = db.prepare(`SELECT id, full_name, email, role FROM users WHERE organization_id = ? AND status = 'active' ORDER BY role IN ('platform_owner','company_owner') DESC, full_name ASC`).all(orgId);
  res.json({ ok: true, users: rows.map((row) => ({ id: row.id, fullName: row.full_name, email: row.email, role: row.role })) });
});

app.post('/api/leads/intake', async (req, res) => {
  const validated = validateLead(req.body || {});
  if (!validated.ok) return res.status(400).json({ ok: false, errors: validated.errors });

  const duplicate = findLeadDuplicates(validated.data);
  if (duplicate.isDuplicate) {
    return res.status(409).json({ ok: false, error: 'Duplicate lead detected', duplicate });
  }

  const leadId = `lead_${crypto.randomUUID()}`;
  const eventId = `evt_${crypto.randomUUID()}`;
  const ts = nowIso();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO leads
       (id, organization_id, full_name, email, phone, source, message, status, urgency_status, received_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)`
    ).run(
      leadId,
      DEFAULT_ORG_ID,
      validated.data.fullName,
      validated.data.email,
      validated.data.phone,
      validated.data.source,
      validated.data.message,
      validated.data.urgencyStatus,
      ts,
      ts,
      ts
    );

    db.prepare(
      `INSERT INTO events (id, organization_id, lead_id, event_type, payload_json, created_at)
       VALUES (?, ?, ?, 'lead.created', ?, ?)`
    ).run(eventId, DEFAULT_ORG_ID, leadId, JSON.stringify(validated.data), ts);
  });

  tx();

  let autoDraft = null;
  const aiSettings = getAiSettingsForOrg(DEFAULT_ORG_ID);
  const shouldAutoDraft = Boolean(aiSettings?.ai_enabled && aiSettings?.allowed_actions?.includes('draft_message') && aiSettings?.compliance_policy?.autoGenerateFirstResponseOnLeadCreate);
  if (shouldAutoDraft) {
    try {
      autoDraft = await generateLeadDraftForLead({ orgId: DEFAULT_ORG_ID, leadId, triggerType: 'auto', triggerId: leadId });
    } catch (error) {
      db.prepare(`INSERT INTO events (id, organization_id, lead_id, event_type, payload_json, created_at) VALUES (?, ?, ?, 'lead.auto_draft_failed', ?, ?)`).run(`evt_${crypto.randomUUID()}`, DEFAULT_ORG_ID, leadId, JSON.stringify({ error: error?.message || 'Auto draft failed' }), nowIso());
    }
  }

  res.status(201).json({ ok: true, lead: { id: leadId, status: 'new', receivedAt: ts, ...validated.data }, autoDraft: autoDraft ? { draftId: autoDraft.draftId, runId: autoDraft.runId, draft: autoDraft.draft } : null });
});

app.post('/api/leads/duplicates', requirePermission('leads.view'), (req, res) => {
  const duplicate = findLeadDuplicates({
    fullName: req.body?.fullName || req.body?.name,
    email: req.body?.email,
    phone: req.body?.phone,
  });
  res.json({ ok: true, duplicate });
});

app.get('/api/leads', requirePermission('leads.view'), (req, res) => {
  const orgId = getActorOrgId(req);
  const status = normalizeString(req.query.status).toLowerCase();
  const urgency = normalizeString(req.query.urgency).toLowerCase();
  const limit = Math.min(Number(req.query.limit || 50), 200);

  const conditions = ['l.organization_id = ?'];
  const params = [orgId];

  if (status) {
    conditions.push('l.status = ?');
    params.push(status);
  }
  if (urgency) {
    conditions.push('l.urgency_status = ?');
    params.push(urgency);
  }
  params.push(limit);

  const rows = db
    .prepare(`SELECT l.*, au.full_name AS assigned_user_name, ou.full_name AS owner_user_name
              FROM leads l
              LEFT JOIN users au ON au.id = l.assigned_user_id
              LEFT JOIN users ou ON ou.id = l.owner_user_id
              WHERE ${conditions.join(' AND ')} ORDER BY l.received_at DESC LIMIT ?`)
    .all(...params);

  res.json({ ok: true, leads: rows.map(serializeLead) });
});

app.get('/api/leads/:id', requirePermission('leads.view'), (req, res) => {
  const orgId = getActorOrgId(req);
  const row = db
    .prepare(`SELECT l.*, au.full_name AS assigned_user_name, ou.full_name AS owner_user_name
              FROM leads l
              LEFT JOIN users au ON au.id = l.assigned_user_id
              LEFT JOIN users ou ON ou.id = l.owner_user_id
              WHERE l.organization_id = ? AND l.id = ? LIMIT 1`)
    .get(orgId, req.params.id);

  if (!row) return res.status(404).json({ ok: false, error: 'Lead not found' });
  res.json({ ok: true, lead: serializeLead(row) });
});

app.patch('/api/leads/:id', requirePermission('leads.edit'), (req, res) => {
  const orgId = getActorOrgId(req);
  const existing = db
    .prepare(`SELECT * FROM leads WHERE organization_id = ? AND id = ? LIMIT 1`)
    .get(orgId, req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Lead not found' });

  const fullName = req.body?.fullName == null ? existing.full_name : normalizeString(req.body.fullName);
  const emailRaw = req.body?.email == null ? existing.email : normalizeString(req.body?.email).toLowerCase();
  const phoneRaw = req.body?.phone == null ? existing.phone : normalizeString(req.body?.phone);
  const source = req.body?.source == null ? existing.source : normalizeString(req.body?.source || 'webhook');
  const message = req.body?.message == null ? existing.message : normalizeString(req.body?.message);
  const urgencyStatus = req.body?.urgencyStatus == null ? existing.urgency_status : normalizeString(req.body?.urgencyStatus).toLowerCase();
  const assignedUserId = req.body?.assignedUserId === undefined ? existing.assigned_user_id : (normalizeString(req.body?.assignedUserId) || null);
  const ownerUserId = req.body?.ownerUserId === undefined ? existing.owner_user_id : (normalizeString(req.body?.ownerUserId) || null);

  if (!fullName) return res.status(400).json({ ok: false, error: 'fullName is required' });
  if (!emailRaw && !phoneRaw) {
    return res.status(400).json({ ok: false, error: 'At least one contact field is required: email or phone' });
  }
  if (!URGENCY_STATUSES.has(urgencyStatus)) {
    return res.status(400).json({ ok: false, error: 'urgencyStatus is invalid' });
  }

  const ts = nowIso();
  const eventId = `evt_${crypto.randomUUID()}`;

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE leads SET full_name = ?, email = ?, phone = ?, source = ?, message = ?, urgency_status = ?, assigned_user_id = ?, owner_user_id = ?, updated_at = ? WHERE id = ?`
    ).run(fullName, emailRaw || null, phoneRaw || null, source, message || null, urgencyStatus, assignedUserId, ownerUserId, ts, req.params.id);

    db.prepare(
      `INSERT INTO events (id, organization_id, lead_id, event_type, payload_json, created_at)
       VALUES (?, ?, ?, 'lead.updated', ?, ?)`
    ).run(
      eventId,
      orgId,
      req.params.id,
      JSON.stringify({ fullName, email: emailRaw || null, phone: phoneRaw || null, source, message: message || null, urgencyStatus, assignedUserId, ownerUserId }),
      ts
    );
  });

  tx();

  const updated = db.prepare(`SELECT l.*, au.full_name AS assigned_user_name, ou.full_name AS owner_user_name FROM leads l LEFT JOIN users au ON au.id = l.assigned_user_id LEFT JOIN users ou ON ou.id = l.owner_user_id WHERE l.id = ? LIMIT 1`).get(req.params.id);
  res.json({ ok: true, lead: serializeLead(updated) });
});

app.get('/api/leads/:id/events', requirePermission('leads.view'), (req, res) => {
  const orgId = getActorOrgId(req);
  const rows = db
    .prepare(
      `SELECT id, event_type, payload_json, created_at FROM events WHERE organization_id = ? AND lead_id = ? ORDER BY created_at DESC LIMIT 50`
    )
    .all(orgId, req.params.id)
    .map((r) => ({ id: r.id, eventType: r.event_type, payload: r.payload_json ? JSON.parse(r.payload_json) : null, createdAt: r.created_at }));

  res.json({ ok: true, events: rows });
});

app.post('/api/leads/:id/ai/draft-response', requirePermission('communications.create'), async (req, res) => {
  const orgId = getActorOrgId(req);
  const lead = db.prepare(`SELECT * FROM leads WHERE organization_id = ? AND id = ? LIMIT 1`).get(orgId, req.params.id);
  if (!lead) return res.status(404).json({ ok: false, error: 'Lead not found' });

  try {
    const result = await generateLeadDraftForLead({ orgId, leadId: req.params.id, triggerType: 'manual', triggerId: req.params.id });
    const run = db.prepare(`SELECT id, status, provider, model FROM ai_runs WHERE id = ? LIMIT 1`).get(result.runId);
    res.json({ ok: true, run, draft: result.draft });
  } catch (error) {
    const message = error?.message || 'AI draft failed';
    const status = /disabled/.test(message) ? 409 : /allowed/.test(message) ? 403 : /not found/.test(message) ? 404 : 500;
    res.status(status).json({ ok: false, error: message });
  }
});

app.get('/api/leads/:id/communications', requirePermission('communications.view'), (req, res) => {
  const orgId = getActorOrgId(req);
  const rows = db
    .prepare(
      `SELECT id, channel, direction, actor_type, actor_name, subject, summary, content, occurred_at
       FROM communications
       WHERE organization_id = ? AND lead_id = ?
       ORDER BY occurred_at DESC, created_at DESC`
    )
    .all(orgId, req.params.id)
    .map((row) => ({
      id: row.id,
      channel: row.channel,
      direction: row.direction,
      actorType: row.actor_type,
      actorName: row.actor_name || 'Unknown',
      subject: row.subject || null,
      summary: row.summary || '',
      content: row.content || '',
      occurredAt: row.occurred_at,
    }));

  res.json({ ok: true, communications: rows });
});

app.post('/api/leads/:id/communications', requirePermission('communications.create'), (req, res) => {
  const orgId = getActorOrgId(req);
  const existing = db
    .prepare(`SELECT * FROM leads WHERE organization_id = ? AND id = ? LIMIT 1`)
    .get(orgId, req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Lead not found' });

  const channel = normalizeString(req.body?.channel).toLowerCase();
  const direction = normalizeString(req.body?.direction || 'outbound').toLowerCase();
  const subject = normalizeString(req.body?.subject) || null;
  const summary = normalizeString(req.body?.summary);
  const content = normalizeString(req.body?.content);

  if (!['email', 'sms', 'call', 'chat'].includes(channel)) {
    return res.status(400).json({ ok: false, error: 'channel must be one of email|sms|call|chat' });
  }
  if (!['inbound', 'outbound'].includes(direction)) {
    return res.status(400).json({ ok: false, error: 'direction must be inbound|outbound' });
  }
  if (!summary && !content) {
    return res.status(400).json({ ok: false, error: 'summary or content is required' });
  }

  const communicationId = `com_${crypto.randomUUID()}`;
  const eventId = `evt_${crypto.randomUUID()}`;
  const ts = nowIso();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO communications (id, organization_id, lead_id, channel, direction, actor_type, actor_name, subject, summary, content, occurred_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'user', ?, ?, ?, ?, ?, ?, ?)`
    ).run(communicationId, orgId, req.params.id, channel, direction, req.actor?.full_name || 'Team User', subject, summary || content, content || summary, ts, ts, ts);

    db.prepare(
      `INSERT INTO events (id, organization_id, lead_id, event_type, payload_json, created_at)
       VALUES (?, ?, ?, 'lead.communication_added', ?, ?)`
    ).run(eventId, orgId, req.params.id, JSON.stringify({ channel, direction, subject, summary }), ts);

    db.prepare(`UPDATE leads SET last_contacted_at = ?, updated_at = ? WHERE id = ?`).run(ts, ts, req.params.id);
  });

  tx();

  res.status(201).json({
    ok: true,
    communication: {
      id: communicationId,
      channel,
      direction,
      actorType: 'user',
      actorName: req.actor?.full_name || 'Team User',
      subject,
      summary: summary || content,
      content: content || summary,
      occurredAt: ts,
    },
  });
});

app.get('/api/leads/:id/notes', requirePermission('notes.viewInternal'), (req, res) => {
  const orgId = getActorOrgId(req);
  const rows = db
    .prepare(
      `SELECT n.id, n.content, n.note_type, n.created_at, COALESCE(u.full_name, 'System') AS author_name
       FROM notes n
       LEFT JOIN users u ON u.id = n.author_user_id
       WHERE n.organization_id = ? AND n.lead_id = ?
       ORDER BY n.created_at DESC`
    )
    .all(orgId, req.params.id)
    .map((row) => ({
      id: row.id,
      content: row.content,
      noteType: row.note_type,
      authorName: row.author_name,
      createdAt: row.created_at,
    }));

  res.json({ ok: true, notes: rows });
});

app.post('/api/leads/:id/notes', requirePermission('notes.createInternal'), (req, res) => {
  const orgId = getActorOrgId(req);
  const existing = db
    .prepare(`SELECT * FROM leads WHERE organization_id = ? AND id = ? LIMIT 1`)
    .get(orgId, req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Lead not found' });

  const content = normalizeString(req.body?.content);
  const noteType = normalizeString(req.body?.noteType || 'general').toLowerCase();
  if (!content) return res.status(400).json({ ok: false, error: 'content is required' });

  const noteId = `note_${crypto.randomUUID()}`;
  const eventId = `evt_${crypto.randomUUID()}`;
  const ts = nowIso();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO notes (id, organization_id, lead_id, author_user_id, note_type, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(noteId, orgId, req.params.id, req.actor.id, noteType, content, ts, ts);

    db.prepare(
      `INSERT INTO events (id, organization_id, lead_id, event_type, payload_json, created_at)
       VALUES (?, ?, ?, 'lead.note_added', ?, ?)`
    ).run(eventId, orgId, req.params.id, JSON.stringify({ noteType, content, authorUserId: req.actor.id }), ts);
  });

  tx();

  res.status(201).json({
    ok: true,
    note: { id: noteId, content, noteType, authorName: req.actor.full_name, createdAt: ts },
  });
});

app.post('/api/leads/:id/contact-log', requirePermission('communications.create'), (req, res) => {
  const orgId = getActorOrgId(req);
  const existing = db
    .prepare(`SELECT * FROM leads WHERE organization_id = ? AND id = ? LIMIT 1`)
    .get(orgId, req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Lead not found' });

  const channel = normalizeString(req.body?.channel || 'email').toLowerCase();
  const note = normalizeString(req.body?.note || 'Manual outreach');
  const ts = nowIso();
  const eventId = `evt_${crypto.randomUUID()}`;

  const communicationId = `com_${crypto.randomUUID()}`;

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO events (id, organization_id, lead_id, event_type, payload_json, created_at)
       VALUES (?, ?, ?, 'lead.manual_contact', ?, ?)`
    ).run(eventId, orgId, req.params.id, JSON.stringify({ channel, note }), ts);

    db.prepare(
      `INSERT INTO communications (id, organization_id, lead_id, channel, direction, actor_type, actor_name, summary, content, occurred_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'outbound', 'user', ?, ?, ?, ?, ?, ?)`
    ).run(communicationId, orgId, req.params.id, channel, req.actor?.full_name || 'Team User', note, note, ts, ts, ts);

    db.prepare(`UPDATE leads SET last_contacted_at = ?, updated_at = ? WHERE id = ?`).run(ts, ts, req.params.id);
  });

  tx();

  res.json({ ok: true, event: { id: eventId, eventType: 'lead.manual_contact', payload: { channel, note }, createdAt: ts } });
});

app.patch('/api/leads/:id/status', requirePermission('leads.updateStatus'), (req, res) => {
  const orgId = getActorOrgId(req);
  const nextStatus = normalizeString(req.body?.status).toLowerCase();
  if (!LEAD_STATUSES.has(nextStatus)) {
    return res.status(400).json({ ok: false, error: 'status must be one of new|contacted|booked|closed' });
  }

  const existing = db
    .prepare(`SELECT * FROM leads WHERE organization_id = ? AND id = ? LIMIT 1`)
    .get(orgId, req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Lead not found' });

  const ts = nowIso();
  const eventId = `evt_${crypto.randomUUID()}`;

  const tx = db.transaction(() => {
    db.prepare(`UPDATE leads SET status = ?, updated_at = ? WHERE id = ?`).run(nextStatus, ts, req.params.id);

    db.prepare(
      `INSERT INTO events (id, organization_id, lead_id, event_type, payload_json, created_at)
       VALUES (?, ?, ?, 'lead.status_changed', ?, ?)`
    ).run(eventId, orgId, req.params.id, JSON.stringify({ from: existing.status, to: nextStatus }), ts);
  });

  tx();

  const updated = db.prepare(`SELECT l.*, au.full_name AS assigned_user_name, ou.full_name AS owner_user_name FROM leads l LEFT JOIN users au ON au.id = l.assigned_user_id LEFT JOIN users ou ON ou.id = l.owner_user_id WHERE l.id = ? LIMIT 1`).get(req.params.id);
  res.json({ ok: true, lead: serializeLead(updated) });
});

app.patch('/api/leads/:id/urgency', requirePermission('leads.edit'), (req, res) => {
  const orgId = getActorOrgId(req);
  const urgencyStatus = normalizeString(req.body?.urgencyStatus).toLowerCase();
  if (!URGENCY_STATUSES.has(urgencyStatus)) {
    return res.status(400).json({ ok: false, error: 'urgencyStatus is invalid' });
  }

  const existing = db
    .prepare(`SELECT * FROM leads WHERE organization_id = ? AND id = ? LIMIT 1`)
    .get(orgId, req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Lead not found' });

  const ts = nowIso();
  const eventId = `evt_${crypto.randomUUID()}`;

  const tx = db.transaction(() => {
    db.prepare(`UPDATE leads SET urgency_status = ?, updated_at = ? WHERE id = ?`).run(urgencyStatus, ts, req.params.id);

    db.prepare(
      `INSERT INTO events (id, organization_id, lead_id, event_type, payload_json, created_at)
       VALUES (?, ?, ?, 'lead.urgency_changed', ?, ?)`
    ).run(eventId, orgId, req.params.id, JSON.stringify({ from: existing.urgency_status || 'warm', to: urgencyStatus }), ts);
  });

  tx();

  const updated = db.prepare(`SELECT l.*, au.full_name AS assigned_user_name, ou.full_name AS owner_user_name FROM leads l LEFT JOIN users au ON au.id = l.assigned_user_id LEFT JOIN users ou ON ou.id = l.owner_user_id WHERE l.id = ? LIMIT 1`).get(req.params.id);
  res.json({ ok: true, lead: serializeLead(updated) });
});

app.get('/api/dashboard/summary', requirePermission('reports.view'), (req, res) => {
  const orgId = getActorOrgId(req);
  const rows = db.prepare(`SELECT status, urgency_status, received_at FROM leads WHERE organization_id = ?`).all(orgId);
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const total = rows.length;
  const byStatus = Object.fromEntries([...LEAD_STATUSES].map((s) => [s, 0]));
  let hotLeads = 0;
  let needsAttentionLeads = 0;
  let recentInbound30d = 0;

  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
    if (row.urgency_status === 'hot') hotLeads += 1;
    if (row.urgency_status === 'needs_attention' || row.urgency_status === 'sla_risk') needsAttentionLeads += 1;
    if (new Date(row.received_at).getTime() >= thirtyDaysAgo) recentInbound30d += 1;
  }

  const conversionRate = total ? Math.round(((byStatus.booked || 0) / total) * 100) : 0;

  res.json({
    ok: true,
    summary: {
      totalLeads: total,
      newLeads: byStatus.new || 0,
      contactedLeads: byStatus.contacted || 0,
      bookedLeads: byStatus.booked || 0,
      closedLeads: byStatus.closed || 0,
      hotLeads,
      needsAttentionLeads,
      conversionRate,
      recentInbound30d,
    },
  });
});

app.get('/api/reports/status-summary', requirePermission('reports.view'), (req, res) => {
  const orgId = getActorOrgId(req);
  const rows = db
    .prepare(
      `SELECT status, urgency_status, COUNT(*) AS count
       FROM leads
       WHERE organization_id = ?
       GROUP BY status, urgency_status
       ORDER BY status ASC, urgency_status ASC`
    )
    .all(orgId)
    .map((row) => ({ status: row.status, urgencyStatus: row.urgency_status || 'warm', count: row.count }));

  res.json({ ok: true, rows });
});

app.get('/api/leads/:id/email-drafts', requirePermission('emailDrafts.manage'), (req, res) => {
  const orgId = getActorOrgId(req);
  const rows = db.prepare(`SELECT d.id, d.to_email, d.subject, d.body, d.status, d.source, d.created_at, COALESCE(u.full_name, 'System') AS created_by_name FROM email_drafts d LEFT JOIN users u ON u.id = d.created_by_user_id WHERE d.organization_id = ? AND d.lead_id = ? ORDER BY d.created_at DESC`).all(orgId, req.params.id);
  res.json({ ok: true, drafts: rows.map((row) => ({ id: row.id, toEmail: row.to_email, subject: row.subject, body: row.body, status: row.status, source: row.source, createdAt: row.created_at, createdByName: row.created_by_name })) });
});

app.post('/api/leads/:id/email-drafts', requirePermission('emailDrafts.manage'), (req, res) => {
  const orgId = getActorOrgId(req);
  const lead = db.prepare(`SELECT * FROM leads WHERE organization_id = ? AND id = ? LIMIT 1`).get(orgId, req.params.id);
  if (!lead) return res.status(404).json({ ok: false, error: 'Lead not found' });

  const toEmail = normalizeString(req.body?.toEmail || lead.email).toLowerCase();
  const subject = normalizeString(req.body?.subject);
  const body = normalizeString(req.body?.body);
  const source = normalizeString(req.body?.source || 'manual').toLowerCase();
  if (!providerKey) {
    const defaultAccount = getDefaultEmailAccountForOrg(orgId, req.actor);
    providerKey = defaultAccount?.provider_key || 'stub';
  }

  if (!toEmail) return res.status(400).json({ ok: false, error: 'toEmail is required' });
  if (!subject) return res.status(400).json({ ok: false, error: 'subject is required' });
  if (!body) return res.status(400).json({ ok: false, error: 'body is required' });

  const id = `edr_${crypto.randomUUID()}`;
  const eventId = `evt_${crypto.randomUUID()}`;
  const ts = nowIso();
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO email_drafts (id, organization_id, lead_id, to_email, subject, body, status, source, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`).run(id, orgId, req.params.id, toEmail, subject, body, source, req.actor.id, ts, ts);
    db.prepare(`INSERT INTO events (id, organization_id, lead_id, event_type, payload_json, created_at) VALUES (?, ?, ?, 'lead.email_draft_added', ?, ?)`).run(eventId, orgId, req.params.id, JSON.stringify({ toEmail, subject, source }), ts);
  });
  tx();
  res.status(201).json({ ok: true, draft: { id, toEmail, subject, body, status: 'draft', source, createdAt: ts, createdByName: req.actor.full_name } });
});

app.get('/api/email/providers', requirePermission('emailOutbox.manage'), (_req, res) => {
  res.json({ ok: true, providers: Object.values(PROVIDERS).map((p) => ({ key: p.key, label: p.label })) });
});

app.post('/api/email/providers/gmail/bootstrap', requirePermission('emailOutbox.manage'), (req, res) => {
  const gmail = loadGmailClientConfig();
  const saved = saveProviderSettingsRow(getActorOrgId(req), 'gmail', {
    status: 'ready_for_auth',
    client_id: gmail.clientId,
    client_secret: gmail.clientSecret,
    redirect_uri: gmail.redirectUri,
  });
  res.json({ ok: true, provider: { key: 'gmail', status: saved.status, clientId: saved.client_id, redirectUri: saved.redirect_uri } });
});

app.post('/api/email/providers/microsoft/bootstrap', requirePermission('emailOutbox.manage'), (req, res) => {
  const clientId = normalizeString(process.env.MICROSOFT_CLIENT_ID || '');
  const clientSecret = normalizeString(process.env.MICROSOFT_CLIENT_SECRET || '');
  const redirectUri = normalizeString(process.env.MICROSOFT_REDIRECT_URI || `${PUBLIC_APP_ORIGIN}/api/auth/microsoft/callback`);
  const saved = saveProviderSettingsRow(getActorOrgId(req), 'microsoft', {
    status: clientId && clientSecret ? 'ready_for_auth' : 'disconnected',
    client_id: clientId || undefined,
    client_secret: clientSecret || undefined,
    redirect_uri: redirectUri || undefined,
  });
  res.json({ ok: true, provider: { key: 'microsoft', status: saved.status, clientId: saved.client_id, redirectUri: saved.redirect_uri } });
});

app.get('/api/auth/gmail/start', requirePermission('emailOutbox.manage'), (req, res) => {
  const orgId = getActorOrgId(req);
  const accountId = normalizeString(req.query.accountId);
  const saved = getProviderSettings(orgId, 'gmail') || saveProviderSettingsRow(orgId, 'gmail', {});
  const clientId = saved?.client_id;
  const redirectUri = saved?.redirect_uri;
  if (!clientId || !redirectUri) return res.status(400).json({ ok: false, error: 'Gmail provider is missing client configuration' });
  const state = accountId ? `${orgId}:${accountId}` : orgId;
  const authUrl = buildAuthUrl({ clientId, redirectUri, state });
  res.json({ ok: true, authUrl, accountId: accountId || null });
});

app.get('/api/auth/gmail/callback', async (req, res) => {
  const rawState = normalizeString(req.query.state || req.query.orgId) || DEFAULT_ORG_ID;
  const [orgId, accountId] = rawState.includes(':') ? rawState.split(':') : [rawState, null];
  const code = normalizeString(req.query.code);
  const error = normalizeString(req.query.error);
  if (error) return res.status(400).send(`Gmail OAuth error: ${error}`);
  if (!code) return res.status(400).send('Missing OAuth code');

  try {
    const saved = getProviderSettings(orgId, 'gmail');
    if (!saved?.client_id || !saved?.client_secret || !saved?.redirect_uri) throw new Error('Gmail provider settings are incomplete');
    const tokens = await exchangeCodeForTokens({ clientId: saved.client_id, clientSecret: saved.client_secret, redirectUri: saved.redirect_uri, code });
    const profile = await fetchGoogleProfile(tokens.access_token);
    const config = saved.config_json ? JSON.parse(saved.config_json) : {};
    saveProviderSettingsRow(orgId, 'gmail', {
      status: 'connected',
      config: { ...config, email: profile.email || null },
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || saved.refresh_token,
      token_expires_at: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString(),
    });
    if (accountId) {
      const account = getEmailAccountById(accountId, orgId);
      if (account) {
        updateEmailAccount(accountId, orgId, {
          providerKey: 'gmail',
          status: 'connected',
          config: {
            ...(safeJsonParse(account.config_json, {})),
            gmailEmail: profile.email || null,
          },
          lastError: null,
        });
      }
    }
    return res.send(`Gmail connected for ${profile.email || 'account'}${accountId ? ' and linked to LeadSprint email account' : ''} — you can close this tab.`);
  } catch (err) {
    return res.status(500).send(`Gmail OAuth callback failed: ${err.message}`);
  }
});

app.get('/api/auth/microsoft/callback', async (req, res) => {
  const rawState = normalizeString(req.query.state || req.query.orgId) || DEFAULT_ORG_ID;
  const [orgId, accountId] = rawState.includes(':') ? rawState.split(':') : [rawState, null];
  const code = normalizeString(req.query.code);
  const error = normalizeString(req.query.error);
  if (error) return res.status(400).send(`Microsoft OAuth error: ${error}`);
  if (!code) return res.status(400).send('Missing OAuth code');

  try {
    const saved = getProviderSettings(orgId, 'microsoft');
    if (!saved?.client_id || !saved?.client_secret || !saved?.redirect_uri) throw new Error('Microsoft provider settings are incomplete');
    const tokens = await exchangeMicrosoftCodeForTokens({ clientId: saved.client_id, clientSecret: saved.client_secret, redirectUri: saved.redirect_uri, code });
    const profile = await fetchMicrosoftProfile(tokens.access_token);
    const config = saved.config_json ? JSON.parse(saved.config_json) : {};
    saveProviderSettingsRow(orgId, 'microsoft', {
      status: 'connected',
      config: { ...config, email: profile.mail || profile.userPrincipalName || null },
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || saved.refresh_token,
      token_expires_at: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString(),
    });
    if (accountId) {
      const account = getEmailAccountById(accountId, orgId);
      if (account) {
        updateEmailAccount(accountId, orgId, {
          providerKey: 'microsoft',
          status: 'connected',
          config: {
            ...(safeJsonParse(account.config_json, {})),
            microsoftEmail: profile.mail || profile.userPrincipalName || null,
          },
          lastError: null,
        });
      }
    }
    return res.send(`Microsoft connected for ${profile.mail || profile.userPrincipalName || 'account'}${accountId ? ' and linked to LeadSprint email account' : ''} — you can close this tab.`);
  } catch (err) {
    return res.status(500).send(`Microsoft OAuth callback failed: ${err.message}`);
  }
});


app.get('/api/settings/email', requirePermission('emailOutbox.manage'), (req, res) => {
  const orgId = getActorOrgId(req);
  const accounts = listEmailAccountsForOrg(orgId).map((account) => ({ ...account, syncState: getEmailSyncState(account.id) || null }));
  const syncRuns = db.prepare(`SELECT * FROM email_sync_runs WHERE organization_id = ? ORDER BY started_at DESC LIMIT 25`).all(orgId);
  res.json({ ok: true, policy: getEmailPolicyForOrg(orgId), accounts, syncRuns });
});
app.get('/api/email/accounts/sendable', requirePermission('emailOutbox.manage'), (req, res) => {
  const orgId = getActorOrgId(req);
  const rows = getSelectableEmailAccountsForActor(orgId, req.actor);
  res.json({ ok: true, accounts: rows.map(serializeEmailAccount) });
});


app.put('/api/settings/email/policy', requirePermission('settings.manageBusiness'), (req, res) => {
  const orgId = getActorOrgId(req);
  const policy = saveEmailPolicyForOrg(orgId, req.body || {});
  res.json({ ok: true, policy });
});

app.post('/api/settings/email/accounts', requirePermission('emailOutbox.manage'), (req, res) => {
  const orgId = getActorOrgId(req);
  const actor = req.actor;
  const body = req.body || {};
  const scopeType = normalizeString(body.scopeType || 'organization');
  const emailAddress = normalizeString(body.emailAddress).toLowerCase();
  if (!emailAddress) return res.status(400).json({ ok: false, error: 'emailAddress is required' });

  const policy = getEmailPolicyForOrg(orgId);
  let userId = null;
  if (scopeType === 'user') {
    if (!policy.allow_user_mailboxes) return res.status(403).json({ ok: false, error: 'User-level mailboxes are not enabled for this workspace' });
    if (!policy.allowed_user_mailbox_roles.includes(actor.role) && !PLATFORM_ROLES.has(actor.role)) {
      return res.status(403).json({ ok: false, error: 'Your role may not connect a personal mailbox' });
    }
    userId = actor.id;
  }

  const created = createEmailAccount({
    organizationId: orgId,
    userId,
    scopeType: scopeType === 'user' ? 'user' : 'organization',
    providerType: normalizeString(body.providerType || 'stub') || 'stub',
    providerKey: normalizeString(body.providerKey) || null,
    accountRole: normalizeString(body.accountRole || 'inbox_and_send') || 'inbox_and_send',
    emailAddress,
    displayName: normalizeString(body.displayName) || null,
    signature: normalizeString(body.signature) || null,
    authMethod: normalizeString(body.authMethod || 'oauth') || 'oauth',
    capabilities: Array.isArray(body.capabilities) ? body.capabilities : ['send'],
    config: body.config && typeof body.config === 'object' ? body.config : {},
    status: normalizeString(body.status || 'disconnected') || 'disconnected',
    isDefaultForOrg: Boolean(body.isDefaultForOrg),
    isDefaultForUser: Boolean(body.isDefaultForUser),
  });

  res.status(201).json({ ok: true, account: serializeEmailAccount(created) });
});

app.post('/api/settings/email/accounts/:id/default', requirePermission('emailOutbox.manage'), (req, res) => {
  const orgId = getActorOrgId(req);
  const account = getEmailAccountById(req.params.id, orgId);
  if (!account) return res.status(404).json({ ok: false, error: 'Email account not found' });
  const updated = updateEmailAccount(account.id, orgId, {
    isDefaultForOrg: account.scope_type === 'organization',
    isDefaultForUser: account.scope_type === 'user',
  });
  res.json({ ok: true, account: serializeEmailAccount(updated) });
});

app.post('/api/settings/email/accounts/:id/disconnect', requirePermission('emailOutbox.manage'), (req, res) => {
  const orgId = getActorOrgId(req);
  const account = getEmailAccountById(req.params.id, orgId);
  if (!account) return res.status(404).json({ ok: false, error: 'Email account not found' });
  const updated = updateEmailAccount(account.id, orgId, { status: 'disconnected', lastError: null, providerKey: account.provider_key });
  res.json({ ok: true, account: serializeEmailAccount(updated) });
});

app.delete('/api/settings/email/accounts/:id', requirePermission('emailOutbox.manage'), (req, res) => {
  const orgId = getActorOrgId(req);
  const account = getEmailAccountById(req.params.id, orgId);
  if (!account) return res.status(404).json({ ok: false, error: 'Email account not found' });
  db.prepare(`DELETE FROM email_accounts WHERE id = ? AND organization_id = ?`).run(account.id, orgId);
  res.json({ ok: true, removedId: account.id });
});

app.post('/api/settings/email/accounts/:id/connect-gmail', requirePermission('emailOutbox.manage'), (req, res) => {
  const orgId = getActorOrgId(req);
  const account = getEmailAccountById(req.params.id, orgId);
  if (!account) return res.status(404).json({ ok: false, error: 'Email account not found' });
  if (account.provider_type !== 'google') return res.status(400).json({ ok: false, error: 'Only Google email accounts can use Gmail OAuth' });

  const saved = getProviderSettings(orgId, 'gmail') || saveProviderSettingsRow(orgId, 'gmail', {});
  const clientId = saved?.client_id;
  const redirectUri = saved?.redirect_uri;
  if (!clientId || !redirectUri) return res.status(400).json({ ok: false, error: 'Gmail provider is missing client configuration' });

  updateEmailAccount(account.id, orgId, { providerKey: 'gmail', status: 'needs_reauth' });
  const authUrl = buildAuthUrl({ clientId, redirectUri, state: `${orgId}:${account.id}` });
  res.json({ ok: true, authUrl, account: serializeEmailAccount(getEmailAccountById(account.id, orgId)) });
});


app.post('/api/settings/email/accounts/:id/connect-microsoft', requirePermission('emailOutbox.manage'), (req, res) => {
  const orgId = getActorOrgId(req);
  const account = getEmailAccountById(req.params.id, orgId);
  if (!account) return res.status(404).json({ ok: false, error: 'Email account not found' });
  if (account.provider_type !== 'microsoft') return res.status(400).json({ ok: false, error: 'Only Microsoft email accounts can use Microsoft OAuth' });

  const saved = getProviderSettings(orgId, 'microsoft') || saveProviderSettingsRow(orgId, 'microsoft', {});
  const clientId = saved?.client_id;
  const redirectUri = saved?.redirect_uri;
  if (!clientId || !redirectUri) return res.status(400).json({ ok: false, error: 'Microsoft provider is missing client configuration' });

  updateEmailAccount(account.id, orgId, { providerKey: 'microsoft', status: 'needs_reauth' });
  const authUrl = buildMicrosoftAuthUrl({ clientId, redirectUri, state: `${orgId}:${account.id}` });
  res.json({ ok: true, authUrl, account: serializeEmailAccount(getEmailAccountById(account.id, orgId)) });
});


app.post('/api/settings/email/accounts/:id/sync-mode', requirePermission('emailOutbox.manage'), (req, res) => {
  const orgId = getActorOrgId(req);
  const account = getEmailAccountById(req.params.id, orgId);
  if (!account) return res.status(404).json({ ok: false, error: 'Email account not found' });
  const syncMode = ['manual', 'background'].includes(normalizeString(req.body?.syncMode)) ? normalizeString(req.body?.syncMode) : 'manual';
  const existing = getEmailSyncState(account.id);
  const state = upsertEmailSyncState({ organizationId: orgId, emailAccountId: account.id, providerKey: account.provider_key || account.provider_type || 'unknown', syncMode, lastCursor: existing?.last_cursor || null, lastSyncedAt: existing?.last_synced_at || null, lastStatus: existing?.last_status || 'idle', lastError: existing?.last_error || null });
  res.json({ ok: true, syncState: state });
});

app.post('/api/settings/email/accounts/:id/verify', requirePermission('emailOutbox.manage'), async (req, res) => {
  const orgId = getActorOrgId(req);
  const account = getEmailAccountById(req.params.id, orgId);
  if (!account) return res.status(404).json({ ok: false, error: 'Email account not found' });

  const providerKey = account.provider_key || account.provider_type || 'stub';
  const provider = getProvider(providerKey);
  if (!provider?.verify) return res.status(400).json({ ok: false, error: 'This provider does not support verification' });

  try {
    const providerSettings = providerKey ? getProviderSettings(orgId, providerKey) : null;
    const result = await provider.verify({
      providerSettings,
      emailAccount: account,
      saveProviderSettings: (patch) => saveProviderSettingsRow(orgId, providerKey, patch),
    });
    const updated = updateEmailAccount(account.id, orgId, { status: 'connected', lastError: null });
    res.json({ ok: true, verification: result, account: serializeEmailAccount(updated) });
  } catch (error) {
    const updated = updateEmailAccount(account.id, orgId, { status: 'degraded', lastError: error?.message || 'Verification failed' });
    res.status(400).json({ ok: false, error: error?.message || 'Verification failed', account: serializeEmailAccount(updated) });
  }
});

app.post('/api/settings/email/accounts/:id/sync', requirePermission('communications.view'), async (req, res) => {
  const orgId = getActorOrgId(req);
  const account = getEmailAccountById(req.params.id, orgId);
  if (!account) return res.status(404).json({ ok: false, error: 'Email account not found' });
  try {
    const providerKey = account.provider_key || account.provider_type;
    if (!['gmail', 'microsoft'].includes(providerKey)) {
      return res.status(400).json({ ok: false, error: 'Manual sync is currently implemented for Gmail and Microsoft accounts only' });
    }
    const result = await runEmailSyncForAccount({ emailAccountId: account.id, workerId: `manual:${req.actor.id}` });
    res.json({ ok: true, result, account: serializeEmailAccount(getEmailAccountById(account.id, orgId)) });
  } catch (error) {
    const updated = updateEmailAccount(account.id, orgId, { status: 'degraded', lastError: error?.message || 'Sync failed' });
    upsertEmailSyncState({ organizationId: orgId, emailAccountId: account.id, providerKey: account.provider_key || account.provider_type || 'unknown', syncMode: getEmailSyncState(account.id)?.sync_mode || 'manual', lastCursor: getEmailSyncState(account.id)?.last_cursor || null, lastSyncedAt: getEmailSyncState(account.id)?.last_synced_at || null, lastStatus: 'error', lastError: error?.message || 'Sync failed' });
    res.status(400).json({ ok: false, error: error?.message || 'Sync failed', account: serializeEmailAccount(updated) });
  }
});

app.post('/api/settings/email/accounts/:id/test-send', requirePermission('emailOutbox.manage'), async (req, res) => {
  const orgId = getActorOrgId(req);
  const account = getEmailAccountById(req.params.id, orgId);
  if (!account) return res.status(404).json({ ok: false, error: 'Email account not found' });
  const toEmail = normalizeString(req.body?.toEmail || req.actor.email).toLowerCase();
  if (!toEmail) return res.status(400).json({ ok: false, error: 'Test recipient email is required' });

  const providerKey = account.provider_key || account.provider_type || 'stub';
  const provider = getProvider(providerKey);
  try {
    const providerSettings = providerKey ? getProviderSettings(orgId, providerKey) : null;
    const result = await provider.send({
      toEmail,
      subject: `[LeadSprint] Test email from ${account.email_address}`,
      body: `This is a LeadSprint test email for ${account.email_address}. If you received it, the account transport is working.`,
      providerSettings,
      emailAccount: account,
      saveProviderSettings: (patch) => saveProviderSettingsRow(orgId, providerKey, patch),
    });
    const updated = updateEmailAccount(account.id, orgId, { status: 'connected', lastError: null, lastSendAt: nowIso() });
    res.json({ ok: true, result, account: serializeEmailAccount(updated) });
  } catch (error) {
    const updated = updateEmailAccount(account.id, orgId, { status: 'degraded', lastError: error?.message || 'Test send failed' });
    res.status(400).json({ ok: false, error: error?.message || 'Test send failed', account: serializeEmailAccount(updated) });
  }
});

app.put('/api/settings/email/accounts/:id/config', requirePermission('emailOutbox.manage'), (req, res) => {
  const orgId = getActorOrgId(req);
  const account = getEmailAccountById(req.params.id, orgId);
  if (!account) return res.status(404).json({ ok: false, error: 'Email account not found' });
  const currentConfig = safeJsonParse(account.config_json, {});
  const config = req.body?.config && typeof req.body.config === 'object' ? req.body.config : {};
  const mergedConfig = { ...currentConfig, ...config };
  const nextProviderKey = req.body?.providerKey ? normalizeString(req.body.providerKey) : account.provider_key;
  let nextStatus = req.body?.status ? normalizeString(req.body.status) : account.status;

  if ((account.provider_type === 'imap_smtp' || account.provider_type === 'smtp_only') && nextProviderKey === 'imap_smtp') {
    const hasSmtp = Boolean(mergedConfig.smtpHost && mergedConfig.smtpPort && mergedConfig.smtpUsername);
    nextStatus = hasSmtp ? 'connected' : 'degraded';
  }

  const updated = updateEmailAccount(account.id, orgId, {
    config: mergedConfig,
    status: nextStatus,
    providerKey: nextProviderKey,
  });
  res.json({ ok: true, account: serializeEmailAccount(updated) });
});

app.get('/api/email/provider-settings', requirePermission('emailOutbox.manage'), (req, res) => {
  const orgId = getActorOrgId(req);
  const rows = db.prepare(`SELECT provider_key, status, config_json, updated_at FROM email_provider_settings WHERE organization_id = ? ORDER BY provider_key ASC`).all(orgId);
  res.json({ ok: true, providers: Object.values(PROVIDERS).map((provider) => {
    const row = rows.find((r) => r.provider_key === provider.key);
    return {
      key: provider.key,
      label: provider.label,
      needsAuth: !!provider.needsAuth,
      status: row?.status || 'disconnected',
      config: row?.config_json ? JSON.parse(row.config_json) : {},
      clientId: row?.client_id || null,
      redirectUri: row?.redirect_uri || null,
      updatedAt: row?.updated_at || null,
    };
  }) });
});

app.put('/api/email/provider-settings/:providerKey', requirePermission('emailOutbox.manage'), (req, res) => {
  const providerKey = normalizeString(req.params.providerKey);
  if (!PROVIDERS[providerKey]) return res.status(404).json({ ok: false, error: 'Unknown provider' });

  const status = normalizeString(req.body?.status || 'configured') || 'configured';
  const config = req.body?.config && typeof req.body.config === 'object' ? req.body.config : {};
  const saved = saveProviderSettingsRow(getActorOrgId(req), providerKey, {
    status,
    config,
    client_id: normalizeString(req.body?.clientId) || undefined,
    client_secret: normalizeString(req.body?.clientSecret) || undefined,
    redirect_uri: normalizeString(req.body?.redirectUri) || undefined,
  });
  res.json({ ok: true, provider: { key: providerKey, status: saved.status, config: saved.config_json ? JSON.parse(saved.config_json) : {}, clientId: saved.client_id || null, redirectUri: saved.redirect_uri || null, updatedAt: saved.updated_at } });
});

app.get('/api/leads/:id/email-outbox', requirePermission('emailOutbox.manage'), (req, res) => {
  const orgId = getActorOrgId(req);
  const rows = db.prepare(`SELECT o.*, COALESCE(u.full_name, 'System') AS created_by_name, ea.email_address AS sender_email_address, ea.display_name AS sender_display_name FROM email_outbox o LEFT JOIN users u ON u.id = o.created_by_user_id LEFT JOIN events e ON e.organization_id = o.organization_id AND e.lead_id = o.lead_id AND e.event_type = 'lead.email_queued' AND json_extract(e.payload_json, '$.toEmail') = o.to_email AND json_extract(e.payload_json, '$.subject') = o.subject LEFT JOIN email_accounts ea ON ea.id = json_extract(e.payload_json, '$.emailAccountId') WHERE o.organization_id = ? AND o.lead_id = ? ORDER BY o.created_at DESC`).all(orgId, req.params.id);
  res.json({ ok: true, items: rows.map(serializeOutboxItem) });
});

app.post('/api/leads/:id/email-outbox', requirePermission('emailOutbox.manage'), (req, res) => {
  const orgId = getActorOrgId(req);
  const lead = db.prepare(`SELECT * FROM leads WHERE organization_id = ? AND id = ? LIMIT 1`).get(orgId, req.params.id);
  if (!lead) return res.status(404).json({ ok: false, error: 'Lead not found' });

  const emailDraftId = normalizeString(req.body?.emailDraftId) || null;
  let toEmail = normalizeString(req.body?.toEmail || lead.email).toLowerCase();
  let subject = normalizeString(req.body?.subject);
  let body = normalizeString(req.body?.body);
  const emailAccountId = normalizeString(req.body?.emailAccountId) || null;
  let providerKey = normalizeString(req.body?.providerKey || '') || null;

  if (emailDraftId) {
    const draft = db.prepare(`SELECT * FROM email_drafts WHERE organization_id = ? AND lead_id = ? AND id = ? LIMIT 1`).get(orgId, req.params.id, emailDraftId);
    if (!draft) return res.status(404).json({ ok: false, error: 'Email draft not found' });
    toEmail = toEmail || draft.to_email;
    subject = subject || draft.subject;
    body = body || draft.body;
  }

  const selectedAccount = resolveEmailAccountForSend(orgId, req.actor, emailAccountId, providerKey);
  providerKey = selectedAccount?.provider_key || selectedAccount?.provider_type || providerKey || 'stub';
  if (selectedAccount) {
    const capabilities = safeJsonParse(selectedAccount.capabilities_json || '[]', []);
    if (!capabilities.includes('send')) return res.status(400).json({ ok: false, error: 'Selected email account cannot send outbound email' });
    if (!['connected', 'needs_reauth', 'degraded'].includes(selectedAccount.status) && providerKey !== 'stub') {
      return res.status(400).json({ ok: false, error: 'Selected email account is not ready for outbound use' });
    }
  }

  if (!toEmail) return res.status(400).json({ ok: false, error: 'toEmail is required' });
  if (!subject) return res.status(400).json({ ok: false, error: 'subject is required' });
  if (!body) return res.status(400).json({ ok: false, error: 'body is required' });

  const id = `out_${crypto.randomUUID()}`;
  const eventId = `evt_${crypto.randomUUID()}`;
  const ts = nowIso();

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO email_outbox (id, organization_id, lead_id, email_draft_id, to_email, subject, body, provider_key, send_status, queued_at, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?)`).run(id, orgId, req.params.id, emailDraftId, toEmail, subject, body, providerKey, ts, req.actor.id, ts, ts);
    db.prepare(`INSERT INTO events (id, organization_id, lead_id, event_type, payload_json, created_at) VALUES (?, ?, ?, 'lead.email_queued', ?, ?)`).run(eventId, orgId, req.params.id, JSON.stringify({ toEmail, subject, providerKey, emailDraftId, emailAccountId: selectedAccount?.id || null }), ts);
  });
  tx();

  res.status(201).json({ ok: true, item: { id, emailDraftId, emailAccountId: selectedAccount?.id || null, toEmail, subject, body, providerKey, sendStatus: 'queued', queuedAt: ts, createdAt: ts, createdByName: req.actor.full_name } });
});


async function processOutboxRow(item, actorName) {
  const provider = getProvider(item.provider_key || 'stub');
  let providerSettings = item.provider_key ? getProviderSettings(item.organization_id, item.provider_key) : null;

  const queuedEvent = db.prepare(`SELECT payload_json FROM events WHERE organization_id = ? AND lead_id = ? AND event_type = 'lead.email_queued' AND json_extract(payload_json, '$.toEmail') = ? AND json_extract(payload_json, '$.subject') = ? ORDER BY created_at DESC LIMIT 1`).get(item.organization_id, item.lead_id, item.to_email, item.subject);
  const payload = queuedEvent?.payload_json ? safeJsonParse(queuedEvent.payload_json, {}) : {};
  const emailAccountId = payload?.emailAccountId || null;
  const emailAccount = emailAccountId ? getEmailAccountById(emailAccountId, item.organization_id) : null;

  if (emailAccount && (item.provider_key === 'imap_smtp' || emailAccount.provider_key === 'imap_smtp')) {
    providerSettings = {
      ...(providerSettings || {}),
      config_json: JSON.stringify(safeJsonParse(emailAccount.config_json || '{}', {})),
      status: emailAccount.status,
    };
  }

  const result = await provider.send({
    toEmail: item.to_email,
    subject: item.subject,
    body: item.body,
    providerSettings,
    emailAccount,
    saveProviderSettings: (patch) => saveProviderSettingsRow(item.organization_id, item.provider_key || 'stub', patch),
  });
  const ts = nowIso();
  const tx = db.transaction(() => {
    db.prepare(`UPDATE email_outbox SET send_status = 'sent', sent_at = ?, failed_at = NULL, last_error = NULL, updated_at = ? WHERE id = ?`).run(ts, ts, item.id);
    db.prepare(`INSERT INTO communications (id, organization_id, lead_id, channel, direction, actor_type, actor_name, subject, summary, content, occurred_at, created_at, updated_at) VALUES (?, ?, ?, 'email', 'outbound', 'user', ?, ?, ?, ?, ?, ?, ?)`).run(`com_${crypto.randomUUID()}`, item.organization_id, item.lead_id, actorName, item.subject, 'Email sent from outbox', item.body, ts, ts, ts);
    db.prepare(`INSERT INTO events (id, organization_id, lead_id, event_type, payload_json, created_at) VALUES (?, ?, ?, 'lead.email_sent', ?, ?)`).run(`evt_${crypto.randomUUID()}`, item.organization_id, item.lead_id, JSON.stringify({ outboxId: item.id, providerKey: item.provider_key || 'stub', providerMessageId: result.providerMessageId || null, emailAccountId: emailAccountId || null, senderEmail: emailAccount?.email_address || null }), ts);
    db.prepare(`UPDATE leads SET last_contacted_at = ?, updated_at = ? WHERE id = ?`).run(ts, ts, item.lead_id);
  });
  tx();
  return db.prepare(`SELECT o.*, COALESCE(u.full_name, 'System') AS created_by_name, ea.email_address AS sender_email_address, ea.display_name AS sender_display_name FROM email_outbox o LEFT JOIN users u ON u.id = o.created_by_user_id LEFT JOIN events e ON e.organization_id = o.organization_id AND e.lead_id = o.lead_id AND e.event_type = 'lead.email_queued' AND json_extract(e.payload_json, '$.toEmail') = o.to_email AND json_extract(e.payload_json, '$.subject') = o.subject LEFT JOIN email_accounts ea ON ea.id = json_extract(e.payload_json, '$.emailAccountId') WHERE o.id = ? LIMIT 1`).get(item.id);
}

app.post('/api/email-outbox/:id/process', requirePermission('emailOutbox.manage'), async (req, res) => {
  const orgId = getActorOrgId(req);
  const item = db.prepare(`SELECT * FROM email_outbox WHERE id = ? AND organization_id = ? LIMIT 1`).get(req.params.id, orgId);
  if (!item) return res.status(404).json({ ok: false, error: 'Outbox item not found' });
  if (item.send_status === 'sent') return res.json({ ok: true, item: serializeOutboxItem({ ...item, created_by_name: req.actor.full_name }) });

  try {
    const updated = await processOutboxRow(item, req.actor.full_name);
    res.json({ ok: true, item: serializeOutboxItem(updated) });
  } catch (error) {
    const ts = nowIso();
    db.prepare(`UPDATE email_outbox SET send_status = 'failed', failed_at = ?, last_error = ?, updated_at = ? WHERE id = ?`).run(ts, error?.message || 'Unknown error', ts, item.id);
    res.status(500).json({ ok: false, error: error?.message || 'Email send failed' });
  }
});

app.post('/api/leads/:id/email-outbox/process', requirePermission('emailOutbox.manage'), async (req, res) => {
  const orgId = getActorOrgId(req);
  const rows = db.prepare(`SELECT o.*, COALESCE(u.full_name, 'System') AS created_by_name FROM email_outbox o LEFT JOIN users u ON u.id = o.created_by_user_id WHERE o.organization_id = ? AND o.lead_id = ? AND o.send_status != 'sent' ORDER BY o.created_at ASC`).all(orgId, req.params.id);
  if (!rows.length) return res.json({ ok: true, processed: [], failed: [], summary: { requested: 0, processed: 0, failed: 0 } });

  const processed = [];
  const failed = [];
  for (const item of rows) {
    try {
      const updated = await processOutboxRow(item, req.actor.full_name);
      processed.push(serializeOutboxItem(updated));
    } catch (error) {
      const ts = nowIso();
      db.prepare(`UPDATE email_outbox SET send_status = 'failed', failed_at = ?, last_error = ?, updated_at = ? WHERE id = ?`).run(ts, error?.message || 'Unknown error', ts, item.id);
      const failedRow = db.prepare(`SELECT o.*, COALESCE(u.full_name, 'System') AS created_by_name, ea.email_address AS sender_email_address, ea.display_name AS sender_display_name FROM email_outbox o LEFT JOIN users u ON u.id = o.created_by_user_id LEFT JOIN events e ON e.organization_id = o.organization_id AND e.lead_id = o.lead_id AND e.event_type = 'lead.email_queued' AND json_extract(e.payload_json, '$.toEmail') = o.to_email AND json_extract(e.payload_json, '$.subject') = o.subject LEFT JOIN email_accounts ea ON ea.id = json_extract(e.payload_json, '$.emailAccountId') WHERE o.id = ? LIMIT 1`).get(item.id);
      failed.push(serializeOutboxItem(failedRow));
    }
  }

  res.json({ ok: true, processed, failed, summary: { requested: rows.length, processed: processed.length, failed: failed.length } });
});

app.get('/api/settings/business', requirePermission('settings.manageBusiness'), (req, res) => {
  const orgId = getActorOrgId(req);
  const row = db
    .prepare(`SELECT * FROM settings WHERE organization_id = ? AND key = ? LIMIT 1`)
    .get(orgId, BUSINESS_SETTINGS_KEY);

  const settings = row ? JSON.parse(row.value_json) : defaultBusinessSettings;
  res.json({ ok: true, settings, updatedAt: row?.updated_at || null });
});

app.put('/api/settings/business', requirePermission('settings.manageBusiness'), (req, res) => {
  const orgId = getActorOrgId(req);
  const current = db
    .prepare(`SELECT * FROM settings WHERE organization_id = ? AND key = ? LIMIT 1`)
    .get(orgId, BUSINESS_SETTINGS_KEY);

  const incoming = req.body || {};
  const next = {
    businessName: normalizeString(incoming.businessName) || DEFAULT_ORG_NAME,
    timezone: normalizeString(incoming.timezone) || 'America/New_York',
    bookingLink: normalizeString(incoming.bookingLink) || 'https://calendly.com/your-link',
    hours: incoming.hours && typeof incoming.hours === 'object' ? incoming.hours : defaultBusinessSettings.hours,
  };

  const ts = nowIso();
  if (current) {
    db.prepare(`UPDATE settings SET value_json = ?, updated_at = ? WHERE id = ?`).run(
      JSON.stringify(next),
      ts,
      current.id
    );
  } else {
    db.prepare(
      `INSERT INTO settings (id, organization_id, key, value_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(`set_${crypto.randomUUID()}`, orgId, BUSINESS_SETTINGS_KEY, JSON.stringify(next), ts, ts);
  }

  const currentOrg = db.prepare(`SELECT * FROM organizations WHERE id = ? LIMIT 1`).get(orgId);
  const nextSlug = ensureUniqueWorkspaceSlug(next.businessName || currentOrg?.name || orgId, orgId);
  db.prepare(`UPDATE organizations SET name = ?, timezone = ?, slug = ?, updated_at = ? WHERE id = ?`).run(
    next.businessName,
    next.timezone,
    nextSlug,
    ts,
    orgId
  );

  res.json({ ok: true, settings: next, updatedAt: ts });
});

app.get('/api/templates/first-response', requirePermission('settings.manageTemplates'), (req, res) => {
  const orgId = getActorOrgId(req);
  const row = db
    .prepare(`SELECT * FROM templates WHERE organization_id = ? AND key = ? LIMIT 1`)
    .get(orgId, FIRST_RESPONSE_TEMPLATE_KEY);

  res.json({
    ok: true,
    template: {
      id: row.id,
      key: row.key,
      name: row.name,
      body: row.body,
      isEnabled: Boolean(row.is_enabled),
      updatedAt: row.updated_at,
    },
  });
});

app.put('/api/templates/first-response', requirePermission('settings.manageTemplates'), (req, res) => {
  const orgId = getActorOrgId(req);
  const body = normalizeString(req.body?.body);
  const isEnabled = Boolean(req.body?.isEnabled);

  if (!body) return res.status(400).json({ ok: false, error: 'Template body is required' });

  const row = db
    .prepare(`SELECT * FROM templates WHERE organization_id = ? AND key = ? LIMIT 1`)
    .get(orgId, FIRST_RESPONSE_TEMPLATE_KEY);

  const ts = nowIso();
  const versionId = `tplv_${crypto.randomUUID()}`;

  const tx = db.transaction(() => {
    db.prepare(`UPDATE templates SET body = ?, is_enabled = ?, updated_at = ? WHERE id = ?`).run(
      body,
      isEnabled ? 1 : 0,
      ts,
      row.id
    );

    db.prepare(`INSERT INTO template_versions (id, template_id, body, changed_at) VALUES (?, ?, ?, ?)`).run(
      versionId,
      row.id,
      body,
      ts
    );
  });

  tx();

  res.json({
    ok: true,
    template: {
      id: row.id,
      key: row.key,
      name: row.name,
      body,
      isEnabled,
      updatedAt: ts,
    },
  });
});

app.get('/api/templates/first-response/versions', requirePermission('settings.manageTemplates'), (req, res) => {
  const orgId = getActorOrgId(req);
  const row = db
    .prepare(`SELECT id FROM templates WHERE organization_id = ? AND key = ? LIMIT 1`)
    .get(orgId, FIRST_RESPONSE_TEMPLATE_KEY);

  const versions = db
    .prepare(
      `SELECT id, body, changed_at FROM template_versions WHERE template_id = ? ORDER BY changed_at DESC LIMIT 20`
    )
    .all(row.id)
    .map((v) => ({ id: v.id, body: v.body, changedAt: v.changed_at }));

  res.json({ ok: true, versions });
});

app.post('/api/templates/first-response/revert', requirePermission('settings.manageTemplates'), (req, res) => {
  const orgId = getActorOrgId(req);
  const versionId = normalizeString(req.body?.versionId);
  if (!versionId) return res.status(400).json({ ok: false, error: 'versionId is required' });

  const template = db
    .prepare(`SELECT * FROM templates WHERE organization_id = ? AND key = ? LIMIT 1`)
    .get(orgId, FIRST_RESPONSE_TEMPLATE_KEY);

  const version = db
    .prepare(`SELECT * FROM template_versions WHERE id = ? AND template_id = ? LIMIT 1`)
    .get(versionId, template.id);

  if (!version) return res.status(404).json({ ok: false, error: 'Template version not found' });

  const ts = nowIso();
  const newVersionId = `tplv_${crypto.randomUUID()}`;

  const tx = db.transaction(() => {
    db.prepare(`UPDATE templates SET body = ?, updated_at = ? WHERE id = ?`).run(version.body, ts, template.id);
    db.prepare(`INSERT INTO template_versions (id, template_id, body, changed_at) VALUES (?, ?, ?, ?)`).run(
      newVersionId,
      template.id,
      version.body,
      ts
    );
  });

  tx();

  res.json({
    ok: true,
    template: {
      id: template.id,
      key: template.key,
      name: template.name,
      body: version.body,
      isEnabled: Boolean(template.is_enabled),
      updatedAt: ts,
    },
  });
});

app.post('/api/templates/first-response/preview', requirePermission('settings.manageTemplates'), (req, res) => {
  const body = normalizeString(req.body?.body || defaultTemplateBody);
  const vars = {
    name: normalizeString(req.body?.name) || 'there',
    business_name: normalizeString(req.body?.businessName) || DEFAULT_ORG_NAME,
    booking_link: normalizeString(req.body?.bookingLink) || 'https://calendly.com/your-link',
  };

  res.json({ ok: true, preview: renderTemplate(body, vars), vars });
});

const port = process.env.PORT || 4000;

function startServer() {
  return app.listen(port, () => console.log(`API listening on :${port}`));
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, syncGmailInboundForAccount, syncMicrosoftInboundForAccount, runEmailSyncForAccount, runDueEmailSyncs, claimDueEmailSyncAccounts, getEmailSyncState, upsertEmailSyncState };
