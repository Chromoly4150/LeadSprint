'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { internalApiFetch } from '../../../lib/api/internal-api';

async function apiMutation(path: string, init: RequestInit) {
  return internalApiFetch(path, init);
}

function getReturnPath(formData: FormData, leadId: string) {
  const returnTo = String(formData.get('returnTo') || '').trim();
  if (returnTo === 'inbox-thread') return `/inbox/${leadId}`;
  return `/leads?selected=${leadId}`;
}

function leadSurfaceRedirect(leadId: string, formData: FormData, message?: string, error?: string) {
  const base = getReturnPath(formData, leadId);
  const params = new URLSearchParams();
  if (base.includes('?')) {
    const [path, search] = base.split('?');
    const existing = new URLSearchParams(search || '');
    existing.forEach((value, key) => params.set(key, value));
    if (message) params.set('message', message);
    if (error) params.set('error', error);
    redirect(`${path}?${params.toString()}`);
  }
  if (message) params.set('message', message);
  if (error) params.set('error', error);
  redirect(params.size ? `${base}?${params.toString()}` : base);
}

export async function updateLeadStatusAction(formData: FormData) {
  const leadId = String(formData.get('leadId') || '');
  const status = String(formData.get('status') || '');
  if (!leadId || !status) return;
  await apiMutation(`/api/leads/${leadId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  revalidatePath('/leads');
  revalidatePath('/inbox');
  revalidatePath(`/inbox/${leadId}`);
  leadSurfaceRedirect(leadId, formData);
}

export async function updateLeadUrgencyAction(formData: FormData) {
  const leadId = String(formData.get('leadId') || '');
  const urgencyStatus = String(formData.get('urgencyStatus') || '');
  if (!leadId || !urgencyStatus) return;
  await apiMutation(`/api/leads/${leadId}/urgency`, { method: 'PATCH', body: JSON.stringify({ urgencyStatus }) });
  revalidatePath('/leads');
  revalidatePath('/inbox');
  revalidatePath(`/inbox/${leadId}`);
  leadSurfaceRedirect(leadId, formData);
}

export async function addLeadNoteAction(formData: FormData) {
  const leadId = String(formData.get('leadId') || '');
  const content = String(formData.get('content') || '').trim();
  if (!leadId || !content) return;
  await apiMutation(`/api/leads/${leadId}/notes`, { method: 'POST', body: JSON.stringify({ content, noteType: 'general' }) });
  revalidatePath('/leads');
  revalidatePath('/inbox');
  revalidatePath(`/inbox/${leadId}`);
  leadSurfaceRedirect(leadId, formData);
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
  revalidatePath('/inbox');
  revalidatePath(`/inbox/${leadId}`);
  leadSurfaceRedirect(leadId, formData);
}

export async function createDraftAction(formData: FormData) {
  const leadId = String(formData.get('leadId') || '');
  const toEmail = String(formData.get('toEmail') || '').trim();
  const subject = String(formData.get('subject') || '').trim();
  const body = String(formData.get('body') || '').trim();
  if (!leadId || !toEmail || !subject || !body) return;
  await apiMutation(`/api/leads/${leadId}/email-drafts`, { method: 'POST', body: JSON.stringify({ toEmail, subject, body, source: 'manual' }) });
  revalidatePath('/leads');
  revalidatePath('/inbox');
  revalidatePath(`/inbox/${leadId}`);
  leadSurfaceRedirect(leadId, formData);
}

export async function queueOutboxAction(formData: FormData) {
  const leadId = String(formData.get('leadId') || '');
  const emailDraftId = String(formData.get('emailDraftId') || '').trim();
  const emailAccountId = String(formData.get('emailAccountId') || '').trim();
  if (!leadId) return;
  await apiMutation(`/api/leads/${leadId}/email-outbox`, { method: 'POST', body: JSON.stringify({ emailDraftId: emailDraftId || undefined, emailAccountId: emailAccountId || undefined }) });
  revalidatePath('/leads');
  revalidatePath('/inbox');
  revalidatePath(`/inbox/${leadId}`);
  leadSurfaceRedirect(leadId, formData, 'Outbox item queued.');
}

export async function generateAiDraftAction(formData: FormData) {
  const leadId = String(formData.get('leadId') || '').trim();
  const toEmail = String(formData.get('toEmail') || '').trim();
  if (!leadId) return;
  try {
    const res = await apiMutation(`/api/leads/${leadId}/ai/draft-response`, { method: 'POST', body: JSON.stringify({}) }) as { draft?: { subject?: string; draft?: string } };
    if (!res?.draft?.subject || !res?.draft?.draft) {
      throw new Error('AI draft was empty');
    }
    if (!toEmail) {
      throw new Error('Lead has no email address for draft creation');
    }
    await apiMutation(`/api/leads/${leadId}/email-drafts`, {
      method: 'POST',
      body: JSON.stringify({ toEmail, subject: res.draft.subject, body: res.draft.draft, source: 'ai' }),
    });
    revalidatePath('/leads');
    revalidatePath('/inbox');
    revalidatePath(`/inbox/${leadId}`);
    leadSurfaceRedirect(leadId, formData, `AI draft created: ${res.draft.subject}`);
  } catch (error) {
    leadSurfaceRedirect(leadId, formData, undefined, error instanceof Error ? error.message : 'Could not generate AI draft.');
  }
}

export async function processOutboxItemAction(formData: FormData) {
  const leadId = String(formData.get('leadId') || '').trim();
  const outboxItemId = String(formData.get('outboxItemId') || '').trim();
  if (!leadId || !outboxItemId) return;
  try {
    await apiMutation(`/api/email-outbox/${outboxItemId}/process`, { method: 'POST', body: JSON.stringify({}) });
    revalidatePath('/leads');
    revalidatePath('/inbox');
    revalidatePath(`/inbox/${leadId}`);
    leadSurfaceRedirect(leadId, formData, 'Outbox item processed.');
  } catch (error) {
    leadSurfaceRedirect(leadId, formData, undefined, error instanceof Error ? error.message : 'Could not process outbox item.');
  }
}

export async function processLeadOutboxQueueAction(formData: FormData) {
  const leadId = String(formData.get('leadId') || '').trim();
  if (!leadId) return;
  try {
    const result = await apiMutation(`/api/leads/${leadId}/email-outbox/process`, { method: 'POST', body: JSON.stringify({}) }) as { summary?: { processed: number; failed: number } };
    revalidatePath('/leads');
    revalidatePath('/inbox');
    revalidatePath(`/inbox/${leadId}`);
    const processed = result?.summary?.processed || 0;
    const failed = result?.summary?.failed || 0;
    leadSurfaceRedirect(leadId, formData, `Processed ${processed} outbox item(s)${failed ? `, ${failed} failed` : ''}.`);
  } catch (error) {
    leadSurfaceRedirect(leadId, formData, undefined, error instanceof Error ? error.message : 'Could not process lead outbox queue.');
  }
}
