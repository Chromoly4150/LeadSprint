import { AppShell, cardStyle } from '../../../components/app-shell';
import { getCurrentAuthUser } from '../../../lib/auth/current-user';
import { createIndividualWorkspace } from '../actions';

export default async function IndividualOnboardingPage() {
  const currentUser = await getCurrentAuthUser();

  return (
    <AppShell title="Create individual workspace" subtitle="For solo use only. Individual workspaces cannot invite teammates." showNav={false}>
      <form action={createIndividualWorkspace} style={{ ...cardStyle, display: 'grid', gap: 12, maxWidth: 720 }}>
        <label>
          Full name
          <input name="fullName" defaultValue={currentUser?.fullName || ''} required style={{ display: 'block', width: '100%', marginTop: 6 }} />
        </label>
        <label>
          Email
          <input name="email" type="email" defaultValue={currentUser?.email || ''} required style={{ display: 'block', width: '100%', marginTop: 6 }} />
        </label>
        <label>
          Workspace name
          <input name="workspaceName" placeholder="Your name or business name" required style={{ display: 'block', width: '100%', marginTop: 6 }} />
        </label>
        <label>
          Line of business
          <input name="lineOfBusiness" placeholder="e.g. plumbing, real estate, legal" style={{ display: 'block', width: '100%', marginTop: 6 }} />
        </label>
        <label>
          What do you want to use LeadSprint for?
          <textarea name="useCase" rows={4} placeholder="Lead intake, follow-up, outbound email, reporting..." style={{ display: 'block', width: '100%', marginTop: 6 }} />
        </label>
        <label>
          Notes (optional)
          <textarea name="notes" rows={3} style={{ display: 'block', width: '100%', marginTop: 6 }} />
        </label>
        <p style={{ margin: 0, color: '#555' }}>Later upgrades from individual to verified business may require a manual migration.</p>
        <button type="submit" style={{ width: 'fit-content', padding: '10px 16px' }}>Create individual workspace</button>
      </form>
    </AppShell>
  );
}
