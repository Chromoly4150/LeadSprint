import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell, cardStyle, inputStyle } from '../../components/app-shell';
import { WorkspaceSwitcher } from '../../components/workspace-switcher';
import { apiFetch } from '../../lib/api';
import { buildPrimaryNav, isPlatformRole } from '../../lib/surfaces';
import { createTestOrganizationAction, switchWorkspaceAction } from '../(protected)/settings/actions';

export default async function ControlPage({ searchParams }: { searchParams?: { q?: string } }) {
  const meRes = await apiFetch<{ user?: { role?: string; roleLabel?: string; email?: string; platformRoles?: string[] }; workspace?: { slug?: string } | null; workspaces?: Array<{ id: string; name: string; slug?: string; workspaceType?: string; environment?: string; membershipRole?: string; active?: boolean }> }>('/api/access/me');
  if (!meRes.user?.role || !isPlatformRole(meRes.user.role)) redirect('/dashboard');

  const query = (searchParams?.q || '').trim();
  const directoryRes = query
    ? await apiFetch<{ users: Array<{ id: string; fullName: string; email: string; roleLabel?: string; role: string; organizationId?: string | null; organizationName?: string | null; organizationSlug?: string | null; organizationWorkspaceType?: string | null; organizationEnvironment?: string | null }>; organizations: Array<{ id: string; name: string; slug?: string; workspace_type: string; environment?: string; created_at: string }> }>(`/api/platform/directory?q=${encodeURIComponent(query)}`)
    : { users: [], organizations: [] };
  const navItems = buildPrimaryNav({ role: meRes.user.role, workspaceSlug: meRes.workspace?.slug });
  const hasResults = directoryRes.users.length > 0 || directoryRes.organizations.length > 0;

  return (
    <AppShell title="LeadSprint" subtitle={undefined} navItems={navItems} headerExtra={
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <WorkspaceSwitcher workspaces={meRes.workspaces || []} />
        <details style={{ position: 'relative' }}>
          <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '8px 12px', borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', fontWeight: 700 }}>⋯</summary>
          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 320, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', padding: 12, zIndex: 10, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 999, background: '#e5e7eb', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
                {(meRes.user.email || '?').slice(0,1).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{meRes.user.roleLabel || meRes.user.role}</div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>{meRes.user.email || 'unknown user'}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <button type="button" style={{ ...inputStyle, background: '#fff', textAlign: 'left', cursor: 'default' }}>Personal & company settings (coming later)</button>
              <form action={createTestOrganizationAction} style={{ display: 'grid', gap: 8 }}>
                <input name="name" placeholder="Create internal test org" style={inputStyle} />
                <button type="submit">Create test organization</button>
              </form>
            </div>
          </div>
        </details>
      </div>
    }>
      <section style={{ ...cardStyle, minHeight: 420, display: 'grid', alignContent: 'start', justifyItems: 'center', paddingTop: 48 }}>
        <form method="get" action="/control" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 820 }}>
          <select name="scope" defaultValue="all" style={{ ...inputStyle, minWidth: 180 }}>
            <option value="all">All</option>
            <option value="email">Email</option>
            <option value="name">Name</option>
            <option value="company">Company name</option>
          </select>
          <input name="q" defaultValue={query} placeholder="Search by email, name, or company" style={{ ...inputStyle, minWidth: 420, flex: '1 1 420px' }} />
          <button type="submit">Search</button>
        </form>

        {!query ? (
          <div style={{ color: '#6b7280', marginTop: 18, textAlign: 'center' }}>Search for an organization or user to open the relevant management context.</div>
        ) : !hasResults ? (
          <div style={{ color: '#6b7280', marginTop: 18, textAlign: 'center' }}>No users or organizations matched <strong>{query}</strong>.</div>
        ) : (
          <section style={{ display: 'grid', gap: 16, width: '100%', maxWidth: 980, marginTop: 24 }}>
          {directoryRes.organizations.length ? (
            <article style={{ ...cardStyle, width: '100%' }}>
              <h2 style={{ marginTop: 0 }}>Organizations</h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {directoryRes.organizations.map((org) => {
                  const isActive = (meRes.workspaces || []).some((workspace) => workspace.id === org.id && workspace.active);
                  return (
                    <div key={org.id} style={{ border: isActive ? '1px solid #2563eb' : '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{org.name}</div>
                          <div style={{ color: '#6b7280', fontSize: 12 }}>{org.workspace_type} · {org.environment || 'customer'} · slug: {org.slug || '—'}</div>
                        </div>
                        <div style={{ fontSize: 12, color: isActive ? '#2563eb' : '#6b7280', fontWeight: 700 }}>{isActive ? 'Active workspace' : 'Tenant workspace'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <form action={switchWorkspaceAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <input type="hidden" name="workspaceId" value={org.id} />
                          <input type="hidden" name="returnTo" value={org.slug ? `/control/workspaces/${org.slug}` : '/control'} />
                          <button type="submit">Set active workspace</button>
                        </form>
                        {org.slug ? <Link href={`/control/workspaces/${org.slug}`} style={{ padding: '8px 12px', borderRadius: 10, textDecoration: 'none', background: '#e5e7eb', color: '#111827', fontWeight: 600 }}>Open tenant</Link> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ) : null}

          {directoryRes.users.length ? (
            <article style={{ ...cardStyle, width: '100%' }}>
              <h2 style={{ marginTop: 0 }}>Users</h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {directoryRes.users.map((user) => {
                  const isActive = user.organizationId ? (meRes.workspaces || []).some((workspace) => workspace.id === user.organizationId && workspace.active) : false;
                  return (
                    <div key={user.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                      <div style={{ fontWeight: 700 }}>{user.fullName}</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>{user.email}</div>
                      <div style={{ color: '#6b7280', fontSize: 12 }}>{user.roleLabel || user.role} · {user.organizationName || 'No org'}</div>
                      {user.organizationId ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ color: '#6b7280', fontSize: 12 }}>{user.organizationWorkspaceType || 'workspace'} · {user.organizationEnvironment || 'customer'} · slug: {user.organizationSlug || '—'}</div>
                          <form action={switchWorkspaceAction}>
                            <input type="hidden" name="workspaceId" value={user.organizationId} />
                            <input type="hidden" name="returnTo" value={user.organizationSlug ? `/control/workspaces/${user.organizationSlug}` : '/control'} />
                            <button type="submit">{isActive ? 'Active workspace' : 'Set org active'}</button>
                          </form>
                          {user.organizationSlug ? <Link href={`/control/workspaces/${user.organizationSlug}`} style={{ padding: '8px 12px', borderRadius: 10, textDecoration: 'none', background: '#e5e7eb', color: '#111827', fontWeight: 600 }}>Open tenant</Link> : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </article>
          ) : null}
          </section>
        )}
      </section>
    </AppShell>
  );
}
