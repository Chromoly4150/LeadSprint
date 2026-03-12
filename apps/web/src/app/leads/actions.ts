'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { API_BASE } from '../../lib/api';

const USER_EMAIL = 'owner@leadsprint.local';

async function apiMutation(path: string, init: RequestInit) {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  if (!headers.has('x-user-email')) headers.set('x-user-email', USER_EMAIL);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function updateLeadStatusAction(formData: FormData) {
  const leadId = String(formData.get('leadId') || '');
  const status = String(formData.get('status') || '');
  if (!leadId || !status) return;
  await apiMutation(`/api/leads/${leadId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  revalidatePath('/leads');
  redirect(`/leads?selected=${leadId}`);
}

export async function updateLeadUrgencyAction(formData: FormData) {
  const leadId = String(formData.get('leadId') || '');
  const urgencyStatus = String(formData.get('urgencyStatus') || '');
  if (!leadId || !urgencyStatus) return;
  await apiMutation(`/api/leads/${leadId}/urgency`, { method: 'PATCH', body: JSON.stringify({ urgencyStatus }) });
  revalidatePath('/leads');
  redirect(`/leads?selected=${leadId}`);
}

export async function addLeadNoteAction(formData: FormData) {
  const leadId = String(formData.get('leadId') || '');
  const content = String(formData.get('content') || '').trim();
  if (!leadId || !content) return;
  await apiMutation(`/api/leads/${leadId}/notes`, { method: 'POST', body: JSON.stringify({ content, noteType: 'general' }) });
  revalidatePath('/leads');
  redirect(`/leads?selected=${leadId}`);
}

export async function addCommunicationAction(formData: FormData) {
  const leadId = String(formData.get('leadId') || '');
  const channel = String(formData.get('channel') || 'email').trim().toLowerCase();
  const direction = String(formData.get('direction') || 'outbound').trim().toLowerCase();
  const subject = String(formData.get('subject') || '').trim();
  const summary = String(formData.get('summary') || '').trim();
  const content = String(formData.get('content') || '').trim();
  if (!leadId || (!summary && !content)) return;
  await apiMutation(`/api/leads/${leadId}/communications`, { method: 'POST', body: JSON.stringify({ channel, direction, subject, summary, content }) });
  revalidatePath('/leads');
  redirect(`/leads?selected=${leadId}`);
}

export async function createDraftAction(formData: FormData) {
  const leadId = String(formData.get('leadId') || '');
  const toEmail = String(formData.get('toEmail') || '').trim();
  const subject = String(formData.get('subject') || '').trim();
  const body = String(formData.get('body') || '').trim();
  if (!leadId || !toEmail || !subject || !body) return;
  await apiMutation(`/api/leads/${leadId}/email-drafts`, { method: 'POST', body: JSON.stringify({ toEmail, subject, body, source: 'manual' }) });
  revalidatePath('/leads');
  redirect(`/leads?selected=${leadId}`);
}

export async function queueOutboxAction(formData: FormData) {
  const leadId = String(formData.get('leadId') || '');
  const emailDraftId = String(formData.get('emailDraftId') || '').trim();
  const providerKey = String(formData.get('providerKey') || 'gmail').trim();
  if (!leadId) return;
  await apiMutation(`/api/leads/${leadId}/email-outbox`, { method: 'POST', body: JSON.stringify({ emailDraftId: emailDraftId || undefined, providerKey }) });
  revalidatePath('/leads');
  redirect(`/leads?selected=${leadId}`);
}
