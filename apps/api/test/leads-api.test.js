const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

async function waitForHealth(baseUrl, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`API did not become healthy within ${timeoutMs}ms`);
}

function createInternalAuthHeaders({ method = 'GET', requestPath, email, clerkUserId = 'clerk_test_user', secret, contentType = null }) {
  const timestamp = new Date().toISOString();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const payload = [method.toUpperCase(), requestPath, clerkUserId, normalizedEmail, timestamp].join('\n');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const headers = {
    'x-user-email': normalizedEmail,
    'x-clerk-user-id': clerkUserId,
    'x-internal-auth-ts': timestamp,
    'x-internal-auth-signature': signature,
  };
  if (contentType) headers['content-type'] = contentType;
  return headers;
}

function startApi() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leadsprint-api-test-'));
  const dbPath = path.join(tmpDir, 'leadgen.sqlite');
  const port = 4100 + Math.floor(Math.random() * 400);
  const internalApiAuthSecret = `test-secret-${crypto.randomUUID()}`;

  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: dbPath,
      INTERNAL_API_AUTH_SECRET: internalApiAuthSecret,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    child,
    authHeaders(requestPath, { method = 'GET', email, clerkUserId, contentType = null } = {}) {
      return createInternalAuthHeaders({ method, requestPath, email, clerkUserId, secret: internalApiAuthSecret, contentType });
    },
    cleanup: () => {
      if (!child.killed) child.kill('SIGTERM');
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

test('lead intake + list + detail + status happy path', async (t) => {
  const api = startApi();
  t.after(api.cleanup);

  await waitForHealth(api.baseUrl);

  const intake = await fetch(`${api.baseUrl}/api/leads/intake`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Jamie Test',
      email: 'jamie@example.com',
      source: 'website',
      message: 'Need solar quote',
    }),
  });
  assert.equal(intake.status, 201);
  const intakeJson = await intake.json();
  assert.equal(intakeJson.ok, true);
  assert.match(intakeJson.lead.id, /^lead_/);
  assert.equal(intakeJson.lead.status, 'new');

  const leadId = intakeJson.lead.id;

  const listRes = await fetch(`${api.baseUrl}/api/leads?status=new`, {
    headers: api.authHeaders('/api/leads', { email: 'owner@leadsprint.local', clerkUserId: 'clerk_owner' }),
  });
  assert.equal(listRes.status, 200);
  const listJson = await listRes.json();
  assert.equal(listJson.ok, true);
  assert.ok(Array.isArray(listJson.leads));
  assert.ok(listJson.leads.some((l) => l.id === leadId));

  const detailRes = await fetch(`${api.baseUrl}/api/leads/${leadId}`, {
    headers: api.authHeaders(`/api/leads/${leadId}`, { email: 'owner@leadsprint.local', clerkUserId: 'clerk_owner' }),
  });
  assert.equal(detailRes.status, 200);
  const detailJson = await detailRes.json();
  assert.equal(detailJson.ok, true);
  assert.equal(detailJson.lead.id, leadId);
  assert.equal(detailJson.lead.email, 'jamie@example.com');

  const statusRes = await fetch(`${api.baseUrl}/api/leads/${leadId}/status`, {
    method: 'PATCH',
    headers: api.authHeaders(`/api/leads/${leadId}/status`, {
      method: 'PATCH',
      email: 'owner@leadsprint.local',
      clerkUserId: 'clerk_owner',
      contentType: 'application/json',
    }),
    body: JSON.stringify({ status: 'contacted' }),
  });
  assert.equal(statusRes.status, 200);
  const statusJson = await statusRes.json();
  assert.equal(statusJson.ok, true);
  assert.equal(statusJson.lead.status, 'contacted');
});

test('email draft creation works for authenticated owner', async (t) => {
  const api = startApi();
  t.after(api.cleanup);

  await waitForHealth(api.baseUrl);

  const intake = await fetch(`${api.baseUrl}/api/leads/intake`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Drafty McDraftface',
      email: 'drafty@example.com',
      source: 'website',
      message: 'Need follow-up',
    }),
  });
  assert.equal(intake.status, 201);
  const intakeJson = await intake.json();
  const leadId = intakeJson.lead.id;

  const draftRes = await fetch(`${api.baseUrl}/api/leads/${leadId}/email-drafts`, {
    method: 'POST',
    headers: api.authHeaders(`/api/leads/${leadId}/email-drafts`, {
      method: 'POST',
      email: 'owner@leadsprint.local',
      clerkUserId: 'clerk_owner',
      contentType: 'application/json',
    }),
    body: JSON.stringify({
      subject: 'Quick follow-up',
      body: 'Wanted to follow up on your request.',
    }),
  });
  assert.equal(draftRes.status, 201);
  const draftJson = await draftRes.json();
  assert.equal(draftJson.ok, true);
  assert.equal(draftJson.draft.toEmail, 'drafty@example.com');
  assert.equal(draftJson.draft.subject, 'Quick follow-up');
});

test('lead intake validation returns 400 for invalid payload', async (t) => {
  const api = startApi();
  t.after(api.cleanup);

  await waitForHealth(api.baseUrl);

  const res = await fetch(`${api.baseUrl}/api/leads/intake`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fullName: '', email: 'bad-email' }),
  });

  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.ok, false);
  assert.ok(Array.isArray(json.errors));
  assert.ok(json.errors.length >= 1);
});

test('status update rejects invalid status with 400', async (t) => {
  const api = startApi();
  t.after(api.cleanup);

  await waitForHealth(api.baseUrl);

  const intake = await fetch(`${api.baseUrl}/api/leads/intake`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fullName: 'Taylor', email: 'taylor@example.com' }),
  });
  const { lead } = await intake.json();

  const res = await fetch(`${api.baseUrl}/api/leads/${lead.id}/status`, {
    method: 'PATCH',
    headers: api.authHeaders(`/api/leads/${lead.id}/status`, {
      method: 'PATCH',
      email: 'owner@leadsprint.local',
      clerkUserId: 'clerk_owner',
      contentType: 'application/json',
    }),
    body: JSON.stringify({ status: 'invalid' }),
  });

  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.ok, false);
  assert.match(json.error, /status must be one of/);
});

test('protected lead routes reject anonymous requests', async (t) => {
  const api = startApi();
  t.after(api.cleanup);

  await waitForHealth(api.baseUrl);

  const intake = await fetch(`${api.baseUrl}/api/leads/intake`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fullName: 'Anon Lead', email: 'anon@example.com' }),
  });
  assert.equal(intake.status, 201);
  const intakeJson = await intake.json();

  const listRes = await fetch(`${api.baseUrl}/api/leads`);
  assert.equal(listRes.status, 401);

  const detailRes = await fetch(`${api.baseUrl}/api/leads/${intakeJson.lead.id}`);
  assert.equal(detailRes.status, 401);

  const statusRes = await fetch(`${api.baseUrl}/api/leads/${intakeJson.lead.id}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'contacted' }),
  });
  assert.equal(statusRes.status, 401);

  const eventsRes = await fetch(`${api.baseUrl}/api/leads/${intakeJson.lead.id}/events`);
  assert.equal(eventsRes.status, 401);

  const contactLogRes = await fetch(`${api.baseUrl}/api/leads/${intakeJson.lead.id}/contact-log`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ direction: 'outbound', channel: 'email', body: 'hello' }),
  });
  assert.equal(contactLogRes.status, 401);
});

test('user organization roles enforce owner protections', async (t) => {
  const api = startApi();
  t.after(api.cleanup);

  await waitForHealth(api.baseUrl);

  const initialUsersRes = await fetch(`${api.baseUrl}/api/users`, {
    headers: api.authHeaders('/api/users', { email: 'owner@leadsprint.local', clerkUserId: 'clerk_owner' }),
  });
  const initialUsersJson = await initialUsersRes.json();
  assert.equal(initialUsersJson.ok, true);
  const owner = initialUsersJson.users.find((u) => u.role === 'company_owner');
  assert.ok(owner, 'expected a seeded company owner');

  const ownerPostHeaders = api.authHeaders('/api/users', {
    method: 'POST',
    email: owner.email,
    clerkUserId: 'clerk_owner',
    contentType: 'application/json',
  });

  const addAdminRes = await fetch(`${api.baseUrl}/api/users`, {
    method: 'POST',
    headers: ownerPostHeaders,
    body: JSON.stringify({ fullName: 'Alex Admin', email: 'alex.admin@example.com', role: 'company_admin' }),
  });
  assert.equal(addAdminRes.status, 201);
  const addAdminJson = await addAdminRes.json();
  assert.equal(addAdminJson.user.role, 'company_admin');

  const removeOwnerRes = await fetch(`${api.baseUrl}/api/users/${owner.id}`, {
    method: 'DELETE',
    headers: api.authHeaders(`/api/users/${owner.id}`, { method: 'DELETE', email: owner.email, clerkUserId: 'clerk_owner' }),
  });
  assert.equal(removeOwnerRes.status, 400);
  const removeOwnerJson = await removeOwnerRes.json();
  assert.match(removeOwnerJson.error, /Cannot remove the protected owner account/);

  const removeAdminRes = await fetch(`${api.baseUrl}/api/users/${addAdminJson.user.id}`, {
    method: 'DELETE',
    headers: api.authHeaders(`/api/users/${addAdminJson.user.id}`, { method: 'DELETE', email: owner.email, clerkUserId: 'clerk_owner' }),
  });
  assert.equal(removeAdminRes.status, 200);
  const removeAdminJson = await removeAdminRes.json();
  assert.equal(removeAdminJson.ok, true);
});

test('agents cannot access owner/admin-protected routes', async (t) => {
  const api = startApi();
  t.after(api.cleanup);

  await waitForHealth(api.baseUrl);

  const createAgent = await fetch(`${api.baseUrl}/api/users`, {
    method: 'POST',
    headers: api.authHeaders('/api/users', {
      method: 'POST',
      email: 'owner@leadsprint.local',
      clerkUserId: 'clerk_owner',
      contentType: 'application/json',
    }),
    body: JSON.stringify({ fullName: 'Avery Agent', email: 'avery.agent@example.com', role: 'company_agent' }),
  });
  assert.equal(createAgent.status, 201);

  const usersRes = await fetch(`${api.baseUrl}/api/users`, {
    headers: api.authHeaders('/api/users', { email: 'avery.agent@example.com', clerkUserId: 'clerk_avery' }),
  });
  assert.equal(usersRes.status, 403);

  const settingsRes = await fetch(`${api.baseUrl}/api/settings/business`, {
    headers: api.authHeaders('/api/settings/business', { email: 'avery.agent@example.com', clerkUserId: 'clerk_avery' }),
  });
  assert.equal(settingsRes.status, 403);
});

test('ai settings can be updated and manual lead draft runs are org-scoped', async (t) => {
  const api = startApi();
  t.after(api.cleanup);

  await waitForHealth(api.baseUrl);

  const putAiSettings = await fetch(`${api.baseUrl}/api/settings/ai`, {
    method: 'PUT',
    headers: api.authHeaders('/api/settings/ai', {
      method: 'PUT',
      email: 'owner@leadsprint.local',
      clerkUserId: 'clerk_owner',
      contentType: 'application/json',
    }),
    body: JSON.stringify({
      aiEnabled: true,
      defaultMode: 'draft_only',
      allowedChannels: ['email'],
      allowedActions: ['draft_message'],
      responseSlaTargetMinutes: 5,
      toneProfile: { defaultTone: 'helpful and concise' },
      businessContext: { businessName: 'Default Organization', bookingLink: 'https://calendly.com/test-link' },
    }),
  });
  assert.equal(putAiSettings.status, 200);
  const putAiSettingsJson = await putAiSettings.json();
  assert.equal(putAiSettingsJson.settings.ai_enabled, 1);

  const createLead = await fetch(`${api.baseUrl}/api/leads/intake`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Taylor Lead',
      email: 'taylor.lead@example.com',
      phone: '555-111-2222',
      source: 'website',
      message: 'I would like to schedule a consultation next week.',
      urgencyStatus: 'warm',
    }),
  });
  assert.equal(createLead.status, 201);
  const createLeadJson = await createLead.json();

  const draftRes = await fetch(`${api.baseUrl}/api/leads/${createLeadJson.lead.id}/ai/draft-response`, {
    method: 'POST',
    headers: api.authHeaders(`/api/leads/${createLeadJson.lead.id}/ai/draft-response`, {
      method: 'POST',
      email: 'owner@leadsprint.local',
      clerkUserId: 'clerk_owner',
      contentType: 'application/json',
    }),
  });
  assert.equal(draftRes.status, 200);
  const draftJson = await draftRes.json();
  assert.equal(draftJson.ok, true);
  assert.match(draftJson.draft.draft, /Taylor Lead/);
  assert.match(draftJson.draft.draft, /https:\/\/calendly.com\/test-link/);

  const runsRes = await fetch(`${api.baseUrl}/api/ai/runs`, {
    headers: api.authHeaders('/api/ai/runs', { email: 'owner@leadsprint.local', clerkUserId: 'clerk_owner' }),
  });
  assert.equal(runsRes.status, 200);
  const runsJson = await runsRes.json();
  assert.ok(runsJson.runs.some((run) => run.lead_id === createLeadJson.lead.id && run.status === 'completed'));
});

test('platform owner can create internal platform operators', async (t) => {
  const api = startApi();
  t.after(api.cleanup);

  await waitForHealth(api.baseUrl);

  const createInternal = await fetch(`${api.baseUrl}/api/users`, {
    method: 'POST',
    headers: api.authHeaders('/api/users', {
      method: 'POST',
      email: 'josiahricheson@gmail.com',
      clerkUserId: 'clerk_platform_owner',
      contentType: 'application/json',
    }),
    body: JSON.stringify({ fullName: 'Pat Platform', email: 'pat.platform@example.com', role: 'platform_sme' }),
  });
  assert.equal(createInternal.status, 201);
  const createInternalJson = await createInternal.json();
  assert.equal(createInternalJson.user.role, 'platform_sme');
  assert.equal(createInternalJson.user.roleLabel, 'SME');

  const companyOwnerCreatePlatform = await fetch(`${api.baseUrl}/api/users`, {
    method: 'POST',
    headers: api.authHeaders('/api/users', {
      method: 'POST',
      email: 'owner@leadsprint.local',
      clerkUserId: 'clerk_owner',
      contentType: 'application/json',
    }),
    body: JSON.stringify({ fullName: 'Nope', email: 'nope.platform@example.com', role: 'platform_agent' }),
  });
  assert.equal(companyOwnerCreatePlatform.status, 403);
});

test('permission overrides can grant agent access to business settings', async (t) => {
  const api = startApi();
  t.after(api.cleanup);

  await waitForHealth(api.baseUrl);

  const createAgent = await fetch(`${api.baseUrl}/api/users`, {
    method: 'POST',
    headers: api.authHeaders('/api/users', {
      method: 'POST',
      email: 'owner@leadsprint.local',
      clerkUserId: 'clerk_owner',
      contentType: 'application/json',
    }),
    body: JSON.stringify({ fullName: 'Sam Agent', email: 'sam.agent@example.com', role: 'company_agent' }),
  });
  assert.equal(createAgent.status, 201);
  const created = await createAgent.json();

  const grantRes = await fetch(`${api.baseUrl}/api/users/${created.user.id}/permissions`, {
    method: 'PUT',
    headers: api.authHeaders(`/api/users/${created.user.id}/permissions`, {
      method: 'PUT',
      email: 'owner@leadsprint.local',
      clerkUserId: 'clerk_owner',
      contentType: 'application/json',
    }),
    body: JSON.stringify({ permissions: { 'settings.manageBusiness': true } }),
  });
  assert.equal(grantRes.status, 200);

  const settingsRes = await fetch(`${api.baseUrl}/api/settings/business`, {
    headers: api.authHeaders('/api/settings/business', { email: 'sam.agent@example.com', clerkUserId: 'clerk_sam' }),
  });
  assert.equal(settingsRes.status, 200);

  const mePermsRes = await fetch(`${api.baseUrl}/api/me/permissions`, {
    headers: api.authHeaders('/api/me/permissions', { email: 'sam.agent@example.com', clerkUserId: 'clerk_sam' }),
  });
  assert.equal(mePermsRes.status, 200);
  const mePermsJson = await mePermsRes.json();
  assert.equal(mePermsJson.permissions['settings.manageBusiness'], true);
});

test('public business request can be approved into activation flow and auto-provision after sign-in', async (t) => {
  const api = startApi();
  t.after(api.cleanup);

  await waitForHealth(api.baseUrl);

  const submitRes = await fetch(`${api.baseUrl}/api/public/access/business-request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Pat Owner',
      email: 'pat@example.com',
      roleTitle: 'Owner',
      organizationName: 'Pat Plumbing',
      website: 'https://patplumbing.example.com',
      lineOfBusiness: 'plumbing',
      teamSize: '1-5',
      requestedFeatures: ['lead_intake', 'reporting'],
      authorityAttestation: true,
      notes: 'Need reviewed setup',
    }),
  });
  assert.equal(submitRes.status, 201);
  const submitJson = await submitRes.json();
  assert.equal(submitJson.ok, true);
  assert.equal(submitJson.request.status, 'pending');

  const beforeApprovalLookup = await fetch(`${api.baseUrl}/api/public/access/activation/not-a-real-token`);
  assert.equal(beforeApprovalLookup.status, 404);

  const requestsRes = await fetch(`${api.baseUrl}/api/admin/access-requests`, {
    headers: api.authHeaders('/api/admin/access-requests', { email: 'josiahricheson@gmail.com', clerkUserId: 'clerk_platform_owner' }),
  });
  assert.equal(requestsRes.status, 200);
  const requestsJson = await requestsRes.json();
  const request = requestsJson.requests.find((row) => row.email === 'pat@example.com');
  assert.ok(request, 'expected submitted access request to exist');
  assert.equal(request.status, 'pending');
  assert.equal(request.clerk_user_id, null);

  const approveRes = await fetch(`${api.baseUrl}/api/admin/access-requests/${request.id}/approve`, {
    method: 'POST',
    headers: api.authHeaders(`/api/admin/access-requests/${request.id}/approve`, {
      method: 'POST',
      email: 'josiahricheson@gmail.com',
      clerkUserId: 'clerk_platform_owner',
      contentType: 'application/json',
    }),
    body: JSON.stringify({ reviewNotes: 'Approved for activation' }),
  });
  assert.equal(approveRes.status, 200);
  const approveJson = await approveRes.json();
  assert.equal(approveJson.ok, true);
  assert.equal(approveJson.awaitingActivation, true);
  assert.match(approveJson.activationUrl, /^\/sign-up\?activation_token=/);
  assert.ok(approveJson.request.activationToken);

  const activationLookup = await fetch(`${api.baseUrl}/api/public/access/activation/${approveJson.request.activationToken}`);
  assert.equal(activationLookup.status, 200);
  const activationJson = await activationLookup.json();
  assert.equal(activationJson.ok, true);
  assert.equal(activationJson.activation.email, 'pat@example.com');
  assert.equal(activationJson.activation.organizationName, 'Pat Plumbing');
  assert.equal(activationJson.activation.requestKind, 'business_workspace');

  const meBeforeProvision = await fetch(`${api.baseUrl}/api/access/me`, {
    headers: api.authHeaders('/api/access/me', { email: 'pat@example.com', clerkUserId: 'clerk_pat_123' }),
  });
  assert.equal(meBeforeProvision.status, 200);
  const meBeforeProvisionJson = await meBeforeProvision.json();
  assert.equal(meBeforeProvisionJson.ok, true);
  assert.equal(meBeforeProvisionJson.state, 'approved');
  assert.equal(meBeforeProvisionJson.workspace.name, 'Pat Plumbing');
  assert.equal(meBeforeProvisionJson.workspace.workspaceType, 'business_verified');
  assert.equal(meBeforeProvisionJson.user.email, 'pat@example.com');

  const meAfterProvision = await fetch(`${api.baseUrl}/api/access/me`, {
    headers: api.authHeaders('/api/access/me', { email: 'pat@example.com', clerkUserId: 'clerk_pat_123' }),
  });
  assert.equal(meAfterProvision.status, 200);
  const meAfterProvisionJson = await meAfterProvision.json();
  assert.equal(meAfterProvisionJson.state, 'approved');

  const requestsAfterRes = await fetch(`${api.baseUrl}/api/admin/access-requests`, {
    headers: api.authHeaders('/api/admin/access-requests', { email: 'josiahricheson@gmail.com', clerkUserId: 'clerk_platform_owner' }),
  });
  const requestsAfterJson = await requestsAfterRes.json();
  const requestAfter = requestsAfterJson.requests.find((row) => row.id === request.id);
  assert.equal(requestAfter.status, 'approved');
  assert.equal(requestAfter.clerk_user_id, 'clerk_pat_123');
  assert.equal(requestAfter.activation_token, null);
  assert.ok(requestAfter.activated_at);
});

test('activation endpoint rejects pending requests before approval', async (t) => {
  const api = startApi();
  t.after(api.cleanup);

  await waitForHealth(api.baseUrl);

  const submitRes = await fetch(`${api.baseUrl}/api/public/access/individual`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Indy Solo',
      email: 'indy@example.com',
      workspaceName: 'Indy Solo',
      lineOfBusiness: 'consulting',
      useCase: 'solo workflow',
      notes: 'please review',
    }),
  });
  assert.equal(submitRes.status, 201);

  const requestsRes = await fetch(`${api.baseUrl}/api/admin/access-requests`, {
    headers: api.authHeaders('/api/admin/access-requests', { email: 'josiahricheson@gmail.com', clerkUserId: 'clerk_platform_owner' }),
  });
  const requestsJson = await requestsRes.json();
  const request = requestsJson.requests.find((row) => row.email === 'indy@example.com');
  assert.ok(request);
  assert.equal(request.status, 'pending');
  assert.equal(request.activation_token, null);

  const missingTokenLookup = await fetch(`${api.baseUrl}/api/public/access/activation/not-a-real-token`);
  assert.equal(missingTokenLookup.status, 404);
  const missingTokenJson = await missingTokenLookup.json();
  assert.equal(missingTokenJson.ok, false);
  assert.match(missingTokenJson.error, /Activation token not found/);
});
