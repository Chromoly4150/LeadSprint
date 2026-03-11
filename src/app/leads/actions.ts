'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser, requirePermission } from '@/lib/permissions';
import {
  addLeadNote,
  createInboundLead,
  createLeadIfNotDuplicate,
  getLeadDetail,
  importLeadsFromCsv,
  logManualContact,
  markOutboundJobFailed,
  markOutboundJobSent,
  updateLeadAssignment,
  updateLeadLifecycle,
  writeAuditLog,
} from '@/lib/db';
import { dispatchOutboundJob, dispatchQueuedOutboundJobs } from '@/lib/outbound/dispatch';

export async function createInboundLeadAction(formData: FormData) {
  const user = await getCurrentUser();
  await requirePermission(user, 'leads.create');

  const payload = {
    source: String(formData.get('source') || 'Website Form'),
    name: String(formData.get('name') || '').trim(),
    company: String(formData.get('company') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    state: String(formData.get('state') || '').trim(),
    service: String(formData.get('service') || '').trim(),
    details: String(formData.get('details') || '').trim(),
  };
  const lead = createInboundLead(payload);
  writeAuditLog({
    organizationId: lead.organizationId,
    actorId: user.id,
    actorName: user.name,
    action: 'lead.created',
    targetType: 'lead',
    targetId: lead.id,
    metadata: { source: lead.source, urgency: lead.urgency, lifecycle: lead.lifecycle },
  });

  revalidatePath('/dashboard');
  revalidatePath('/leads');
  revalidatePath(`/leads/${lead.id}`);
  redirect(`/leads/${lead.id}`);
}

export async function createManualLeadAction(formData: FormData) {
  const user = await getCurrentUser();
  await requirePermission(user, 'leads.create');

  const payload = {
    source: String(formData.get('source') || 'Manual Intake'),
    name: String(formData.get('name') || '').trim(),
    company: String(formData.get('company') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    state: String(formData.get('state') || '').trim(),
    service: String(formData.get('service') || '').trim(),
    details: String(formData.get('details') || '').trim(),
  };
  const result = createLeadIfNotDuplicate(payload, 'manual');
  if (!result.created) {
    writeAuditLog({
      organizationId: 'org_demo',
      actorId: user.id,
      actorName: user.name,
      action: 'lead.manual_duplicate_blocked',
      targetType: 'lead',
      targetId: result.duplicate.matches[0]?.leadId ?? 'duplicate',
      metadata: { reason: result.duplicate.reason, matches: result.duplicate.matches.map((m) => ({ leadId: m.leadId, matchedOn: m.matchedOn })) },
    });
    return;
  }
  const lead = result.lead;
  writeAuditLog({
    organizationId: lead.organizationId,
    actorId: user.id,
    actorName: user.name,
    action: 'lead.manual_created',
    targetType: 'lead',
    targetId: lead.id,
    metadata: { source: lead.source, urgency: lead.urgency },
  });

  revalidatePath('/dashboard');
  revalidatePath('/leads');
  revalidatePath(`/leads/${lead.id}`);
  redirect(`/leads/${lead.id}`);
}

export async function importLeadsCsvAction(formData: FormData) {
  const user = await getCurrentUser();
  await requirePermission(user, 'leads.create');

  const csvText = String(formData.get('csvText') || '').trim();
  if (!csvText) return;

  const result = importLeadsFromCsv(csvText);
  const organizationId = result.created[0]?.organizationId ?? 'org_demo';
  writeAuditLog({
    organizationId,
    actorId: user.id,
    actorName: user.name,
    action: 'lead.csv_imported',
    targetType: 'import',
    targetId: `csv_${Date.now()}`,
    metadata: { created: result.created.length, skipped: result.skipped.length },
  });

  revalidatePath('/dashboard');
  revalidatePath('/leads');
  revalidatePath('/reports');
}

export async function updateAssignmentAction(formData: FormData) {
  const user = await getCurrentUser();
  await requirePermission(user, 'leads.assign');

  const leadId = String(formData.get('leadId'));
  const assigneeUserId = String(formData.get('assigneeUserId') || '');
  updateLeadAssignment(leadId, assigneeUserId || null);
  const lead = getLeadDetail(leadId);
  if (lead) {
    writeAuditLog({
      organizationId: lead.organizationId,
      actorId: user.id,
      actorName: user.name,
      action: 'lead.assignment_updated',
      targetType: 'lead',
      targetId: leadId,
      metadata: { assigneeUserId: assigneeUserId || null },
    });
  }
  revalidatePath('/dashboard');
  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);
}

export async function updateLifecycleAction(formData: FormData) {
  const user = await getCurrentUser();
  await requirePermission(user, 'leads.edit');

  const leadId = String(formData.get('leadId'));
  const lifecycle = String(formData.get('lifecycle'));
  updateLeadLifecycle(leadId, lifecycle);
  const lead = getLeadDetail(leadId);
  if (lead) {
    writeAuditLog({
      organizationId: lead.organizationId,
      actorId: user.id,
      actorName: user.name,
      action: 'lead.lifecycle_updated',
      targetType: 'lead',
      targetId: leadId,
      metadata: { lifecycle },
    });
  }
  revalidatePath('/dashboard');
  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);
}

export async function addLeadNoteAction(formData: FormData) {
  const user = await getCurrentUser();
  await requirePermission(user, 'notes.create_internal');

  const leadId = String(formData.get('leadId'));
  const content = String(formData.get('content') || '').trim();
  if (!content) return;
  addLeadNote(leadId, content, user);
  const lead = getLeadDetail(leadId);
  if (lead) {
    writeAuditLog({
      organizationId: lead.organizationId,
      actorId: user.id,
      actorName: user.name,
      action: 'lead.note_added',
      targetType: 'lead',
      targetId: leadId,
      metadata: { noteLength: content.length },
    });
  }
  revalidatePath('/dashboard');
  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);
}

export async function logManualContactAction(formData: FormData) {
  const user = await getCurrentUser();
  const channel = String(formData.get('channel') || 'Call');
  if (channel === 'Email') await requirePermission(user, 'messaging.send_email');
  else if (channel === 'SMS') await requirePermission(user, 'messaging.send_sms');
  else await requirePermission(user, 'messaging.send_other');

  const leadId = String(formData.get('leadId'));
  const summary = String(formData.get('summary') || '').trim();
  const content = String(formData.get('content') || '').trim();
  if (!summary || !content) return;
  logManualContact(leadId, channel, summary, content, user);
  const lead = getLeadDetail(leadId);
  if (lead) {
    writeAuditLog({
      organizationId: lead.organizationId,
      actorId: user.id,
      actorName: user.name,
      action: 'lead.manual_contact_logged',
      targetType: 'lead',
      targetId: leadId,
      metadata: { channel, summary },
    });
  }
  revalidatePath('/dashboard');
  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);
}

export async function markOutboundSentAction(formData: FormData) {
  const user = await getCurrentUser();
  await requirePermission(user, 'conversations.takeover');

  const jobId = String(formData.get('jobId'));
  const leadId = String(formData.get('leadId'));
  markOutboundJobSent(jobId, undefined, 'Operator manually marked outbound job sent.');
  const lead = getLeadDetail(leadId);
  if (lead) {
    writeAuditLog({
      organizationId: lead.organizationId,
      actorId: user.id,
      actorName: user.name,
      action: 'outbound.job_marked_sent',
      targetType: 'outbound_job',
      targetId: jobId,
      metadata: { leadId },
    });
  }
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);
}

export async function dispatchOutboundJobAction(formData: FormData) {
  const user = await getCurrentUser();
  await requirePermission(user, 'conversations.takeover');
  const jobId = String(formData.get('jobId'));
  const leadId = String(formData.get('leadId'));
  await dispatchOutboundJob(jobId, user);
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  revalidatePath('/leads');
  revalidatePath('/inbox');
  revalidatePath(`/leads/${leadId}`);
}

export async function dispatchQueuedOutboundJobsAction() {
  const user = await getCurrentUser();
  await requirePermission(user, 'conversations.takeover');
  await dispatchQueuedOutboundJobs(user, 10);
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  revalidatePath('/leads');
  revalidatePath('/inbox');
}

export async function markOutboundFailedAction(formData: FormData) {
  const user = await getCurrentUser();
  await requirePermission(user, 'conversations.takeover');

  const jobId = String(formData.get('jobId'));
  const leadId = String(formData.get('leadId'));
  const reason = String(formData.get('reason') || '').trim();
  markOutboundJobFailed(jobId, reason);
  const lead = getLeadDetail(leadId);
  if (lead) {
    writeAuditLog({
      organizationId: lead.organizationId,
      actorId: user.id,
      actorName: user.name,
      action: 'outbound.job_marked_failed',
      targetType: 'outbound_job',
      targetId: jobId,
      metadata: { leadId, reason },
    });
  }
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);
}
