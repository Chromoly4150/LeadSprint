import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell, cardStyle } from '../../components/app-shell';
import { getProvisioningState } from '../../lib/auth/provisioning';

export default async function AccessStatusPage() {
  const state = await getProvisioningState();

  if (state.state === 'signed_out') redirect('/sign-in');
  if (state.state === 'approved') redirect('/dashboard');
  if (state.state === 'authenticated_not_onboarded') redirect('/onboarding');

  const titleMap = {
    pending: 'Business request pending',
    needs_follow_up: 'More information needed',
    rejected: 'Business request not approved',
  } as const;

  const subtitleMap = {
    pending: 'We have your request and still need to review it before enabling a verified business workspace.',
    needs_follow_up: 'We need a bit more information before we can approve this business workspace.',
    rejected: 'This request was not approved in its current form.',
  } as const;

  const request = state.request;

  return (
    <AppShell title={titleMap[state.state]} subtitle={subtitleMap[state.state]}>
      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Request summary</h2>
        <ul>
          <li>Organization: {request?.organizationName || '—'}</li>
          <li>Status: {state.state.replaceAll('_', ' ')}</li>
          <li>Submitted / updated: {request?.updatedAt || request?.createdAt || '—'}</li>
        </ul>
        <p>
          If you work for a company that already uses LeadSprint, ask your workspace owner or admin for an invite instead of submitting a public team-member request.
        </p>
        <p style={{ marginBottom: 0 }}>
          <Link href="/onboarding">Back to onboarding choices</Link>
        </p>
      </section>
    </AppShell>
  );
}
