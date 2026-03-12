import { redirect } from 'next/navigation';
import { getProvisioningState } from '../lib/auth/provisioning';

export async function GuardedAppShell({ children }: { children: React.ReactNode }) {
  const state = await getProvisioningState();

  if (state.state === 'signed_out') redirect('/sign-in');
  if (state.state === 'authenticated_not_onboarded') redirect('/onboarding');
  if (state.state === 'pending' || state.state === 'needs_follow_up' || state.state === 'rejected' || state.state === 'invited') redirect('/access-status');

  return <>{children}</>;
}
