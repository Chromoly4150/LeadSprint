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

export async function updateUserAction(formData: FormData) {
  const userId = String(formData.get('userId') || '').trim();
  const fullName = String(formData.get('fullName') || '').trim();
  const role = String(formData.get('role') || '').trim();
  const status = String(formData.get('status') || '').trim();
  if (!userId || !fullName || !role || !status) return;
  try {
    await internalApiFetch(`/api/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fullName, role, status }),
    });
    revalidatePath('/settings');
    settingsRedirect('User updated.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not update user.');
  }
}

export async function removeUserAction(formData: FormData) {
  const userId = String(formData.get('userId') || '').trim();
  if (!userId) return;
  try {
    await internalApiFetch(`/api/users/${userId}`, { method: 'DELETE' });
    revalidatePath('/settings');
    settingsRedirect('User removed.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not remove user.');
  }
}

export async function updatePermissionOverridesAction(formData: FormData) {
  const userId = String(formData.get('userId') || '').trim();
  if (!userId) return;
  const preset = String(formData.get('preset') || '').trim();
  const presetPermissions: Record<string, Record<string, boolean>> = {
    none: {
      'settings.manageBusiness': false,
      'settings.manageTemplates': false,
      'platform.accessRequests.review': false,
      'platform.users.manage': false,
    },
    company_manager: {
      'settings.manageBusiness': true,
      'settings.manageTemplates': true,
      'platform.accessRequests.review': false,
      'platform.users.manage': false,
    },
    platform_reviewer: {
      'settings.manageBusiness': true,
      'settings.manageTemplates': true,
      'platform.accessRequests.review': true,
      'platform.users.manage': false,
    },
    platform_manager: {
      'settings.manageBusiness': true,
      'settings.manageTemplates': true,
      'platform.accessRequests.review': true,
      'platform.users.manage': true,
    },
  };
  const permissions = preset && presetPermissions[preset]
    ? presetPermissions[preset]
    : {
        'settings.manageBusiness': formData.get('settings.manageBusiness') === 'on',
        'settings.manageTemplates': formData.get('settings.manageTemplates') === 'on',
        'platform.accessRequests.review': formData.get('platform.accessRequests.review') === 'on',
        'platform.users.manage': formData.get('platform.users.manage') === 'on',
      };
  try {
    await internalApiFetch(`/api/users/${userId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    });
    revalidatePath('/settings');
    settingsRedirect('Permission overrides saved.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not save permission overrides.');
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

export async function updateAiSettingsAction(formData: FormData) {
  const aiEnabled = formData.get('aiEnabled') === 'on';
  const defaultMode = String(formData.get('defaultMode') || 'draft_only');
  const responseSlaTargetMinutes = Number(formData.get('responseSlaTargetMinutes') || 5);
  const usagePlan = String(formData.get('usagePlan') || 'standard');
  const monthlyMessageLimit = Number(formData.get('monthlyMessageLimit') || 250);
  const monthlyAiTokenBudget = Number(formData.get('monthlyAiTokenBudget') || 250000);
  const allowedChannels = formData.getAll('allowedChannels').map(String);
  const allowedActions = formData.getAll('allowedActions').map(String);
  const defaultTone = String(formData.get('defaultTone') || 'professional and warm').trim();
  const businessName = String(formData.get('businessName') || '').trim();
  const bookingLink = String(formData.get('bookingLink') || '').trim();

  try {
    await internalApiFetch('/api/settings/ai', {
      method: 'PUT',
      body: JSON.stringify({
        aiEnabled,
        defaultMode,
        responseSlaTargetMinutes,
        usagePlan,
        monthlyMessageLimit,
        monthlyAiTokenBudget,
        allowedChannels,
        allowedActions,
        toneProfile: { defaultTone },
        businessContext: { businessName, bookingLink },
      }),
    });
    revalidatePath('/settings');
    settingsRedirect('AI settings saved.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not save AI settings.');
  }
}

export async function startGmailOAuthAction() {
  const res = await internalApiFetch<{ authUrl: string }>('/api/auth/gmail/start');
  redirect(res.authUrl);
}
