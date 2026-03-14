import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell, cardStyle } from '../../components/app-shell';
import { WorkspaceBadge } from '../../components/workspace-badge';
import { authScaffoldEnabled } from '../../lib/auth/config';
import { getCurrentAuthUser } from '../../lib/auth/current-user';
import { getProvisioningState } from '../../lib/auth/provisioning';

export default async function OnboardingPage() {
  const currentUser = await getCurrentAuthUser();
  const provisioning = await getProvisioningState();

  if (provisioning.state === 'signed_out') redirect('/request-access');
  if (provisioning.state === 'approved' && provisioning.user?.role?.startsWith('platform_')) {
    redirect('/dashboard');
  }
  if (provisioning.state === 'pending' || provisioning.state === 'needs_follow_up' || provisioning.state === 'rejected' || provisioning.state === 'invited') {
    redirect('/access-status');
  }

  return (
    <AppShell
      title="Onboarding"
      subtitle="This is now the authenticated continuation of the request-access flow, not the primary public entry point."
      showNav={false}
    >
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Need a solo workspace?</h2>
          <p>Use the public request form first, then continue here after sign-in if needed.</p>
          <ul>
            <li>One-person use only</li>
            <li>No teammate invites</li>
            <li>Fastest path for sole proprietors</li>
          </ul>
          <p style={{ marginBottom: 0 }}><Link href="/request-access#individual-request">Go to individual request</Link></p>
        </article>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Need a reviewed business workspace?</h2>
          <p>Start from the public request form so your business context is captured before provisioning.</p>
          <ul>
            <li>Manual review before multi-user access</li>
            <li>Invite teammates only after approval</li>
            <li>Built for LLCs, corporations, and authorized operators</li>
          </ul>
          <p style={{ marginBottom: 0 }}><Link href="/request-access#business-request">Go to business request</Link></p>
        </article>
      </section>

      <section style={{ ...cardStyle, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Current auth and provisioning state</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          <div>Clerk configured: {authScaffoldEnabled ? 'yes' : 'not configured yet'}</div>
          <div>Authenticated user: {currentUser?.email || 'none'}</div>
          <div>Provisioning state: {provisioning.state}</div>
          {'workspace' in provisioning ? (
            <WorkspaceBadge workspaceType={provisioning.workspace?.workspaceType} role={provisioning.user?.role} />
          ) : null}
        </div>
        <p style={{ marginBottom: 0 }}>
          If you were invited into an existing company workspace or already have a request under review, LeadSprint will send you to the right status screen automatically.
        </p>
      </section>
    </AppShell>
  );
}
