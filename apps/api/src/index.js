const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ensureDb, runMigrations, nowIso } = require('./db');
const { getProvider, PROVIDERS } = require('./email');
const { buildAuthUrl, exchangeCodeForTokens, fetchGoogleProfile } = require('./gmail-oauth');
const { runDraftOnlyLeadResponse } = require('./ai');

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
const USER_ROLES = new Set(['platform_owner', 'platform_admin', 'platform_sme', 'platform_agent', 'company_owner', 'company_admin', 'company_agent']);
const PLATFORM_ROLES = new Set(['platform_owner', 'platform_admin', 'platform_sme', 'platform_agent']);
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

db.prepare(`INSERT OR IGNORE INTO organizations (id, name, timezone) VALUES (?, ?, ?)`).run(
  DEFAULT_ORG_ID,
  DEFAULT_ORG_NAME,
  'America/New_York'
);

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
    actor = db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(id);
  }

  if (actor && actor.email.toLowerCase() === platformOwnerEmail && actor.role !== 'platform_owner') {
    db.prepare(`UPDATE users SET role = 'platform_owner', updated_at = ? WHERE id = ?`).run(nowIso(), actor.id);
    actor = { ...actor, role: 'platform_owner' };
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

  const email = identity.email || defaultOwnerEmail;
  if (!email) return null;

  return ensureBootstrapActor(identity) || db
    .prepare(`SELECT * FROM users WHERE organization_id = ? AND email = ? LIMIT 1`)
    .get(DEFAULT_ORG_ID, email);
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
  const allowUnsignedDev = process.env.NODE_ENV !== 'production' && !INTERNAL_API_AUTH_SECRET;
  if (!identity.verified && !allowUnsignedDev) {
    return res.status(401).json({ ok: false, error: 'Verified internal identity is required' });
  }

  const actor = getActor(req);
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

  const allowUnsignedDev = process.env.NODE_ENV !== 'production' && !INTERNAL_API_AUTH_SECRET;
  if (!identity.verified && !allowUnsignedDev) {
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

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO organizations (id, name, timezone, workspace_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).run(orgId, orgName, 'America/New_York', workspaceType, ts, ts);
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
  return { organization: { id: orgId, name: orgName, workspaceType }, user: { id: userId, email, role: 'company_owner' } };
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
  return req.actor?.organization_id || DEFAULT_ORG_ID;
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
  const actor = getActor(req);
  if (actor && PLATFORM_ROLES.has(actor.role)) {
    const org = db.prepare(`SELECT * FROM organizations WHERE id = ? LIMIT 1`).get(actor.organization_id);
    return res.json({
      ok: true,
      state: 'approved',
      workspace: {
        id: org?.id || actor.organization_id,
        name: org?.name || DEFAULT_ORG_NAME,
        workspaceType: 'platform',
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
        workspaceType: workspace.workspace_type,
      },
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
    model_policy_json: JSON.stringify(incoming.modelPolicy && typeof incoming.modelPolicy === 'object' ? incoming.modelPolicy : (current?.model_policy || { primaryProvider: 'stub', allowedModels: ['stub/draft-v1'] })),
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

app.post('/api/leads/intake', (req, res) => {
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

  res.status(201).json({ ok: true, lead: { id: leadId, status: 'new', receivedAt: ts, ...validated.data } });
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

  const org = db.prepare(`SELECT * FROM organizations WHERE id = ? LIMIT 1`).get(orgId);
  const settings = getAiSettingsForOrg(orgId);
  if (!settings) return res.status(404).json({ ok: false, error: 'AI settings not found' });
  if (!settings.ai_enabled) return res.status(409).json({ ok: false, error: 'AI is disabled for this organization' });
  if (!settings.allowed_actions.includes('draft_message')) return res.status(403).json({ ok: false, error: 'Draft generation is not allowed for this organization' });

  const runId = `air_${crypto.randomUUID()}`;
  const outputId = `airo_${crypto.randomUUID()}`;
  const ts = nowIso();
  db.prepare(`INSERT INTO ai_runs (id, organization_id, workflow_type, trigger_type, trigger_id, lead_id, status, mode, started_at, created_at, updated_at) VALUES (?, ?, 'lead_reply_draft', 'manual', ?, ?, 'pending', ?, ?, ?, ?)`)
    .run(runId, orgId, req.params.id, lead.id, settings.default_mode, ts, ts, ts);

  try {
    const result = await runDraftOnlyLeadResponse({ org, lead, settings });
    db.prepare(`UPDATE ai_runs SET status = 'completed', provider = ?, model = ?, input_tokens = ?, output_tokens = ?, estimated_cost = ?, completed_at = ?, updated_at = ? WHERE id = ?`).run(result.provider, result.model, result.inputTokens, result.outputTokens, result.estimatedCost, nowIso(), nowIso(), runId);
    db.prepare(`INSERT INTO ai_run_outputs (id, ai_run_id, output_type, content_json, created_at) VALUES (?, ?, 'draft_message', ?, ?)`).run(outputId, runId, JSON.stringify(result.output), nowIso());
    res.json({ ok: true, run: { id: runId, status: 'completed', provider: result.provider, model: result.model }, draft: result.output });
  } catch (error) {
    db.prepare(`UPDATE ai_runs SET status = 'failed', error_code = ?, error_message = ?, completed_at = ?, updated_at = ? WHERE id = ?`).run('draft_failed', error?.message || 'AI draft failed', nowIso(), nowIso(), runId);
    res.status(500).json({ ok: false, error: error?.message || 'AI draft failed' });
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

app.get('/api/auth/gmail/start', requirePermission('emailOutbox.manage'), (req, res) => {
  const orgId = getActorOrgId(req);
  const saved = getProviderSettings(orgId, 'gmail') || saveProviderSettingsRow(orgId, 'gmail', {});
  const clientId = saved?.client_id;
  const redirectUri = saved?.redirect_uri;
  if (!clientId || !redirectUri) return res.status(400).json({ ok: false, error: 'Gmail provider is missing client configuration' });
  const authUrl = buildAuthUrl({ clientId, redirectUri, state: orgId });
  res.json({ ok: true, authUrl });
});

app.get('/api/auth/gmail/callback', async (req, res) => {
  const orgId = normalizeString(req.query.orgId) || DEFAULT_ORG_ID;
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
    const updated = saveProviderSettingsRow(orgId, 'gmail', {
      status: 'connected',
      config: { ...config, email: profile.email || null },
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || saved.refresh_token,
      token_expires_at: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString(),
    });
    return res.send(`Gmail connected for ${profile.email || 'account'} — you can close this tab.`);
  } catch (err) {
    return res.status(500).send(`Gmail OAuth callback failed: ${err.message}`);
  }
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
  const rows = db.prepare(`SELECT o.*, COALESCE(u.full_name, 'System') AS created_by_name FROM email_outbox o LEFT JOIN users u ON u.id = o.created_by_user_id WHERE o.organization_id = ? AND o.lead_id = ? ORDER BY o.created_at DESC`).all(orgId, req.params.id);
  res.json({ ok: true, items: rows.map((row) => ({ id: row.id, emailDraftId: row.email_draft_id || null, toEmail: row.to_email, subject: row.subject, body: row.body, providerKey: row.provider_key || 'stub', sendStatus: row.send_status, queuedAt: row.queued_at, sentAt: row.sent_at || null, failedAt: row.failed_at || null, lastError: row.last_error || null, createdAt: row.created_at, createdByName: row.created_by_name })) });
});

app.post('/api/leads/:id/email-outbox', requirePermission('emailOutbox.manage'), (req, res) => {
  const orgId = getActorOrgId(req);
  const lead = db.prepare(`SELECT * FROM leads WHERE organization_id = ? AND id = ? LIMIT 1`).get(orgId, req.params.id);
  if (!lead) return res.status(404).json({ ok: false, error: 'Lead not found' });

  const emailDraftId = normalizeString(req.body?.emailDraftId) || null;
  let toEmail = normalizeString(req.body?.toEmail || lead.email).toLowerCase();
  let subject = normalizeString(req.body?.subject);
  let body = normalizeString(req.body?.body);
  const providerKey = normalizeString(req.body?.providerKey || 'stub') || 'stub';

  if (emailDraftId) {
    const draft = db.prepare(`SELECT * FROM email_drafts WHERE organization_id = ? AND lead_id = ? AND id = ? LIMIT 1`).get(orgId, req.params.id, emailDraftId);
    if (!draft) return res.status(404).json({ ok: false, error: 'Email draft not found' });
    toEmail = toEmail || draft.to_email;
    subject = subject || draft.subject;
    body = body || draft.body;
  }

  if (!toEmail) return res.status(400).json({ ok: false, error: 'toEmail is required' });
  if (!subject) return res.status(400).json({ ok: false, error: 'subject is required' });
  if (!body) return res.status(400).json({ ok: false, error: 'body is required' });

  const id = `out_${crypto.randomUUID()}`;
  const eventId = `evt_${crypto.randomUUID()}`;
  const ts = nowIso();

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO email_outbox (id, organization_id, lead_id, email_draft_id, to_email, subject, body, provider_key, send_status, queued_at, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?)`).run(id, orgId, req.params.id, emailDraftId, toEmail, subject, body, providerKey, ts, req.actor.id, ts, ts);
    db.prepare(`INSERT INTO events (id, organization_id, lead_id, event_type, payload_json, created_at) VALUES (?, ?, ?, 'lead.email_queued', ?, ?)`).run(eventId, orgId, req.params.id, JSON.stringify({ toEmail, subject, providerKey, emailDraftId }), ts);
  });
  tx();

  res.status(201).json({ ok: true, item: { id, emailDraftId, toEmail, subject, body, providerKey, sendStatus: 'queued', queuedAt: ts, createdAt: ts, createdByName: req.actor.full_name } });
});

app.post('/api/email-outbox/:id/process', requirePermission('emailOutbox.manage'), async (req, res) => {
  const orgId = getActorOrgId(req);
  const item = db.prepare(`SELECT * FROM email_outbox WHERE id = ? AND organization_id = ? LIMIT 1`).get(req.params.id, orgId);
  if (!item) return res.status(404).json({ ok: false, error: 'Outbox item not found' });
  if (item.send_status === 'sent') return res.json({ ok: true, item: { id: item.id, sendStatus: item.send_status, sentAt: item.sent_at } });

  const provider = getProvider(item.provider_key || 'stub');
  try {
    const providerSettings = item.provider_key ? getProviderSettings(item.organization_id, item.provider_key) : null;
    const result = await provider.send({ toEmail: item.to_email, subject: item.subject, body: item.body, providerSettings, saveProviderSettings: (patch) => saveProviderSettingsRow(item.organization_id, item.provider_key || 'stub', patch) });
    const ts = nowIso();
    const tx = db.transaction(() => {
      db.prepare(`UPDATE email_outbox SET send_status = 'sent', sent_at = ?, failed_at = NULL, last_error = NULL, updated_at = ? WHERE id = ?`).run(ts, ts, item.id);
      db.prepare(`INSERT INTO communications (id, organization_id, lead_id, channel, direction, actor_type, actor_name, subject, summary, content, occurred_at, created_at, updated_at) VALUES (?, ?, ?, 'email', 'outbound', 'user', ?, ?, ?, ?, ?, ?, ?)`).run(`com_${crypto.randomUUID()}`, item.organization_id, item.lead_id, req.actor.full_name, item.subject, 'Email sent from outbox', item.body, ts, ts, ts);
      db.prepare(`INSERT INTO events (id, organization_id, lead_id, event_type, payload_json, created_at) VALUES (?, ?, ?, 'lead.email_sent', ?, ?)`).run(`evt_${crypto.randomUUID()}`, item.organization_id, item.lead_id, JSON.stringify({ outboxId: item.id, providerKey: item.provider_key || 'stub', providerMessageId: result.providerMessageId || null }), ts);
      db.prepare(`UPDATE leads SET last_contacted_at = ?, updated_at = ? WHERE id = ?`).run(ts, ts, item.lead_id);
    });
    tx();
    const updated = db.prepare(`SELECT * FROM email_outbox WHERE id = ? LIMIT 1`).get(item.id);
    res.json({ ok: true, item: { id: updated.id, sendStatus: updated.send_status, sentAt: updated.sent_at, providerKey: updated.provider_key || 'stub' } });
  } catch (error) {
    const ts = nowIso();
    db.prepare(`UPDATE email_outbox SET send_status = 'failed', failed_at = ?, last_error = ?, updated_at = ? WHERE id = ?`).run(ts, error?.message || 'Unknown error', ts, item.id);
    res.status(500).json({ ok: false, error: error?.message || 'Email send failed' });
  }
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

  db.prepare(`UPDATE organizations SET name = ?, timezone = ?, updated_at = ? WHERE id = ?`).run(
    next.businessName,
    next.timezone,
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
app.listen(port, () => console.log(`API listening on :${port}`));
