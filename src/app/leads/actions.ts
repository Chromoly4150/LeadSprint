'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser, requirePermission } from '@/lib/permissions';
import {
  addLeadNote,
  createInboundLead,
  logManualContact,
  markOutboundJobFailed,
  markOutboundJobSent,
  updateLeadAssignment,
  updateLeadLifecycle,
} from '@/lib/db';

export async function createInboundLeadAction(formData: FormData) {
  const user = await getCurrentUser();
  await requirePermission(user, 'leads.create');

  const lead = createInboundLead({
    source: String(formData.get('source') || 'Manual Intake'),
    name: String(formData.get('name') || '').trim(),
    company: String(formData.get('company') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    state: String(formData.get('state') || '').trim(),
    service: String(formData.get('service') || '').trim(),
    details: String(formData.get('details') || '').trim(),
  });

  revalidatePath('/dashboard');
  revalidatePath('/leads');
  revalidatePath(`/leads/${lead.id}`);
  redirect(`/leads/${lead.id}`);
}

export async function updateAssignmentAction(formData: FormData) {
  const user = await getCurrentUser();
  await requirePermission(user, 'leads.assign');

  const leadId = String(formData.get('leadId'));
  const assigneeUserId = String(formData.get('assigneeUserId') || '');
  updateLeadAssignment(leadId, assigneeUserId || null);
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
  revalidatePath('/dashboard');
  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);
}

export async function markOutboundSentAction(formData: FormData) {
  const user = await getCurrentUser();
  await requirePermission(user, 'conversations.takeover');

  const jobId = String(formData.get('jobId'));
  const leadId = String(formData.get('leadId'));
  markOutboundJobSent(jobId);
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);
}

export async function markOutboundFailedAction(formData: FormData) {
  const user = await getCurrentUser();
  await requirePermission(user, 'conversations.takeover');

  const jobId = String(formData.get('jobId'));
  const leadId = String(formData.get('leadId'));
  const reason = String(formData.get('reason') || '').trim();
  markOutboundJobFailed(jobId, reason);
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);
}
