import { AppShell, cardStyle } from '../../../components/app-shell';
import { getCurrentAuthUser } from '../../../lib/auth/current-user';
import { submitBusinessRequest } from '../actions';

const featureOptions = [
  { key: 'lead_intake', label: 'Lead intake' },
  { key: 'inbox', label: 'Inbox / communications' },
  { key: 'outbound_email', label: 'Outbound email' },
  { key: 'reporting', label: 'Reporting' },
  { key: 'automation', label: 'Automation' },
  { key: 'team_collaboration', label: 'Team collaboration' },
];

export default async function BusinessOnboardingPage() {
  const currentUser = await getCurrentAuthUser();

  return (
    <AppShell title="Request verified business workspace" subtitle="For companies and teams. You’ll need to confirm the business exists and that you’re authorized to set this workspace up." showNav={false}>
      <form action={submitBusinessRequest} style={{ ...cardStyle, display: 'grid', gap: 12, maxWidth: 760 }}>
        <label>
          Full name
          <input name="fullName" defaultValue={currentUser?.fullName || ''} required style={{ display: 'block', width: '100%', marginTop: 6 }} />
        </label>
        <label>
          Work email
          <input name="email" type="email" defaultValue={currentUser?.email || ''} required style={{ display: 'block', width: '100%', marginTop: 6 }} />
        </label>
        <label>
          Role / title
          <input name="roleTitle" placeholder="Owner, operations manager, admin..." style={{ display: 'block', width: '100%', marginTop: 6 }} />
        </label>
        <label>
          Organization name
          <input name="organizationName" required style={{ display: 'block', width: '100%', marginTop: 6 }} />
        </label>
        <label>
          Website
          <input name="website" placeholder="https://example.com" style={{ display: 'block', width: '100%', marginTop: 6 }} />
        </label>
        <label>
          Line of business
          <input name="lineOfBusiness" style={{ display: 'block', width: '100%', marginTop: 6 }} />
        </label>
        <label>
          Team size
          <input name="teamSize" placeholder="1-5, 6-20, 20+" style={{ display: 'block', width: '100%', marginTop: 6 }} />
        </label>
        <fieldset style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
          <legend>Requested features</legend>
          <div style={{ display: 'grid', gap: 8 }}>
            {featureOptions.map((option) => (
              <label key={option.key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" name="requestedFeatures" value={option.key} /> {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" name="authorityAttestation" required /> I confirm I’m authorized to set up this workspace on behalf of this business.
        </label>
        <label>
          Notes / verification context
          <textarea name="notes" rows={4} placeholder="Tell us anything useful about the business or the documentation you can provide." style={{ display: 'block', width: '100%', marginTop: 6 }} />
        </label>
        <button type="submit" style={{ width: 'fit-content', padding: '10px 16px' }}>Submit business request</button>
      </form>
    </AppShell>
  );
}
