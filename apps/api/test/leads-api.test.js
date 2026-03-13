const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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

function startApi() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leadsprint-api-test-'));
  const dbPath = path.join(tmpDir, 'leadgen.sqlite');
  const port = 4100 + Math.floor(Math.random() * 400);

  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: dbPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    child,
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

  const listRes = await fetch(`${api.baseUrl}/api/leads?status=new`);
  assert.equal(listRes.status, 200);
  const listJson = await listRes.json();
  assert.equal(listJson.ok, true);
  assert.ok(Array.isArray(listJson.leads));
  assert.ok(listJson.leads.some((l) => l.id === leadId));

  const detailRes = await fetch(`${api.baseUrl}/api/leads/${leadId}`);
  assert.equal(detailRes.status, 200);
  const detailJson = await detailRes.json();
  assert.equal(detailJson.ok, true);
  assert.equal(detailJson.lead.id, leadId);
  assert.equal(detailJson.lead.email, 'jamie@example.com');

  const statusRes = await fetch(`${api.baseUrl}/api/leads/${leadId}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'contacted' }),
  });
  assert.equal(statusRes.status, 200);
  const statusJson = await statusRes.json();
  assert.equal(statusJson.ok, true);
  assert.equal(statusJson.lead.status, 'contacted');
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
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'invalid' }),
  });

  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.ok, false);
  assert.match(json.error, /status must be one of/);
});

test('user organization roles enforce owner protections', async (t) => {
  const api = startApi();
  t.after(api.cleanup);

  await waitForHealth(api.baseUrl);

  const initialUsersRes = await fetch(`${api.baseUrl}/api/users`);
  const initialUsersJson = await initialUsersRes.json();
  assert.equal(initialUsersJson.ok, true);
  const owner = initialUsersJson.users.find((u) => u.role === 'company_owner');
  assert.ok(owner, 'expected a seeded company owner');

  const ownerHeaders = { 'content-type': 'application/json', 'x-user-email': owner.email };

  const addAdminRes = await fetch(`${api.baseUrl}/api/users`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({ fullName: 'Alex Admin', email: 'alex.admin@example.com', role: 'company_admin' }),
  });
  assert.equal(addAdminRes.status, 201);
  const addAdminJson = await addAdminRes.json();
  assert.equal(addAdminJson.user.role, 'company_admin');

  const removeOwnerRes = await fetch(`${api.baseUrl}/api/users/${owner.id}`, {
    method: 'DELETE',
    headers: { 'x-user-email': owner.email },
  });
  assert.equal(removeOwnerRes.status, 400);
  const removeOwnerJson = await removeOwnerRes.json();
  assert.match(removeOwnerJson.error, /Cannot remove the protected owner account/);

  const removeAdminRes = await fetch(`${api.baseUrl}/api/users/${addAdminJson.user.id}`, {
    method: 'DELETE',
    headers: { 'x-user-email': owner.email },
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
    headers: { 'content-type': 'application/json', 'x-user-email': 'owner@leadsprint.local' },
    body: JSON.stringify({ fullName: 'Avery Agent', email: 'avery.agent@example.com', role: 'company_agent' }),
  });
  assert.equal(createAgent.status, 201);

  const usersRes = await fetch(`${api.baseUrl}/api/users`, {
    headers: { 'x-user-email': 'avery.agent@example.com' },
  });
  assert.equal(usersRes.status, 403);

  const settingsRes = await fetch(`${api.baseUrl}/api/settings/business`, {
    headers: { 'x-user-email': 'avery.agent@example.com' },
  });
  assert.equal(settingsRes.status, 403);
});

test('platform owner can create internal platform operators', async (t) => {
  const api = startApi();
  t.after(api.cleanup);

  await waitForHealth(api.baseUrl);

  const createInternal = await fetch(`${api.baseUrl}/api/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-user-email': 'josiahricheson@gmail.com' },
    body: JSON.stringify({ fullName: 'Pat Platform', email: 'pat.platform@example.com', role: 'platform_sme' }),
  });
  assert.equal(createInternal.status, 201);
  const createInternalJson = await createInternal.json();
  assert.equal(createInternalJson.user.role, 'platform_sme');
  assert.equal(createInternalJson.user.roleLabel, 'SME');

  const companyOwnerCreatePlatform = await fetch(`${api.baseUrl}/api/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-user-email': 'owner@leadsprint.local' },
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
    headers: { 'content-type': 'application/json', 'x-user-email': 'owner@leadsprint.local' },
    body: JSON.stringify({ fullName: 'Sam Agent', email: 'sam.agent@example.com', role: 'company_agent' }),
  });
  assert.equal(createAgent.status, 201);
  const created = await createAgent.json();

  const grantRes = await fetch(`${api.baseUrl}/api/users/${created.user.id}/permissions`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-user-email': 'owner@leadsprint.local' },
    body: JSON.stringify({ permissions: { 'settings.manageBusiness': true } }),
  });
  assert.equal(grantRes.status, 200);

  const settingsRes = await fetch(`${api.baseUrl}/api/settings/business`, {
    headers: { 'x-user-email': 'sam.agent@example.com' },
  });
  assert.equal(settingsRes.status, 200);

  const mePermsRes = await fetch(`${api.baseUrl}/api/me/permissions`, {
    headers: { 'x-user-email': 'sam.agent@example.com' },
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
    headers: { 'x-user-email': 'josiahricheson@gmail.com' },
  });
  assert.equal(requestsRes.status, 200);
  const requestsJson = await requestsRes.json();
  const request = requestsJson.requests.find((row) => row.email === 'pat@example.com');
  assert.ok(request, 'expected submitted access request to exist');
  assert.equal(request.status, 'pending');
  assert.equal(request.clerk_user_id, null);

  const approveRes = await fetch(`${api.baseUrl}/api/admin/access-requests/${request.id}/approve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-user-email': 'josiahricheson@gmail.com' },
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
    headers: {
      'x-user-email': 'pat@example.com',
      'x-clerk-user-id': 'clerk_pat_123',
    },
  });
  assert.equal(meBeforeProvision.status, 200);
  const meBeforeProvisionJson = await meBeforeProvision.json();
  assert.equal(meBeforeProvisionJson.ok, true);
  assert.equal(meBeforeProvisionJson.state, 'approved');
  assert.equal(meBeforeProvisionJson.workspace.name, 'Pat Plumbing');
  assert.equal(meBeforeProvisionJson.workspace.workspaceType, 'business_verified');
  assert.equal(meBeforeProvisionJson.user.email, 'pat@example.com');

  const meAfterProvision = await fetch(`${api.baseUrl}/api/access/me`, {
    headers: {
      'x-user-email': 'pat@example.com',
      'x-clerk-user-id': 'clerk_pat_123',
    },
  });
  assert.equal(meAfterProvision.status, 200);
  const meAfterProvisionJson = await meAfterProvision.json();
  assert.equal(meAfterProvisionJson.state, 'approved');

  const requestsAfterRes = await fetch(`${api.baseUrl}/api/admin/access-requests`, {
    headers: { 'x-user-email': 'josiahricheson@gmail.com' },
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
    headers: { 'x-user-email': 'josiahricheson@gmail.com' },
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
