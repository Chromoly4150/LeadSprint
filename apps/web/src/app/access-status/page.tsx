import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell, cardStyle } from '../../components/app-shell';
import { getProvisioningState } from '../../lib/auth/provisioning';
import { acceptInvitationAction } from './actions';

export default async function AccessStatusPage() {
  const state = await getProvisioningState();

  if (state.state === 'signed_out') redirect('/sign-in');
  if (state.state === 'approved') redirect('/dashboard');
  if (state.state === 'authenticated_not_onboarded') redirect('/onboarding');

  if (state.state === 'invited') {
    return (
      <AppShell title="You’ve been invited" subtitle="A verified business workspace invited you to join.">
        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Pending invitations</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {state.invitations.map((invitation) => (
              <div key={invitation.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700 }}>{invitation.organization_name}</div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>{invitation.email} · {invitation.role}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>Invited {invitation.created_at}</div>
                <form action={acceptInvitationAction} style={{ marginTop: 10 }}>
                  <input type="hidden" name="invitationId" value={invitation.id} />
                  <button type="submit">Accept invitation</button>
                </form>
              </div>
            ))}
          </div>
        </section>
      </AppShell>
    );
  }

  const isIndividual = state.request?.requestKind === 'individual_workspace';

  const titleMap = {
    pending: isIndividual ? 'Request received' : 'Request received',
    needs_follow_up: 'More information needed',
    rejected: 'Request not approved',
  } as const;

  const subtitleMap = {
    pending: isIndividual
      ? 'We got your LeadSprint access request. Someone will follow up by email before activation.'
      : 'We got your business workspace request. Someone will review it and follow up by email before activation.',
    needs_follow_up: 'We need a bit more information before we can approve this request.',
    rejected: 'This request was not approved in its current form.',
  } as const;

  const request = state.request;

  return (
    <AppShell title={titleMap[state.state]} subtitle={subtitleMap[state.state]}>
      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>What happens next</h2>
        <ul>
          <li>Request type: {request?.requestKind === 'individual_workspace' ? 'Individual workspace request' : 'Verified business workspace request'}</li>
          <li>Name: {request?.organizationName || '—'}</li>
          <li>Status: {state.state.replaceAll('_', ' ')}</li>
          <li>Submitted / updated: {request?.updatedAt || request?.createdAt || '—'}</li>
        </ul>
        {state.state === 'pending' ? (
          <p>
            We’ll follow up by email to complete the process. For now, assume someone from <strong>sales@leadsprint.com</strong> or a similar LeadSprint address will contact you with next steps.
          </p>
        ) : null}
        {state.invitations && state.invitations.length > 0 ? (
          <p>You also have pending invitations from an existing verified business workspace below.</p>
        ) : null}
        <p>
          If you work for a company that already uses LeadSprint, ask your workspace owner or admin for an invite instead of submitting a new public request.
        </p>
        <p style={{ marginBottom: 0 }}>
          <Link href="/sign-in">Back to sign in</Link>
        </p>
      </section>

      {state.invitations && state.invitations.length > 0 ? (
        <section style={{ ...cardStyle, marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>Invitations</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {state.invitations.map((invitation) => (
              <div key={invitation.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700 }}>{invitation.organization_name}</div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>{invitation.email} · {invitation.role}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>Invited {invitation.created_at}</div>
                <form action={acceptInvitationAction} style={{ marginTop: 10 }}>
                  <input type="hidden" name="invitationId" value={invitation.id} />
                  <button type="submit">Accept invitation</button>
                </form>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
