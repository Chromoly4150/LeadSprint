import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { count, desc, eq } from 'drizzle-orm';
import {
  activities,
  auditLogs,
  communications,
  conversations,
  inboundEvents,
  leads,
  notes,
  organizations,
  outboundJobs,
  permissionAssignments,
  users,
  type LeadRow,
} from '@/lib/schema';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'leadsprint.sqlite');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite);

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function iso(input?: string | Date | null) {
  return input ? new Date(input).toISOString() : new Date().toISOString();
}

function plusMinutes(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function normalizePhone(phone?: string | null) {
  return String(phone ?? '').replace(/\D/g, '');
}

function comparable(value?: string | null) {
  return String(value ?? '').trim().toLowerCase();
}

function relativeTime(isoString?: string | null) {
  if (!isoString) return '—';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const future = diffMs < 0;
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60000);
  if (mins < 1) return future ? 'in <1 min' : 'Just now';
  if (mins < 60) return future ? `in ${mins} min` : `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return future ? `in ${hrs} hr` : `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return future ? `in ${days} d` : `${days} d ago`;
}

export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      source TEXT NOT NULL,
      service TEXT NOT NULL,
      state TEXT NOT NULL,
      lifecycle TEXT NOT NULL,
      urgency TEXT NOT NULL,
      assignee_user_id TEXT REFERENCES users(id),
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_contact_at TEXT,
      last_activity_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      first_response_due_at TEXT,
      inbound_payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      author_user_id TEXT REFERENCES users(id),
      author_name TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS communications (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      channel TEXT NOT NULL,
      direction TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      subject TEXT,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS inbound_events (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      source TEXT NOT NULL,
      actionable INTEGER NOT NULL,
      status TEXT NOT NULL,
      lead_id TEXT REFERENCES leads(id),
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS outbound_jobs (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      provider TEXT NOT NULL,
      to_address TEXT NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      provider_message_id TEXT,
      last_error_code TEXT,
      last_error_message TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      sent_at TEXT,
      failed_at TEXT,
      payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS permission_assignments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      subject_type TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      permission_key TEXT NOT NULL,
      effect TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      actor_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      lead_id TEXT NOT NULL REFERENCES leads(id),
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      assigned_user_id TEXT REFERENCES users(id),
      last_message_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const outboundColumns = sqlite.prepare("PRAGMA table_info(outbound_jobs)").all() as Array<{ name: string }>;
  const names = new Set(outboundColumns.map((col) => col.name));
  const addColumn = (name: string, ddl: string) => {
    if (!names.has(name)) sqlite.exec(`ALTER TABLE outbound_jobs ADD COLUMN ${ddl}`);
  };
  addColumn('provider_message_id', 'provider_message_id TEXT');
  addColumn('last_error_code', 'last_error_code TEXT');
  addColumn('last_error_message', 'last_error_message TEXT');
  addColumn('attempt_count', 'attempt_count INTEGER NOT NULL DEFAULT 0');
  addColumn('last_attempt_at', 'last_attempt_at TEXT');
  addColumn('sent_at', 'sent_at TEXT');
  addColumn('failed_at', 'failed_at TEXT');
  addColumn('payload_json', 'payload_json TEXT');
}

function seedIfEmpty() {
  const existing = db.select({ value: count() }).from(leads).get();
  if ((existing?.value ?? 0) > 0) return;

  const orgId = 'org_demo';
  db.insert(organizations).values({ id: orgId, name: 'LeadSprint Demo Org' }).onConflictDoNothing().run();

  const userRows = [
    { id: 'user_owner', organizationId: orgId, name: 'Josiah', email: 'owner@leadsprint.local', role: 'Owner' },
    { id: 'user_ava', organizationId: orgId, name: 'Ava', email: 'ava@leadsprint.local', role: 'Admin' },
    { id: 'user_noah', organizationId: orgId, name: 'Noah', email: 'noah@leadsprint.local', role: 'General User' },
    { id: 'user_system', organizationId: orgId, name: 'System', email: 'system@leadsprint.local', role: 'Support User' },
  ];
  db.insert(users).values(userRows).onConflictDoNothing().run();

  const leadRows = [
    {
      id: 'lead_001', organizationId: orgId, name: 'Taylor Brooks', company: 'Brooks Realty Group', source: 'Website Form', service: 'Referral partnership inquiry', state: 'FL', lifecycle: 'New', urgency: 'Hot', assigneeUserId: null,
      email: 'taylor@brooksrealty.com', phone: '(555) 201-9001', receivedAt: plusMinutes(-5), lastContactAt: null, lastActivityAt: plusMinutes(-1), firstResponseDueAt: plusMinutes(0), inboundPayloadJson: JSON.stringify({ source: 'website_form' }), updatedAt: iso(), createdAt: iso(),
    },
    {
      id: 'lead_002', organizationId: orgId, name: 'Jordan Lee', company: 'Lee Home Lending', source: 'Google Form', service: 'Purchase loan follow-up', state: 'NC', lifecycle: 'Contacted', urgency: 'Warm', assigneeUserId: 'user_ava',
      email: 'jordan@leehomelending.com', phone: '(555) 333-0021', receivedAt: plusMinutes(-42), lastContactAt: plusMinutes(-12), lastActivityAt: plusMinutes(-8), firstResponseDueAt: plusMinutes(-38), inboundPayloadJson: JSON.stringify({ source: 'google_form' }), updatedAt: iso(), createdAt: iso(),
    },
    {
      id: 'lead_003', organizationId: orgId, name: 'Morgan Patel', company: 'Patel Insurance', source: 'Webhook', service: 'Cross-referral partnership', state: 'TX', lifecycle: 'Qualified', urgency: 'Needs Attention', assigneeUserId: 'user_noah',
      email: 'morgan@patelinsurance.com', phone: '(555) 811-7777', receivedAt: plusMinutes(-180), lastContactAt: plusMinutes(-60), lastActivityAt: plusMinutes(-18), firstResponseDueAt: plusMinutes(-175), inboundPayloadJson: JSON.stringify({ source: 'webhook' }), updatedAt: iso(), createdAt: iso(),
    },
  ];
  db.insert(leads).values(leadRows).onConflictDoNothing().run();

  db.insert(notes).values([
    { id: 'seed_note_001', leadId: 'lead_001', authorUserId: 'user_system', authorName: 'System', type: 'follow_up', content: 'Lead marked hot because form included name, phone, email, and inquiry details. First-response window ends in 3 minutes.' },
    { id: 'seed_note_002', leadId: 'lead_002', authorUserId: 'user_ava', authorName: 'Ava', type: 'call_note', content: 'Spoke briefly. They want a callback after 7 PM and care most about turnaround time and down-payment options.' },
    { id: 'seed_note_003', leadId: 'lead_002', authorUserId: 'user_ava', authorName: 'Ava', type: 'internal_comment', content: 'Good fit. Send financing options summary before call if possible.' },
    { id: 'seed_note_004', leadId: 'lead_003', authorUserId: 'user_noah', authorName: 'Noah', type: 'general', content: 'Strong strategic fit, but waiting on confirmation of office coverage area.' },
  ]).onConflictDoNothing().run();

  db.insert(communications).values([
    { id: 'seed_comm_001', leadId: 'lead_001', channel: 'Chat', direction: 'Outbound', actorName: 'Bot', summary: 'Acknowledged inquiry and asked preferred callback time.', content: 'Thanks for reaching out — we got your inquiry and a team member will follow up shortly. What is the best number and time for a quick call?', createdAt: plusMinutes(-1) },
    { id: 'seed_comm_002', leadId: 'lead_002', channel: 'SMS', direction: 'Outbound', actorName: 'Bot', summary: 'Initial response sent within SLA.', content: 'Thanks for your interest — we received your request and can help. Is text okay for a quick follow-up while we get the right person on it?', createdAt: plusMinutes(-30) },
    { id: 'seed_comm_003', leadId: 'lead_002', channel: 'Call', direction: 'Outbound', actorName: 'Ava', summary: 'Short live call; follow-up scheduled.', content: 'Call connected. Discussed timing and next-step expectations. Callback requested for this evening.', createdAt: plusMinutes(-12) },
    { id: 'seed_comm_004', leadId: 'lead_002', channel: 'Email', direction: 'Outbound', actorName: 'Ava', summary: 'Sent recap email after call.', subject: 'Quick follow-up and next steps', content: 'Thanks for your time earlier. I’ll follow up after 7 PM as requested and send over a few options ahead of the call.', createdAt: plusMinutes(-8) },
    { id: 'seed_comm_005', leadId: 'lead_003', channel: 'Email', direction: 'Inbound', actorName: 'Morgan Patel', summary: 'Asked about service territory and referral process.', subject: 'Re: partnership conversation', content: 'Can you send more detail on how you handle referrals in DFW and surrounding counties?', createdAt: plusMinutes(-60) },
  ]).onConflictDoNothing().run();

  db.insert(activities).values([
    { id: 'seed_act_001', leadId: 'lead_001', type: 'lead_received', label: 'Lead received', detail: 'Website form submission normalized into system.', createdAt: plusMinutes(-5) },
    { id: 'seed_act_002', leadId: 'lead_001', type: 'automation_started', label: 'Automation started', detail: 'Hot-lead response workflow triggered.', createdAt: plusMinutes(-2) },
    { id: 'seed_act_003', leadId: 'lead_002', type: 'lead_received', label: 'Lead received', detail: 'Google Form lead captured.', createdAt: plusMinutes(-42) },
    { id: 'seed_act_004', leadId: 'lead_002', type: 'first_response_sent', label: 'First response sent', detail: 'SMS sent within 4 minutes.', createdAt: plusMinutes(-30) },
    { id: 'seed_act_005', leadId: 'lead_002', type: 'assigned', label: 'Assigned', detail: 'Assigned to Ava.', createdAt: plusMinutes(-20) },
    { id: 'seed_act_006', leadId: 'lead_003', type: 'qualified', label: 'Qualified', detail: 'Lead moved into qualified state after review.', createdAt: plusMinutes(-60) },
    { id: 'seed_act_007', leadId: 'lead_003', type: 'needs_attention', label: 'Needs attention', detail: 'Pending reply to inbound email.', createdAt: plusMinutes(-18) },
  ]).onConflictDoNothing().run();

  db.insert(outboundJobs).values([
    { id: 'seed_job_001', leadId: 'lead_001', channel: 'Email', status: 'queued', provider: 'gmail', toAddress: 'taylor@brooksrealty.com', subject: 'Thanks for reaching out', body: 'We received your inquiry and will follow up shortly.', attemptCount: 0, payloadJson: JSON.stringify({ template: 'first_response' }) },
  ]).onConflictDoNothing().run();

  db.insert(conversations).values([
    { id: 'conv_001', organizationId: orgId, leadId: 'lead_001', channel: 'Chat', status: 'Open', assignedUserId: null, lastMessageAt: plusMinutes(-1), createdAt: plusMinutes(-5), updatedAt: plusMinutes(-1) },
    { id: 'conv_002', organizationId: orgId, leadId: 'lead_002', channel: 'SMS', status: 'Open', assignedUserId: 'user_ava', lastMessageAt: plusMinutes(-8), createdAt: plusMinutes(-42), updatedAt: plusMinutes(-8) },
    { id: 'conv_003', organizationId: orgId, leadId: 'lead_003', channel: 'Email', status: 'Needs reply', assignedUserId: 'user_noah', lastMessageAt: plusMinutes(-60), createdAt: plusMinutes(-180), updatedAt: plusMinutes(-18) },
  ]).onConflictDoNothing().run();
}

initializeDatabase();
seedIfEmpty();

export function listAssignees() {
  return db.select().from(users).orderBy(users.name).all();
}

export function writeAuditLog({ organizationId, actorId, actorName, action, targetType, targetId, metadata, }: { organizationId: string; actorId: string; actorName: string; action: string; targetType: string; targetId: string; metadata?: Record<string, unknown>; }) {
  db.insert(auditLogs).values({ id: id('audit'), organizationId, actorType: 'user', actorId, actorName, action, targetType, targetId, metadataJson: JSON.stringify(metadata ?? {}), }).run();
}

export function listAuditLogs(limit = 50) {
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit).all();
}

export function getUserById(userId: string) {
  return db.select().from(users).where(eq(users.id, userId)).get() ?? null;
}

export function listPermissionOverrides(userId?: string) {
  const query = db.select().from(permissionAssignments).orderBy(permissionAssignments.createdAt);
  return userId ? query.where(eq(permissionAssignments.subjectId, userId)).all() : query.all();
}

export function setPermissionOverride({ organizationId, userId, permissionKey, effect, }: { organizationId: string; userId: string; permissionKey: string; effect: 'allow' | 'deny'; }) {
  const existing = db.select().from(permissionAssignments).where(eq(permissionAssignments.subjectId, userId)).all().find((row) => row.permissionKey === permissionKey);
  if (existing) {
    db.update(permissionAssignments).set({ effect }).where(eq(permissionAssignments.id, existing.id)).run();
    return;
  }
  db.insert(permissionAssignments).values({ id: id('perm'), organizationId, subjectType: 'user', subjectId: userId, permissionKey, effect, }).run();
}

export function clearPermissionOverride(userId: string, permissionKey: string) {
  const existing = db.select().from(permissionAssignments).where(eq(permissionAssignments.subjectId, userId)).all().find((row) => row.permissionKey === permissionKey);
  if (!existing) return;
  db.delete(permissionAssignments).where(eq(permissionAssignments.id, existing.id)).run();
}

export type LeadFilters = { query?: string; lifecycle?: string; urgency?: string; assignee?: string; };

export function listLeads(filters?: LeadFilters) {
  const rows = db.select({ lead: leads, assigneeName: users.name }).from(leads).leftJoin(users, eq(leads.assigneeUserId, users.id)).orderBy(desc(leads.receivedAt)).all();
  const normalized = rows.map(({ lead, assigneeName }) => ({ ...lead, assigneeName: assigneeName ?? 'Unassigned', receivedLabel: relativeTime(lead.receivedAt), lastContactLabel: relativeTime(lead.lastContactAt), lastActivityLabel: relativeTime(lead.lastActivityAt) }));
  return normalized.filter((lead) => {
    const query = filters?.query?.trim().toLowerCase();
    if (query) {
      const haystack = [lead.name, lead.company, lead.email, lead.phone, lead.service, lead.source, lead.state].join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (filters?.lifecycle && filters.lifecycle !== 'All' && lead.lifecycle !== filters.lifecycle) return false;
    if (filters?.urgency && filters.urgency !== 'All' && lead.urgency !== filters.urgency) return false;
    if (filters?.assignee && filters.assignee !== 'All' && lead.assigneeName !== filters.assignee) return false;
    return true;
  });
}

export function getLeadDetail(leadId: string) {
  const row = db.select({ lead: leads, assigneeName: users.name }).from(leads).leftJoin(users, eq(leads.assigneeUserId, users.id)).where(eq(leads.id, leadId)).get();
  if (!row) return null;
  const leadNotes = db.select().from(notes).where(eq(notes.leadId, leadId)).orderBy(desc(notes.createdAt)).all();
  const leadComms = db.select().from(communications).where(eq(communications.leadId, leadId)).orderBy(desc(communications.createdAt)).all();
  const leadActivities = db.select().from(activities).where(eq(activities.leadId, leadId)).orderBy(desc(activities.createdAt)).all();
  const timeline = [
    ...leadActivities.map((item) => ({ kind: 'activity' as const, createdAt: item.createdAt, title: item.label, subtitle: item.type.replace(/_/g, ' '), body: item.detail })),
    ...leadNotes.map((item) => ({ kind: 'note' as const, createdAt: item.createdAt, title: item.authorName, subtitle: item.type.replace(/_/g, ' '), body: item.content })),
    ...leadComms.map((item) => ({ kind: 'communication' as const, createdAt: item.createdAt, title: `${item.direction} ${item.channel}`, subtitle: item.actorName, body: item.summary })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { ...row.lead, assigneeName: row.assigneeName ?? 'Unassigned', receivedLabel: relativeTime(row.lead.receivedAt), lastContactLabel: relativeTime(row.lead.lastContactAt), lastActivityLabel: relativeTime(row.lead.lastActivityAt), notes: leadNotes, communications: leadComms, activities: leadActivities, timeline };
}

export function dashboardMetrics() {
  const leadRows = listLeads();
  const total = leadRows.length;
  const hot = leadRows.filter((lead) => ['Hot', 'SLA Risk'].includes(lead.urgency)).length;
  const needsAction = leadRows.filter((lead) => ['New', 'Needs Attention'].includes(lead.urgency) || lead.lifecycle === 'New').length;
  const slaRisk = leadRows.filter((lead) => lead.urgency === 'SLA Risk').length;
  const contacted = leadRows.filter((lead) => !!lead.lastContactAt).length;
  const avgResponseMinutes = contacted ? Math.round(leadRows.filter((lead) => lead.lastContactAt).reduce((sum, lead) => sum + ((new Date(lead.lastContactAt!).getTime() - new Date(lead.receivedAt).getTime()) / 60000), 0) / contacted) : 0;
  return { total, hot, needsAction, slaRisk, avgResponseMinutes };
}

export type InboundLeadInput = { source: string; name: string; company?: string; email?: string; phone?: string; state?: string; service?: string; details?: string; };
export type ImportedLeadRow = InboundLeadInput & { rowNumber: number; };

export type DuplicateMatch = {
  leadId: string;
  name: string;
  company: string;
  matchedOn: ('email' | 'phone' | 'name_company')[];
  email: string;
  phone: string;
  lifecycle: string;
};

export type DuplicateCheckResult = {
  isDuplicate: boolean;
  matches: DuplicateMatch[];
  reason: string | null;
};

function leadUrgency(input: InboundLeadInput) {
  const actionable = Boolean(input.name && (input.email || input.phone) && input.details);
  return { actionable, urgency: actionable ? 'Hot' : 'Needs Attention', lifecycle: 'New' };
}

export function findDuplicateLeads(input: Pick<InboundLeadInput, 'name' | 'company' | 'email' | 'phone'>): DuplicateCheckResult {
  const email = comparable(input.email);
  const phone = normalizePhone(input.phone);
  const name = comparable(input.name);
  const company = comparable(input.company);
  const rows = db.select().from(leads).all();
  const matches = rows.flatMap((lead) => {
    const matchedOn: DuplicateMatch['matchedOn'] = [];
    if (email && comparable(lead.email) === email) matchedOn.push('email');
    if (phone && normalizePhone(lead.phone) === phone) matchedOn.push('phone');
    if (name && company && comparable(lead.name) === name && comparable(lead.company) === company) matchedOn.push('name_company');
    if (!matchedOn.length) return [];
    return [{ leadId: lead.id, name: lead.name, company: lead.company, matchedOn, email: lead.email, phone: lead.phone, lifecycle: lead.lifecycle }];
  });
  const reason = matches.length ? `Matched existing lead by ${matches[0].matchedOn.join(', ')}.` : null;
  return { isDuplicate: matches.length > 0, matches, reason };
}

export function createInboundLead(input: InboundLeadInput) {
  const org = db.select().from(organizations).get();
  if (!org) throw new Error('No organization configured');
  const decision = leadUrgency(input);
  const leadId = id('lead');
  const now = iso();
  const dueAt = plusMinutes(5);
  db.transaction(() => {
    db.insert(leads).values({ id: leadId, organizationId: org.id, name: input.name, company: input.company?.trim() || 'Unknown company', source: input.source, service: input.service?.trim() || 'General inquiry', state: input.state?.trim() || 'Unknown', lifecycle: decision.lifecycle, urgency: decision.urgency, assigneeUserId: null, email: input.email?.trim() || 'unknown@example.com', phone: input.phone?.trim() || 'Unknown', receivedAt: now, lastContactAt: null, lastActivityAt: now, firstResponseDueAt: dueAt, inboundPayloadJson: JSON.stringify(input), createdAt: now, updatedAt: now }).run();
    db.insert(inboundEvents).values({ id: id('evt'), organizationId: org.id, source: input.source, actionable: decision.actionable, status: decision.actionable ? 'accepted' : 'review_required', leadId, payloadJson: JSON.stringify(input), createdAt: now }).run();
    ensureConversationForLead(leadId, org.id, input.email ? 'Email' : input.phone ? 'SMS' : 'Chat', null);
    db.insert(activities).values([
      { id: id('act'), leadId, type: 'lead_received', label: 'Lead received', detail: `${input.source} submission normalized into LeadSprint.`, createdAt: now },
      { id: id('act'), leadId, type: 'sla_started', label: 'SLA window started', detail: `First-response window ends ${relativeTime(dueAt)}.`, createdAt: now },
    ]).run();
    if (decision.actionable) {
      const body = `Thanks for reaching out — we received your ${input.service?.toLowerCase() || 'inquiry'} and will follow up shortly. Reply here with the best callback time if you’d like.`;
      db.insert(outboundJobs).values({ id: id('job'), leadId, channel: input.email ? 'Email' : 'SMS', status: 'queued', provider: input.email ? 'gmail' : 'sms-placeholder', toAddress: input.email?.trim() || input.phone?.trim() || 'unknown', subject: 'We received your inquiry', body, attemptCount: 0, payloadJson: JSON.stringify(input), createdAt: now }).run();
      db.insert(communications).values({ id: id('comm'), leadId, channel: input.email ? 'Email' : 'SMS', direction: 'Outbound', actorName: 'Bot', subject: input.email ? 'We received your inquiry' : null, summary: 'First-response draft queued for delivery.', content: body, createdAt: now }).run();
      db.insert(activities).values({ id: id('act'), leadId, type: 'first_response_queued', label: 'First response queued', detail: 'Automated first-response job created for provider dispatch.', createdAt: now }).run();
    } else {
      db.insert(notes).values({ id: id('note'), leadId, authorUserId: 'user_system', authorName: 'System', type: 'review_required', content: 'Inbound submission lacked enough information for automatic outreach. Manual review needed.', createdAt: now }).run();
    }
  });
  return getLeadDetail(leadId) as NonNullable<ReturnType<typeof getLeadDetail>>;
}

export function createManualLead(input: InboundLeadInput) {
  return createInboundLead({ ...input, source: input.source || 'Manual Intake' });
}

export function createLeadIfNotDuplicate(input: InboundLeadInput, mode: 'manual' | 'inbound' = 'manual') {
  const duplicate = findDuplicateLeads(input);
  if (duplicate.isDuplicate) return { created: false as const, duplicate, lead: null };
  const lead = mode === 'manual' ? createManualLead(input) : createInboundLead(input);
  return { created: true as const, duplicate, lead };
}

export function importLeadsFromCsv(csvText: string) {
  const lines = csvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return { created: [], skipped: [{ rowNumber: 0, reason: 'CSV must include a header row and at least one data row.' }] };

  const parseCsvLine = (line: string) => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else current += char;
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const rows = lines.slice(1);
  const created: ReturnType<typeof getLeadDetail>[] = [];
  const skipped: { rowNumber: number; reason: string }[] = [];

  rows.forEach((line, index) => {
    const rowNumber = index + 2;
    const values = parseCsvLine(line);
    const record = Object.fromEntries(headers.map((header, i) => [header, values[i] ?? '']));
    const name = String(record.name || '').trim();
    const source = String(record.source || 'CSV Import').trim();
    if (!name) {
      skipped.push({ rowNumber, reason: 'Missing required name field.' });
      return;
    }
    const payload = { source, name, company: String(record.company || '').trim(), email: String(record.email || '').trim(), phone: String(record.phone || '').trim(), state: String(record.state || '').trim(), service: String(record.service || '').trim(), details: String(record.details || record.message || '').trim() };
    const result = createLeadIfNotDuplicate(payload, 'manual');
    if (!result.created) {
      skipped.push({ rowNumber, reason: `Skipped duplicate. ${result.duplicate.reason ?? 'Matched existing lead.'}` });
      return;
    }
    created.push(result.lead);
  });

  return { created, skipped };
}

export function updateLeadAssignment(leadId: string, assigneeUserId: string | null) {
  const now = iso();
  const assignee = assigneeUserId ? db.select().from(users).where(eq(users.id, assigneeUserId)).get() : null;
  db.update(leads).set({ assigneeUserId, lastActivityAt: now, updatedAt: now }).where(eq(leads.id, leadId)).run();
  db.insert(activities).values({ id: id('act'), leadId, type: 'assigned', label: assignee ? 'Assigned' : 'Unassigned', detail: assignee ? `Assigned to ${assignee.name}.` : 'Lead was unassigned.', createdAt: now }).run();
}

export function updateLeadLifecycle(leadId: string, lifecycle: LeadRow['lifecycle']) {
  const now = iso();
  db.update(leads).set({ lifecycle, lastActivityAt: now, updatedAt: now }).where(eq(leads.id, leadId)).run();
  db.insert(activities).values({ id: id('act'), leadId, type: 'lifecycle_changed', label: 'Lifecycle updated', detail: `Lead moved to ${lifecycle}.`, createdAt: now }).run();
}

export function addLeadNote(leadId: string, content: string, actor: { id: string; name: string }) {
  const now = iso();
  db.insert(notes).values({ id: id('note'), leadId, authorUserId: actor.id, authorName: actor.name, type: 'internal_comment', content, createdAt: now }).run();
  db.update(leads).set({ lastActivityAt: now, updatedAt: now }).where(eq(leads.id, leadId)).run();
  db.insert(activities).values({ id: id('act'), leadId, type: 'note_added', label: 'Internal note added', detail: `${actor.name} added internal context to the lead.`, createdAt: now }).run();
}

export function logManualContact(leadId: string, channel: string, summary: string, content: string, actor: { name: string }) {
  const now = iso();
  const lead = db.select().from(leads).where(eq(leads.id, leadId)).get();
  if (lead) ensureConversationForLead(leadId, lead.organizationId, channel, lead.assigneeUserId);
  db.insert(communications).values({ id: id('comm'), leadId, channel, direction: 'Outbound', actorName: actor.name, summary, content, createdAt: now }).run();
  db.update(leads).set({ lastContactAt: now, lastActivityAt: now, updatedAt: now, lifecycle: 'Contacted' }).where(eq(leads.id, leadId)).run();
  db.insert(activities).values({ id: id('act'), leadId, type: 'manual_contact_logged', label: 'Manual contact logged', detail: `${channel} contact recorded in lead timeline by ${actor.name}.`, createdAt: now }).run();
}

export function recentInboundEvents() {
  return db.select().from(inboundEvents).orderBy(desc(inboundEvents.createdAt)).all();
}

export function queuedOutboundJobs() {
  return db.select().from(outboundJobs).where(eq(outboundJobs.status, 'queued')).orderBy(desc(outboundJobs.createdAt)).all();
}

function ensureConversationForLead(leadId: string, organizationId: string, channel: string, assignedUserId?: string | null) {
  const existing = db.select().from(conversations).where(eq(conversations.leadId, leadId)).all().find((row) => row.channel === channel);
  const now = iso();
  if (existing) {
    db.update(conversations).set({ lastMessageAt: now, updatedAt: now, assignedUserId: assignedUserId ?? existing.assignedUserId }).where(eq(conversations.id, existing.id)).run();
    return existing.id;
  }
  const conversationId = id('conv');
  db.insert(conversations).values({ id: conversationId, organizationId, leadId, channel, status: 'Open', assignedUserId: assignedUserId ?? null, lastMessageAt: now, createdAt: now, updatedAt: now }).run();
  return conversationId;
}

export function conversationInbox() {
  const rows = db.select({ conversation: conversations, lead: leads, assigneeName: users.name })
    .from(conversations)
    .innerJoin(leads, eq(conversations.leadId, leads.id))
    .leftJoin(users, eq(conversations.assignedUserId, users.id))
    .orderBy(desc(conversations.lastMessageAt))
    .all();

  return rows.map(({ conversation, lead, assigneeName }) => ({
    ...conversation,
    leadName: lead.name,
    company: lead.company,
    urgency: lead.urgency,
    lifecycle: lead.lifecycle,
    assigneeName: assigneeName ?? 'Unassigned',
    lastMessageLabel: relativeTime(conversation.lastMessageAt),
  }));
}

export function getConversationThread(conversationId: string) {
  const row = db.select({ conversation: conversations, lead: leads, assigneeName: users.name })
    .from(conversations)
    .innerJoin(leads, eq(conversations.leadId, leads.id))
    .leftJoin(users, eq(conversations.assignedUserId, users.id))
    .where(eq(conversations.id, conversationId))
    .get();
  if (!row) return null;

  const messages = db.select().from(communications).where(eq(communications.leadId, row.lead.id)).orderBy(desc(communications.createdAt)).all().filter((item) => item.channel === row.conversation.channel);

  return {
    ...row.conversation,
    lead: row.lead,
    assigneeName: row.assigneeName ?? 'Unassigned',
    messages,
    lastMessageLabel: relativeTime(row.conversation.lastMessageAt),
  };
}

export function getOutboundJob(jobId: string) {
  return db.select().from(outboundJobs).where(eq(outboundJobs.id, jobId)).get() ?? null;
}

export function markOutboundJobProcessing(jobId: string) {
  const now = iso();
  const job = getOutboundJob(jobId);
  if (!job) throw new Error('Outbound job not found');
  db.update(outboundJobs).set({ status: 'processing', attemptCount: (job.attemptCount ?? 0) + 1, lastAttemptAt: now, lastErrorCode: null, lastErrorMessage: null }).where(eq(outboundJobs.id, jobId)).run();
}

export function markOutboundJobSent(jobId: string, providerMessageId?: string, detail?: string) {
  const job = db.select().from(outboundJobs).where(eq(outboundJobs.id, jobId)).get();
  if (!job) throw new Error('Outbound job not found');
  const now = iso();
  db.transaction(() => {
    db.update(outboundJobs).set({ status: 'sent', providerMessageId: providerMessageId ?? job.providerMessageId ?? null, sentAt: now, failedAt: null, lastErrorCode: null, lastErrorMessage: null }).where(eq(outboundJobs.id, jobId)).run();
    db.insert(communications).values({ id: id('comm'), leadId: job.leadId, channel: job.channel, direction: 'Outbound', actorName: 'Dispatcher', subject: job.subject, summary: detail || 'Queued outbound job sent through provider boundary.', content: job.body, createdAt: now }).run();
    db.update(leads).set({ lastContactAt: now, lastActivityAt: now, updatedAt: now, lifecycle: 'Contacted' }).where(eq(leads.id, job.leadId)).run();
    db.insert(activities).values({ id: id('act'), leadId: job.leadId, type: 'outbound_job_sent', label: 'Outbound sent', detail: `${job.channel} job was sent through ${job.provider}.`, createdAt: now }).run();
  });
}

export function markOutboundJobFailed(jobId: string, reason?: string, errorCode?: string) {
  const job = db.select().from(outboundJobs).where(eq(outboundJobs.id, jobId)).get();
  if (!job) throw new Error('Outbound job not found');
  const now = iso();
  db.update(outboundJobs).set({ status: 'failed', failedAt: now, lastErrorCode: errorCode ?? null, lastErrorMessage: reason?.trim() || `${job.channel} job requires manual intervention.` }).where(eq(outboundJobs.id, jobId)).run();
  db.update(leads).set({ urgency: 'Needs Attention', lastActivityAt: now, updatedAt: now }).where(eq(leads.id, job.leadId)).run();
  db.insert(activities).values({ id: id('act'), leadId: job.leadId, type: 'outbound_job_failed', label: 'Outbound failed', detail: reason?.trim() || `${job.channel} job requires manual intervention.`, createdAt: now }).run();
}

export function reportSummary() {
  const leadRows = listLeads();
  const sourceCounts = new Map<string, number>();
  const lifecycleCounts = new Map<string, number>();
  const assigneeCounts = new Map<string, number>();
  for (const lead of leadRows) {
    sourceCounts.set(lead.source, (sourceCounts.get(lead.source) ?? 0) + 1);
    lifecycleCounts.set(lead.lifecycle, (lifecycleCounts.get(lead.lifecycle) ?? 0) + 1);
    assigneeCounts.set(lead.assigneeName, (assigneeCounts.get(lead.assigneeName) ?? 0) + 1);
  }
  const total = leadRows.length;
  const withContact = leadRows.filter((lead) => !!lead.lastContactAt).length;
  const unassigned = leadRows.filter((lead) => lead.assigneeName === 'Unassigned').length;
  const hot = leadRows.filter((lead) => ['Hot', 'SLA Risk'].includes(lead.urgency)).length;
  const converted = leadRows.filter((lead) => lead.lifecycle === 'Converted').length;
  return {
    totals: { total, withContact, unassigned, hot, converted },
    bySource: Array.from(sourceCounts.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    byLifecycle: Array.from(lifecycleCounts.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    byAssignee: Array.from(assigneeCounts.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
  };
}

export function leadsCsv() {
  const rows = listLeads();
  const header = ['id', 'name', 'company', 'source', 'state', 'lifecycle', 'urgency', 'assignee', 'email', 'phone', 'service', 'receivedAt', 'lastContactAt', 'lastActivityAt', 'firstResponseDueAt'];
  const escape = (value: string | null | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((lead) => [lead.id, lead.name, lead.company, lead.source, lead.state, lead.lifecycle, lead.urgency, lead.assigneeName, lead.email, lead.phone, lead.service, lead.receivedAt, lead.lastContactAt, lead.lastActivityAt, lead.firstResponseDueAt].map(escape).join(','));
  return [header.join(','), ...lines].join('\n');
}
