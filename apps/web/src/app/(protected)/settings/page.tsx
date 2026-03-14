import { AppShell, cardStyle, inputStyle } from '../../../components/app-shell';
import { WorkspaceBadge } from '../../../components/workspace-badge';
import { internalApiFetch } from '../../../lib/api/internal-api';
import {
  approveAccessRequestAction,
  bootstrapGmailProviderAction,
  createInternalUserAction,
  createInvitationAction,
  removeUserAction,
  updatePermissionOverridesAction,
  updateUserAction,
  followUpBusinessRequestAction,
  rejectBusinessRequestAction,
  revokeInvitationAction,
  startGmailOAuthAction,
} from './actions';

type UserRow = { id: string; fullName: string; email: string; role: string; roleLabel?: string; status?: string; permissionOverrides?: Record<string, boolean>; permissions?: Record<string, boolean> };
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

function statusBadge(status?: string) {
  const normalized = status || 'active';
  const styles: Record<string, React.CSSProperties> = {
    active: { background: '#dcfce7', color: '#166534' },
    deactivated: { background: '#e5e7eb', color: '#374151' },
    suspended: { background: '#fee2e2', color: '#991b1b' },
    pending: { background: '#fef3c7', color: '#92400e' },
  };
  return <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600, ...(styles[normalized] || styles.active) }}>{normalized.replaceAll('_', ' ')}</span>;
}

function permissionSummary(user: UserRow) {
  const active = Object.entries(user.permissionOverrides || {}).filter(([, enabled]) => enabled).map(([key]) => key);
  if (active.length === 0) return 'No overrides';
  return active.join(', ');
}

export default async function SettingsPage({ searchParams }: { searchParams?: { message?: string; error?: string; q?: string; roleScope?: string } }) {
  const [usersRes, providersRes, meRes, requestsRes] = await Promise.all([
    internalApiFetch<{ users: UserRow[] }>('/api/users'),
    internalApiFetch<{ providers: ProviderRow[] }>('/api/email/provider-settings'),
    internalApiFetch<{ actor: { id: string; email: string; role: string; status: string; roleLabel?: string } }>('/api/me/permissions'),
    internalApiFetch<{ requests: AccessRequestRow[] }>('/api/admin/access-requests').catch(() => ({ requests: [] })),
  ]);

  let invitationsRes: { invitations: InvitationRow[] } | null = null;
  let orgIdForInvites: string | null = null;
  let workspaceType: string | null = null;
  const flashMessage = searchParams?.message ? decodeURIComponent(searchParams.message) : null;
  const flashError = searchParams?.error ? decodeURIComponent(searchParams.error) : null;
  const roleScope = searchParams?.roleScope === 'company' ? 'company' : 'platform';
  const requestQuery = (searchParams?.q || '').trim().toLowerCase();
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

  const platformUsers = usersRes.users.filter((user) => user.role.startsWith('platform_'));
  const companyUsers = usersRes.users.filter((user) => !user.role.startsWith('platform_'));

  const editableRoleOptions = (currentScope: 'platform' | 'company') => {
    return currentScope === 'platform'
      ? [
          { value: 'platform_agent', label: 'Platform Agent' },
          { value: 'platform_sme', label: 'Platform SME' },
          { value: 'platform_admin', label: 'Platform Admin' },
        ]
      : [
          { value: 'company_agent', label: 'Agent' },
          { value: 'company_admin', label: 'Admin' },
          { value: 'company_owner', label: 'Company Owner' },
        ];
  };
  const filteredRequests = requestsRes.requests.filter((request) => {
    if (!requestQuery) return true;
    const haystack = [request.organization_name, request.full_name, request.email, request.line_of_business || '', request.status].join(' ').toLowerCase();
    return haystack.includes(requestQuery);
  });

  const canManageUser = (user: UserRow) => {
    if (meRes.actor.role === 'platform_owner') return user.id !== meRes.actor.id;
    if (meRes.actor.role === 'platform_admin') return !['platform_owner', 'platform_admin'].includes(user.role);
    if (meRes.actor.role === 'company_owner') return ['company_admin', 'company_agent'].includes(user.role);
    if (meRes.actor.role === 'company_admin') return user.role === 'company_agent';
    return false;
  };

  const permissionFieldsForUser = (user: UserRow) => {
    if (user.role.startsWith('platform_')) {
      return [
        ['platform.accessRequests.review', 'Access review'],
        ['platform.users.manage', 'Manage users'],
        ['settings.manageBusiness', 'Business settings'],
        ['settings.manageTemplates', 'Templates'],
      ] as const;
    }
    return [
      ['settings.manageBusiness', 'Business settings'],
      ['settings.manageTemplates', 'Templates'],
    ] as const;
  };

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

      {flashMessage ? <section style={{ ...cardStyle, marginBottom: 16, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534' }}>{flashMessage}</section> : null}
      {flashError ? <section style={{ ...cardStyle, marginBottom: 16, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b' }}>{flashError}</section> : null}

      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <article style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ marginTop: 0, marginBottom: 4 }}>Operators & team</h2>
              <p style={{ margin: 0, color: '#6b7280' }}>Platform operators are internal. Company users are customer-facing roles.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href="/settings?roleScope=platform" style={{ padding: '8px 12px', borderRadius: 999, textDecoration: 'none', background: roleScope === 'platform' ? '#111827' : '#e5e7eb', color: roleScope === 'platform' ? '#fff' : '#111827' }}>Platform</a>
              <a href="/settings?roleScope=company" style={{ padding: '8px 12px', borderRadius: 999, textDecoration: 'none', background: roleScope === 'company' ? '#111827' : '#e5e7eb', color: roleScope === 'company' ? '#fff' : '#111827' }}>Company</a>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {(roleScope === 'platform' ? platformUsers : companyUsers).map((user) => {
              const scope = user.role.startsWith('platform_') ? 'platform' : 'company';
              const canEdit = canManageUser(user);
              const roleOptions = editableRoleOptions(scope).filter((option) => {
                if (meRes.actor.role === 'platform_admin' && option.value === 'platform_admin') return false;
                if (meRes.actor.role === 'company_owner' && option.value === 'company_owner') return false;
                if (meRes.actor.role === 'company_admin' && option.value !== 'company_agent') return false;
                return true;
              });
              return (
              <div key={user.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, display: 'grid', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{user.fullName}</div>
                  <div style={{ color: '#6b7280', fontSize: 13 }}>{user.email}</div>
                  <div style={{ color: '#6b7280', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>{user.roleLabel || user.role}</span>
                    {statusBadge(user.status || 'active')}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>Overrides: {permissionSummary(user)}</div>
                </div>
                {canEdit ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <form action={updateUserAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input name="fullName" defaultValue={user.fullName} style={{ ...inputStyle, minWidth: 180 }} />
                      <select name="role" defaultValue={user.role} style={inputStyle}>
                        {roleOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <select name="status" defaultValue={user.status || 'active'} style={inputStyle}>
                        <option value="active">Active</option>
                        <option value="deactivated">Deactivated</option>
                        <option value="suspended">Suspended</option>
                      </select>
                      <button type="submit">Save</button>
                    </form>
                    <form action={updatePermissionOverridesAction} style={{ display: 'grid', gap: 8 }}>
                      <input type="hidden" name="userId" value={user.id} />
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Permission overrides (choose a preset or set individual toggles)</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <select name="preset" defaultValue="" style={inputStyle}>
                          <option value="">Custom overrides</option>
                          <option value="none">No overrides</option>
                          <option value="company_manager">Company manager</option>
                          {scope === 'platform' ? <option value="platform_reviewer">Platform reviewer</option> : null}
                          {scope === 'platform' ? <option value="platform_manager">Platform manager</option> : null}
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        {permissionFieldsForUser(user).map(([key, label]) => (
                          <label key={key}><input type="checkbox" name={key} defaultChecked={Boolean(user.permissionOverrides?.[key])} /> {label}</label>
                        ))}
                      </div>
                      <div>
                        <button type="submit">Save permissions</button>
                      </div>
                    </form>
                    {user.role !== 'platform_owner' && user.role !== 'company_owner' ? (
                      <form action={removeUserAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <button type="submit">Remove user</button>
                      </form>
                    ) : (
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Protected owner account</div>
                    )}
                  </div>
                ) : null}
              </div>
            )})}
            {(roleScope === 'platform' ? platformUsers : companyUsers).length === 0 ? <p style={{ margin: 0, color: '#6b7280' }}>No users in this scope yet.</p> : null}
          </div>
          {meRes.actor.role === 'platform_owner' || meRes.actor.role === 'platform_admin' ? (
            <form action={createInternalUserAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid #e5e7eb' }}>
              <input name="fullName" placeholder="Internal operator name" required style={{ ...inputStyle, minWidth: 180 }} />
              <input name="email" type="email" placeholder="operator@leadsprint.com" required style={{ ...inputStyle, minWidth: 220 }} />
              <select name="role" defaultValue="platform_agent" style={inputStyle}>
                <option value="platform_agent">Platform Agent</option>
                <option value="platform_sme">Platform SME</option>
                <option value="platform_admin">Platform Admin</option>
              </select>
              <button type="submit">Add internal operator</button>
            </form>
          ) : null}
        </article>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Platform controls</h2>
          <p style={{ marginTop: 0, color: '#6b7280' }}>System-level providers and bootstrap actions for the internal control plane.</p>
          <h3 style={{ marginBottom: 8 }}>Email providers</h3>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 4 }}>Platform access review</h2>
            <p style={{ margin: 0, color: '#6b7280' }}>Review incoming business requests, approve for activation, or send them back for follow-up.</p>
          </div>
          <form method="get" action="/settings" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="hidden" name="roleScope" value={roleScope} />
            <input name="q" defaultValue={searchParams?.q || ''} placeholder="Search org, name, email, status" style={{ ...inputStyle, minWidth: 260 }} />
            <button type="submit">Filter</button>
          </form>
        </div>
        <div style={{ display: 'grid', gap: 16, marginTop: 14 }}>
          {['pending', 'needs_follow_up', 'approved', 'rejected'].map((statusKey) => {
            const rows = filteredRequests.filter((request) => request.status === statusKey);
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
                      <div style={{ fontSize: 13, color: '#374151', display: 'grid', gap: 4 }}>
                        <div>Website: {request.website || '—'}</div>
                        <div>Team size: {request.team_size || '—'}</div>
                        <div>Requested features: {request.requested_features?.join(', ') || '—'}</div>
                        <div>Authority attested: {request.authority_attestation ? 'yes' : 'no'}</div>
                        <div>Activation state: {request.clerk_user_id ? 'Account linked' : request.activation_token ? 'Approved and awaiting activation' : 'Pre-auth request only'}</div>
                        <div>Created: {request.created_at}</div>
                        <div>Updated: {request.updated_at}</div>
                        {request.activation_token ? (
                          <div>
                            Activation link: <a href={`/sign-up?activation_token=${request.activation_token}`} target="_blank">Open activation</a>
                            <div><code>{`/sign-up?activation_token=${request.activation_token}`}</code></div>
                          </div>
                        ) : null}
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
        <h2 style={{ marginTop: 0 }}>Company invitations</h2>
        <p style={{ marginTop: 0, color: '#6b7280' }}>Invite customer-facing users into a verified business workspace as Admin or Agent.</p>
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
                    <div style={{ color: '#6b7280', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span>{invitation.role}</span>{statusBadge(invitation.status)}<span>{invitation.created_at}</span></div>
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
