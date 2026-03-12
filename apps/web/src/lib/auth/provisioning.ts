import { internalApiFetch } from '../api/internal-api';
import { authScaffoldEnabled } from './config';
import { getCurrentAuthUser } from './current-user';

export type ProvisioningState =
  | { state: 'signed_out' }
  | { state: 'authenticated_not_onboarded' }
  | { state: 'pending'; request: any; invitations?: any[] }
  | { state: 'needs_follow_up'; request: any; invitations?: any[] }
  | { state: 'rejected'; request: any; invitations?: any[] }
  | { state: 'invited'; invitations: any[] }
  | { state: 'approved'; workspace: any; user: any };

export async function getProvisioningState(): Promise<ProvisioningState> {
  if (!authScaffoldEnabled) {
    return { state: 'approved', workspace: { id: 'org_default', name: 'Demo Org', workspaceType: 'business_verified' }, user: { role: 'owner', email: 'owner@leadsprint.local' } };
  }

  const currentUser = await getCurrentAuthUser();
  if (!currentUser) return { state: 'signed_out' };

  try {
    const res = await internalApiFetch<any>('/api/access/me');
    if (res.state === 'approved') return { state: 'approved', workspace: res.workspace, user: res.user };
    if (res.state === 'pending') return { state: 'pending', request: res.request, invitations: res.invitations || [] };
    if (res.state === 'needs_follow_up') return { state: 'needs_follow_up', request: res.request, invitations: res.invitations || [] };
    if (res.state === 'rejected') return { state: 'rejected', request: res.request, invitations: res.invitations || [] };
    if (res.state === 'invited') return { state: 'invited', invitations: res.invitations || [] };
    return { state: 'authenticated_not_onboarded' };
  } catch {
    return { state: 'authenticated_not_onboarded' };
  }
}
