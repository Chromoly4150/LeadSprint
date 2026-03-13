import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentAuthUser } from '../../lib/auth/current-user';
import { getProvisioningState } from '../../lib/auth/provisioning';
import { submitBusinessAccessRequest, submitIndividualAccessRequest } from './actions';

type Draft = {
  path?: 'individual' | 'business';
  payload?: Record<string, string | string[] | boolean>;
};

const sectionStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: '48px 24px',
};

const cardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  padding: 24,
  background: '#fff',
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  padding: 10,
  borderRadius: 10,
  border: '1px solid #d1d5db',
};

const featureOptions = [
  { key: 'lead_intake', label: 'Lead intake' },
  { key: 'inbox', label: 'Inbox / communications' },
  { key: 'outbound_email', label: 'Outbound email' },
  { key: 'reporting', label: 'Reporting' },
  { key: 'automation', label: 'Automation' },
  { key: 'team_collaboration', label: 'Team collaboration' },
];

function getDraft(): Draft {
  const raw = cookies().get('leadsprint_request_access_draft')?.value;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Draft;
  } catch {
    return {};
  }
}

function draftValue(draft: Draft, key: string) {
  const value = draft.payload?.[key];
  return typeof value === 'string' ? value : '';
}

function draftValues(draft: Draft, key: string) {
  const value = draft.payload?.[key];
  return Array.isArray(value) ? value.map(String) : [];
}

export const metadata = {
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RequestAccessPage({ searchParams }: { searchParams?: { resume?: string; submitted?: string } }) {
  const currentUser = await getCurrentAuthUser();
  const state = await getProvisioningState();
  const draft = getDraft();

  if (state.state === 'approved') redirect('/dashboard');
  if (state.state === 'pending' || state.state === 'needs_follow_up' || state.state === 'rejected' || state.state === 'invited') {
    redirect('/access-status');
  }

  const individualDraft = draft.path === 'individual' ? draft : {};
  const businessDraft = draft.path === 'business' ? draft : {};
  const businessSelected = searchParams?.resume === '1' ? draft.path === 'business' : true;
  const submittedKind = searchParams?.submitted === 'individual' || searchParams?.submitted === 'business' ? searchParams.submitted : null;

  return (
    <main style={{ background: '#f8fafc', minHeight: '100vh' }}>
      <section style={{ ...sectionStyle, paddingTop: 72 }}>
        <div style={{ display: 'grid', gap: 20, maxWidth: 780 }}>
          <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280' }}>Request Access</div>
          <h1 style={{ fontSize: 52, lineHeight: 1.05, margin: 0 }}>Start with the actual access request, not a generic sign-up.</h1>
          <p style={{ fontSize: 18, color: '#4b5563', margin: 0 }}>
            Tell LeadSprint how you plan to use the product, then we’ll route you into the right workspace path. Existing company members should ask their workspace owner or admin for an invite instead of starting a new request here.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="#individual-request" style={{ background: '#111827', color: '#fff', padding: '12px 18px', borderRadius: 10, textDecoration: 'none' }}>Individual request</Link>
            <Link href="#business-request" style={{ background: '#fff', color: '#111827', padding: '12px 18px', borderRadius: 10, textDecoration: 'none', border: '1px solid #d1d5db' }}>Business request</Link>
            <Link href="/sign-in" style={{ color: '#111827', alignSelf: 'center' }}>Already approved or invited? Sign in</Link>
          </div>
          {submittedKind ? (
            <div style={{ ...cardStyle, padding: 18, borderColor: '#bfdbfe', background: '#eff6ff' }}>
              <strong>{submittedKind === 'individual' ? 'Individual access request received.' : 'Business access request received.'}</strong>
              <p style={{ marginBottom: 0, color: '#1f2937' }}>
                We saved your request for review. Do not create an account unless LeadSprint approves or invites you. If you already have approval, use the activation path you were given; otherwise wait for follow-up by email.
              </p>
            </div>
          ) : null}
          <div style={{ ...cardStyle, padding: 18 }}>
            <strong>{currentUser ? 'Signed in and ready to submit.' : 'No account yet? That’s fine.'}</strong>
            <p style={{ marginBottom: 0, color: '#4b5563' }}>
              {currentUser
                ? `Your request will be submitted using ${currentUser.email || 'your authenticated account'} and then move into review.`
                : 'Fill out the request first. We’ll save the request immediately and only move into account activation after approval or invitation.'}
            </p>
          </div>
        </div>
      </section>

      <section style={sectionStyle} id="individual-request">
        <form action={submitIndividualAccessRequest} style={{ ...cardStyle, display: 'grid', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280' }}>Solo use</div>
            <h2 style={{ margin: '8px 0 4px' }}>Request an individual workspace</h2>
            <p style={{ margin: 0, color: '#4b5563' }}>For sole proprietors and one-person operations. Individual workspaces stay solo and cannot invite teammates, and new requests now go through review before activation.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <label>
              Full name
              <input name="fullName" defaultValue={draftValue(individualDraft, 'fullName') || currentUser?.fullName || ''} required style={inputStyle} />
            </label>
            <label>
              Email
              <input name="email" type="email" defaultValue={draftValue(individualDraft, 'email') || currentUser?.email || ''} required style={inputStyle} />
            </label>
          </div>
          <label>
            Workspace name
            <input name="workspaceName" placeholder="Your name or business name" defaultValue={draftValue(individualDraft, 'workspaceName')} required style={inputStyle} />
          </label>
          <label>
            Line of business
            <input name="lineOfBusiness" placeholder="e.g. plumbing, legal, real estate" defaultValue={draftValue(individualDraft, 'lineOfBusiness')} style={inputStyle} />
          </label>
          <label>
            What do you want to use LeadSprint for?
            <textarea name="useCase" rows={4} placeholder="Lead intake, follow-up, reporting, outbound email..." defaultValue={draftValue(individualDraft, 'useCase')} style={inputStyle} />
          </label>
          <label>
            Notes (optional)
            <textarea name="notes" rows={3} defaultValue={draftValue(individualDraft, 'notes')} style={inputStyle} />
          </label>
          <p style={{ margin: 0, color: '#4b5563' }}>If you later need a multi-user business workspace, that upgrade may require manual migration rather than an instant in-place conversion.</p>
          <button type="submit" style={{ width: 'fit-content', padding: '12px 18px', borderRadius: 10, background: '#111827', color: '#fff', border: 0 }}>
            {currentUser ? 'Submit individual request' : 'Submit individual request'}
          </button>
        </form>
      </section>

      <section style={sectionStyle} id="business-request">
        <form action={submitBusinessAccessRequest} style={{ ...cardStyle, display: 'grid', gap: 12, outline: businessSelected ? '2px solid #c7d2fe' : 'none' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280' }}>Teams and companies</div>
            <h2 style={{ margin: '8px 0 4px' }}>Request a verified business workspace</h2>
            <p style={{ margin: 0, color: '#4b5563' }}>For LLCs, corporations, formal organizations, and authorized team operators. Multi-user access is enabled only after review.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <label>
              Full name
              <input name="fullName" defaultValue={draftValue(businessDraft, 'fullName') || currentUser?.fullName || ''} required style={inputStyle} />
            </label>
            <label>
              Work email
              <input name="email" type="email" defaultValue={draftValue(businessDraft, 'email') || currentUser?.email || ''} required style={inputStyle} />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <label>
              Role / title
              <input name="roleTitle" placeholder="Owner, operations manager, admin..." defaultValue={draftValue(businessDraft, 'roleTitle')} style={inputStyle} />
            </label>
            <label>
              Organization name
              <input name="organizationName" defaultValue={draftValue(businessDraft, 'organizationName')} required style={inputStyle} />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <label>
              Website
              <input name="website" placeholder="https://example.com" defaultValue={draftValue(businessDraft, 'website')} style={inputStyle} />
            </label>
            <label>
              Team size
              <input name="teamSize" placeholder="1-5, 6-20, 20+" defaultValue={draftValue(businessDraft, 'teamSize')} style={inputStyle} />
            </label>
          </div>
          <label>
            Line of business
            <input name="lineOfBusiness" defaultValue={draftValue(businessDraft, 'lineOfBusiness')} style={inputStyle} />
          </label>
          <fieldset style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
            <legend>Requested capabilities</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {featureOptions.map((option) => {
                const selected = draftValues(businessDraft, 'requestedFeatures').includes(option.key);
                return (
                  <label key={option.key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" name="requestedFeatures" value={option.key} defaultChecked={selected} /> {option.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              name="authorityAttestation"
              required
              defaultChecked={Boolean(businessDraft.payload?.authorityAttestation)}
              style={{ marginTop: 3 }}
            />
            <span>I confirm I’m authorized to request this workspace on behalf of the business and can provide supporting context if needed.</span>
          </label>
          <label>
            Notes / verification context
            <textarea
              name="notes"
              rows={4}
              placeholder="Business context, documentation you can provide, current workflow pain, why access is needed..."
              defaultValue={draftValue(businessDraft, 'notes')}
              style={inputStyle}
            />
          </label>
          <button type="submit" style={{ width: 'fit-content', padding: '12px 18px', borderRadius: 10, background: '#111827', color: '#fff', border: 0 }}>
            {currentUser ? 'Submit business request' : 'Submit business request'}
          </button>
        </form>
      </section>

      <section style={sectionStyle}>
        <div style={{ ...cardStyle, display: 'grid', gap: 10 }}>
          <h2 style={{ marginTop: 0 }}>Important access rules</h2>
          <ul style={{ margin: 0, paddingLeft: 20, color: '#4b5563' }}>
            <li>New visitors should start with an access request instead of a generic product sign-up.</li>
            <li>Verified business workspaces are reviewed before multi-user access is enabled.</li>
            <li>Employees and teammates join existing workspaces by invite from an owner or admin.</li>
            <li>If you already have access, you can simply <Link href="/sign-in">sign in</Link>.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
