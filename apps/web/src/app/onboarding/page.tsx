import Link from 'next/link';
import { AppShell, cardStyle } from '../../components/app-shell';
import { authScaffoldEnabled } from '../../lib/auth/config';
import { getCurrentAuthUser } from '../../lib/auth/current-user';

export default async function OnboardingPage() {
  const currentUser = await getCurrentAuthUser();

  return (
    <AppShell
      title="Onboarding"
      subtitle="Choose the workspace path that fits how you plan to use LeadSprint."
    >
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Individual workspace</h2>
          <p>For sole proprietors and solo operators. One user only, no teammate invites.</p>
          <ul>
            <li>Fastest path into the product</li>
            <li>No formal business verification up front</li>
            <li>Upgrade to a verified business workspace may require a later migration</li>
          </ul>
          <p style={{ marginBottom: 0 }}><Link href="/onboarding/individual">Create individual workspace</Link></p>
        </article>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Verified business workspace</h2>
          <p>For companies and teams. Requires manual review that the business exists and you’re authorized to act for it.</p>
          <ul>
            <li>Supports teammate invites after approval</li>
            <li>Designed for LLCs, corporations, and delegated business admins</li>
            <li>Documentation can be reviewed manually in the first version</li>
          </ul>
          <p style={{ marginBottom: 0 }}><Link href="/onboarding/business">Request verified business workspace</Link></p>
        </article>
      </section>

      <section style={{ ...cardStyle, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Current scaffold status</h2>
        <ul>
          <li>Clerk package installed: {authScaffoldEnabled ? 'yes' : 'not configured yet'}</li>
          <li>Current authenticated user: {currentUser?.email || 'none'}</li>
          <li>Provisioning endpoints are being wired in now</li>
        </ul>
        <p style={{ marginBottom: 0 }}>
          If you already belong to a verified business workspace later on, you’ll be invited by that workspace’s owner/admin rather than joining publicly.
        </p>
      </section>

      <section style={{ ...cardStyle, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Temporary navigation</h2>
        <p style={{ marginBottom: 0 }}>
          <Link href="/dashboard">Back to dashboard</Link>
        </p>
      </section>
    </AppShell>
  );
}
