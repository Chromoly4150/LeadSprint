'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { internalApiFetch } from '../../../lib/api/internal-api';

export async function approveBusinessRequestAction(formData: FormData) {
  const requestId = String(formData.get('requestId') || '');
  const reviewNotes = String(formData.get('reviewNotes') || '').trim();
  if (!requestId) return;
  await internalApiFetch(`/api/admin/access-requests/${requestId}/approve-business`, {
    method: 'POST',
    body: JSON.stringify({ reviewNotes }),
  });
  revalidatePath('/settings');
  redirect('/settings');
}

export async function rejectBusinessRequestAction(formData: FormData) {
  const requestId = String(formData.get('requestId') || '');
  const reviewNotes = String(formData.get('reviewNotes') || '').trim();
  if (!requestId) return;
  await internalApiFetch(`/api/admin/access-requests/${requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reviewNotes }),
  });
  revalidatePath('/settings');
  redirect('/settings');
}

export async function followUpBusinessRequestAction(formData: FormData) {
  const requestId = String(formData.get('requestId') || '');
  const reviewNotes = String(formData.get('reviewNotes') || '').trim();
  if (!requestId) return;
  await internalApiFetch(`/api/admin/access-requests/${requestId}/needs-follow-up`, {
    method: 'POST',
    body: JSON.stringify({ reviewNotes }),
  });
  revalidatePath('/settings');
  redirect('/settings');
}

export async function createInvitationAction(formData: FormData) {
  const organizationId = String(formData.get('organizationId') || '');
  const email = String(formData.get('email') || '').trim();
  const role = String(formData.get('role') || 'agent').trim();
  if (!organizationId || !email) return;
  await internalApiFetch(`/api/organizations/${organizationId}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
  revalidatePath('/settings');
  redirect('/settings');
}

export async function revokeInvitationAction(formData: FormData) {
  const invitationId = String(formData.get('invitationId') || '').trim();
  if (!invitationId) return;
  await internalApiFetch(`/api/invitations/${invitationId}/revoke`, {
    method: 'POST',
  });
  revalidatePath('/settings');
  redirect('/settings');
}

export async function bootstrapGmailProviderAction() {
  await internalApiFetch('/api/email/providers/gmail/bootstrap', {
    method: 'POST',
  });
  revalidatePath('/settings');
  redirect('/settings');
}

export async function startGmailOAuthAction() {
  const res = await internalApiFetch<{ authUrl: string }>('/api/auth/gmail/start');
  redirect(res.authUrl);
}
