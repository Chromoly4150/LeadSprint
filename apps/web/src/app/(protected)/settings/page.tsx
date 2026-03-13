import { AppShell, cardStyle, inputStyle } from '../../../components/app-shell';
import { WorkspaceBadge } from '../../../components/workspace-badge';
import { internalApiFetch } from '../../../lib/api/internal-api';
import {
  approveAccessRequestAction,
  bootstrapGmailProviderAction,
  createInvitationAction,
  followUpBusinessRequestAction,
  rejectBusinessRequestAction,
  revokeInvitationAction,
  startGmailOAuthAction,
} from './actions';

type UserRow = { id: string; fullName: string; email: string; role: string; roleLabel?: string; status?: string };
type ProviderRow = { key: string; label: string; needsAuth: boolean; status: string; updatedAt: string | null };
type AccessRequestRow = {
  id: string;
  email: string;
  full_name: string;
  role_title?: string | null;
  organization_name: string;
  website?: string | null;
  line_of_business?: string | null;
  requested_features?: string[];
  team_size?: string | null;
  authority_attestation: boolean;
  notes?: string | null;
  request_kind: string;
  status: string;
  review_notes?: string | null;
  clerk_user_id?: string | null;
  activation_token?: string | null;
  activated_at?: string | null;
  created_at: string;
  updated_at: string;
};
type InvitationRow = { id: string; email: string; role: string; status: string; created_at: string };

export default async function SettingsPage() {
  const [usersRes, providersRes, meRes, requestsRes] = await Promise.all([
    internalApiFetch<{ users: UserRow[] }>('/api/users'),
    internalApiFetch<{ providers: ProviderRow[] }>('/api/email/provider-settings'),
    internalApiFetch<{ actor: { id: string; email: string; role: string; status: string; roleLabel?: string } }>('/api/me/permissions'),
    internalApiFetch<{ requests: AccessRequestRow[] }>('/api/admin/access-requests').catch(() => ({ requests: [] })),
  ]);

  let invitationsRes: { invitations: InvitationRow[] } | null = null;
  let orgIdForInvites: string | null = null;
  let workspaceType: string | null = null;
  try {
    const access = await internalApiFetch<{ state: string; workspace?: { id: string; workspaceType: string } }>('/api/access/me');
    workspaceType = access.workspace?.workspaceType || null;
    orgIdForInvites = access.workspace?.workspaceType === 'business_verified' ? access.workspace.id : null;
    if (orgIdForInvites) {
      invitationsRes = await internalApiFetch<{ invitations: InvitationRow[] }>(`/api/organizations/${orgIdForInvites}/invitations`).catch(() => ({ invitations: [] }));
    }
  } catch {
    invitationsRes = null;
  }

  return (
    <AppShell title="Settings" subtitle="Team, provider, onboarding review, and invite management">
      <section style={{ ...cardStyle, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Current workspace</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <WorkspaceBadge workspaceType={workspaceType} role={meRes.actor.role} />
          <span style={{ color: '#6b7280', fontSize: 13 }}>{meRes.actor.email} · {meRes.actor.roleLabel || meRes.actor.role}</span>
        </div>
        <p style={{ marginBottom: 0, color: '#6b7280' }}>
          Platform roles can review access requests across the system. Company roles manage only their own verified business workspace and team.
        </p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Team</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {usersRes.users.map((user) => (
              <div key={user.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700 }}>{user.fullName}</div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>{user.email}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{user.roleLabel || user.role} · {user.status || 'active'}</div>
              </div>
            ))}
          </div>
        </article>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Email providers</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {providersRes.providers.map((provider) => (
              <div key={provider.key} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, display: 'grid', gap: 8 }}>
                <div style={{ fontWeight: 700 }}>{provider.label}</div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>status: {provider.status}{provider.needsAuth ? ' · requires auth' : ''}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>updated: {provider.updatedAt || '—'}</div>
                {provider.key === 'gmail' ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <form action={bootstrapGmailProviderAction}>
                      <button type="submit">Bootstrap Gmail</button>
                    </form>
                    <form action={startGmailOAuthAction}>
                      <button type="submit">Start Gmail OAuth</button>
                    </form>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section style={{ ...cardStyle, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Business access requests</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          {['pending', 'needs_follow_up', 'approved', 'rejected'].map((statusKey) => {
            const rows = requestsRes.requests.filter((request) => request.status === statusKey);
            return (
              <div key={statusKey} style={{ display: 'grid', gap: 12 }}>
                <h3 style={{ margin: 0, textTransform: 'capitalize' }}>{statusKey.replaceAll('_', ' ')}</h3>
                {rows.length === 0 ? (
                  <p style={{ margin: 0, color: '#6b7280' }}>No {statusKey.replaceAll('_', ' ')} requests.</p>
                ) : (
                  rows.map((request) => (
                    <div key={request.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, display: 'grid', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{request.organization_name}</div>
                        <div style={{ color: '#6b7280', fontSize: 13 }}>{request.full_name} · {request.email}</div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>{request.request_kind === 'individual_workspace' ? 'individual request' : 'business request'} · {request.status} · {request.role_title || 'role not specified'} · {request.line_of_business || 'line of business not provided'}</div>
                      </div>
                      <div style={{ fontSize: 13, color: '#374151' }}>
                        <div>Website: {request.website || '—'}</div>
                        <div>Team size: {request.team_size || '—'}</div>
                        <div>Requested features: {request.requested_features?.join(', ') || '—'}</div>
                        <div>Authority attested: {request.authority_attestation ? 'yes' : 'no'}</div>
                        <div>Activation state: {request.clerk_user_id ? 'Account linked' : request.activation_token ? 'Approved and awaiting activation' : 'Pre-auth request only'}</div>
                        {request.activation_token ? <div>Activation link: <code>{`/sign-up?activation_token=${request.activation_token}`}</code></div> : null}
                        <div>Notes: {request.notes || '—'}</div>
                      </div>
                      {request.status !== 'approved' && request.status !== 'rejected' ? (
                        <div style={{ display: 'grid', gap: 8 }}>
                          <form action={approveAccessRequestAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <input type="hidden" name="requestId" value={request.id} />
                            <input name="reviewNotes" placeholder="Approval notes (optional)" style={{ ...inputStyle, minWidth: 260 }} />
                            <button type="submit">{request.clerk_user_id ? 'Approve + provision' : 'Approve for activation'}</button>
                          </form>
                          <form action={followUpBusinessRequestAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <input type="hidden" name="requestId" value={request.id} />
                            <input name="reviewNotes" placeholder="What follow-up is needed?" style={{ ...inputStyle, minWidth: 260 }} />
                            <button type="submit">Needs follow-up</button>
                          </form>
                          <form action={rejectBusinessRequestAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <input type="hidden" name="requestId" value={request.id} />
                            <input name="reviewNotes" placeholder="Rejection notes" style={{ ...inputStyle, minWidth: 260 }} />
                            <button type="submit">Reject</button>
                          </form>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gap: 6 }}>
                          {request.review_notes ? <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>Review notes: {request.review_notes}</p> : null}
                          {request.activation_token ? <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>Share activation path with approved user: <code>{`/sign-up?activation_token=${request.activation_token}`}</code></p> : null}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ ...cardStyle, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Invitations</h2>
        {orgIdForInvites ? (
          <>
            <form action={createInvitationAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <input type="hidden" name="organizationId" value={orgIdForInvites} />
              <input name="email" type="email" placeholder="teammate@company.com" required style={{ ...inputStyle, minWidth: 240 }} />
              <select name="role" style={inputStyle} defaultValue="company_agent">
                <option value="company_agent">Agent</option>
                <option value="company_admin">Admin</option>
              </select>
              <button type="submit">Invite user</button>
            </form>
            <div style={{ display: 'grid', gap: 10 }}>
              {(invitationsRes?.invitations || []).length === 0 ? (
                <p style={{ margin: 0, color: '#6b7280' }}>No invitations yet.</p>
              ) : (
                invitationsRes!.invitations.map((invitation) => (
                  <div key={invitation.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, display: 'grid', gap: 8 }}>
                    <div style={{ fontWeight: 700 }}>{invitation.email}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>{invitation.role} · {invitation.status} · {invitation.created_at}</div>
                    {invitation.status === 'pending' ? (
                      <form action={revokeInvitationAction}>
                        <input type="hidden" name="invitationId" value={invitation.id} />
                        <button type="submit">Revoke invite</button>
                      </form>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <p style={{ margin: 0, color: '#6b7280' }}>Invites are available only for verified business workspaces.</p>
        )}
      </section>
    </AppShell>
  );
}
