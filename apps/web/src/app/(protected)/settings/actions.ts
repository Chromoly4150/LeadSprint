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
  const autoGenerateFirstResponseOnLeadCreate = formData.get('autoGenerateFirstResponseOnLeadCreate') === 'on';
  const primaryProvider = String(formData.get('primaryProvider') || 'stub').trim() || 'stub';
  const primaryModel = String(formData.get('primaryModel') || (primaryProvider === 'stub' ? 'stub/draft-v1' : 'gpt-4o-mini')).trim();

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
        compliancePolicy: { requireHumanApprovalForOutbound: true, autoGenerateFirstResponseOnLeadCreate },
        modelPolicy: { primaryProvider, primaryModel, allowedModels: [primaryModel] },
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

export async function updateEmailPolicyAction(formData: FormData) {
  const allowUserMailboxes = formData.get('allowUserMailboxes') === 'on';
  const restrictOutboundToCompanyDomains = formData.get('restrictOutboundToCompanyDomains') === 'on';
  const defaultSendMode = String(formData.get('defaultSendMode') || 'org_default');
  const allowedUserMailboxRoles = formData.getAll('allowedUserMailboxRoles').map(String);
  try {
    await internalApiFetch('/api/settings/email/policy', {
      method: 'PUT',
      body: JSON.stringify({ allowUserMailboxes, restrictOutboundToCompanyDomains, defaultSendMode, allowedUserMailboxRoles }),
    });
    revalidatePath('/settings');
    settingsRedirect('Email policy saved.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not save email policy.');
  }
}

export async function createEmailAccountAction(formData: FormData) {
  const scopeType = String(formData.get('scopeType') || 'organization');
  const providerType = String(formData.get('providerType') || 'stub');
  const providerKey = String(formData.get('providerKey') || '').trim();
  const accountRole = String(formData.get('accountRole') || 'inbox_and_send');
  const emailAddress = String(formData.get('emailAddress') || '').trim();
  const displayName = String(formData.get('displayName') || '').trim();
  const signature = String(formData.get('signature') || '').trim();
  const authMethod = String(formData.get('authMethod') || 'oauth');
  const isDefaultForOrg = formData.get('isDefaultForOrg') === 'on';
  const isDefaultForUser = formData.get('isDefaultForUser') === 'on';
  const capabilities = formData.getAll('capabilities').map(String);
  try {
    await internalApiFetch('/api/settings/email/accounts', {
      method: 'POST',
      body: JSON.stringify({ scopeType, providerType, providerKey: providerKey || undefined, accountRole, emailAddress, displayName, signature, authMethod, isDefaultForOrg, isDefaultForUser, capabilities }),
    });
    revalidatePath('/settings');
    settingsRedirect('Email account added.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not create email account.');
  }
}

export async function connectGmailEmailAccountAction(formData: FormData) {
  const accountId = String(formData.get('accountId') || '').trim();
  if (!accountId) return;
  try {
    const res = await internalApiFetch<{ authUrl: string }>(`/api/settings/email/accounts/${accountId}/connect-gmail`, { method: 'POST', body: JSON.stringify({}) });
    redirect(res.authUrl);
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not start Gmail connection.');
  }
}

export async function setDefaultEmailAccountAction(formData: FormData) {
  const accountId = String(formData.get('accountId') || '').trim();
  if (!accountId) return;
  try {
    await internalApiFetch(`/api/settings/email/accounts/${accountId}/default`, { method: 'POST', body: JSON.stringify({}) });
    revalidatePath('/settings');
    settingsRedirect('Default email account updated.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not update default email account.');
  }
}

export async function disconnectEmailAccountAction(formData: FormData) {
  const accountId = String(formData.get('accountId') || '').trim();
  if (!accountId) return;
  try {
    await internalApiFetch(`/api/settings/email/accounts/${accountId}/disconnect`, { method: 'POST', body: JSON.stringify({}) });
    revalidatePath('/settings');
    settingsRedirect('Email account disconnected.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not disconnect email account.');
  }
}

export async function removeEmailAccountAction(formData: FormData) {
  const accountId = String(formData.get('accountId') || '').trim();
  if (!accountId) return;
  try {
    await internalApiFetch(`/api/settings/email/accounts/${accountId}`, { method: 'DELETE' });
    revalidatePath('/settings');
    settingsRedirect('Email account removed.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not remove email account.');
  }
}

export async function connectMicrosoftEmailAccountAction(formData: FormData) {
  const accountId = String(formData.get('accountId') || '').trim();
  if (!accountId) return;
  try {
    const res = await internalApiFetch<{ authUrl: string }>(`/api/settings/email/accounts/${accountId}/connect-microsoft`, { method: 'POST', body: JSON.stringify({}) });
    redirect(res.authUrl);
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not start Microsoft connection.');
  }
}

export async function saveEmailAccountConfigAction(formData: FormData) {
  const accountId = String(formData.get('accountId') || '').trim();
  if (!accountId) return;
  const smtpHost = String(formData.get('smtpHost') || '').trim();
  const smtpPort = Number(formData.get('smtpPort') || 587);
  const smtpUsername = String(formData.get('smtpUsername') || '').trim();
  const smtpPassword = String(formData.get('smtpPassword') || '').trim();
  const smtpSecure = formData.get('smtpSecure') === 'on';
  const imapHost = String(formData.get('imapHost') || '').trim();
  const imapPort = Number(formData.get('imapPort') || 993);
  try {
    await internalApiFetch(`/api/settings/email/accounts/${accountId}/config`, {
      method: 'PUT',
      body: JSON.stringify({
        providerKey: String(formData.get('providerKey') || '').trim() || undefined,
        status: String(formData.get('status') || '').trim() || undefined,
        config: {
          smtpHost: smtpHost || undefined,
          smtpPort: Number.isFinite(smtpPort) ? smtpPort : undefined,
          smtpUsername: smtpUsername || undefined,
          smtpPassword: smtpPassword || undefined,
          smtpSecure,
          imapHost: imapHost || undefined,
          imapPort: Number.isFinite(imapPort) ? imapPort : undefined,
        },
      }),
    });
    revalidatePath('/settings');
    settingsRedirect('Email account configuration saved.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not save email account configuration.');
  }
}

export async function verifyEmailAccountAction(formData: FormData) {
  const accountId = String(formData.get('accountId') || '').trim();
  if (!accountId) return;
  try {
    await internalApiFetch(`/api/settings/email/accounts/${accountId}/verify`, { method: 'POST', body: JSON.stringify({}) });
    revalidatePath('/settings');
    settingsRedirect('Email account verified.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not verify email account.');
  }
}

export async function testSendEmailAccountAction(formData: FormData) {
  const accountId = String(formData.get('accountId') || '').trim();
  const toEmail = String(formData.get('toEmail') || '').trim();
  if (!accountId) return;
  try {
    await internalApiFetch(`/api/settings/email/accounts/${accountId}/test-send`, {
      method: 'POST',
      body: JSON.stringify({ toEmail: toEmail || undefined }),
    });
    revalidatePath('/settings');
    settingsRedirect(`Test email sent${toEmail ? ` to ${toEmail}` : ''}.`);
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not send test email.');
  }
}

export async function syncEmailAccountAction(formData: FormData) {
  const accountId = String(formData.get('accountId') || '').trim();
  if (!accountId) return;
  try {
    await internalApiFetch(`/api/settings/email/accounts/${accountId}/sync`, { method: 'POST', body: JSON.stringify({}) });
    revalidatePath('/settings');
    revalidatePath('/inbox');
    revalidatePath('/leads');
    settingsRedirect('Email sync completed.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not sync email account.');
  }
}

export async function updateEmailSyncModeAction(formData: FormData) {
  const accountId = String(formData.get('accountId') || '').trim();
  const syncMode = String(formData.get('syncMode') || 'manual').trim();
  if (!accountId) return;
  try {
    await internalApiFetch(`/api/settings/email/accounts/${accountId}/sync-mode`, {
      method: 'POST',
      body: JSON.stringify({ syncMode }),
    });
    revalidatePath('/settings');
    settingsRedirect('Email sync mode updated.');
  } catch (error) {
    settingsRedirect(undefined, error instanceof Error ? error.message : 'Could not update email sync mode.');
  }
}
