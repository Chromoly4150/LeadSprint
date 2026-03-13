'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { internalApiFetch } from '../../../lib/api/internal-api';

function settingsRedirect(message?: string, error?: string) {
  const params = new URLSearchParams();
  if (message) params.set('message', message);
  if (error) params.set('error', error);
  redirect(`/settings${params.size ? `?${params.toString()}` : ''}`);
}

export async function approveAccessRequestAction(formData: FormData) {
  const requestId = String(formData.get('requestId') || '');
  const reviewNotes = String(formData.get('reviewNotes') || '').trim();
  if (!requestId) return;
  try {
    const res = await internalApiFetch<{ activationUrl?: string; awaitingActivation?: boolean }>(`/api/admin/access-requests/${requestId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reviewNotes }),
    });
    revalidatePath('/settings');
    settingsRedirect(res.awaitingActivation && res.activationUrl ? `Approved for activation: ${res.activationUrl}` : 'Request approved successfully.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not approve request.');
  }
}

export async function rejectBusinessRequestAction(formData: FormData) {
  const requestId = String(formData.get('requestId') || '');
  const reviewNotes = String(formData.get('reviewNotes') || '').trim();
  if (!requestId) return;
  try {
    await internalApiFetch(`/api/admin/access-requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reviewNotes }),
    });
    revalidatePath('/settings');
    settingsRedirect('Request rejected.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not reject request.');
  }
}

export async function followUpBusinessRequestAction(formData: FormData) {
  const requestId = String(formData.get('requestId') || '');
  const reviewNotes = String(formData.get('reviewNotes') || '').trim();
  if (!requestId) return;
  try {
    await internalApiFetch(`/api/admin/access-requests/${requestId}/needs-follow-up`, {
      method: 'POST',
      body: JSON.stringify({ reviewNotes }),
    });
    revalidatePath('/settings');
    settingsRedirect('Request marked for follow-up.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not update request.');
  }
}

export async function createInvitationAction(formData: FormData) {
  const organizationId = String(formData.get('organizationId') || '');
  const email = String(formData.get('email') || '').trim();
  const role = String(formData.get('role') || 'company_agent').trim();
  if (!organizationId || !email) return;
  try {
    await internalApiFetch(`/api/organizations/${organizationId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
    revalidatePath('/settings');
    settingsRedirect('Invitation created.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not create invitation.');
  }
}

export async function createInternalUserAction(formData: FormData) {
  const fullName = String(formData.get('fullName') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const role = String(formData.get('role') || 'platform_agent').trim();
  if (!fullName || !email) return;
  try {
    await internalApiFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify({ fullName, email, role }),
    });
    revalidatePath('/settings');
    settingsRedirect('Internal operator created.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not create internal operator.');
  }
}

export async function revokeInvitationAction(formData: FormData) {
  const invitationId = String(formData.get('invitationId') || '').trim();
  if (!invitationId) return;
  try {
    await internalApiFetch(`/api/invitations/${invitationId}/revoke`, {
      method: 'POST',
    });
    revalidatePath('/settings');
    settingsRedirect('Invitation revoked.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not revoke invitation.');
  }
}

export async function bootstrapGmailProviderAction() {
  try {
    await internalApiFetch('/api/email/providers/gmail/bootstrap', {
      method: 'POST',
    });
    revalidatePath('/settings');
    settingsRedirect('Gmail provider bootstrapped.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not bootstrap Gmail provider.');
  }
}

export async function startGmailOAuthAction() {
  const res = await internalApiFetch<{ authUrl: string }>('/api/auth/gmail/start');
  redirect(res.authUrl);
}
