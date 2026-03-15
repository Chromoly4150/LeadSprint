import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell, cardStyle, inputStyle } from '../../components/app-shell';
import { WorkspaceSwitcher } from '../../components/workspace-switcher';
import { apiFetch } from '../../lib/api';
import { buildPrimaryNav, isPlatformRole } from '../../lib/surfaces';
import { createTestOrganizationAction } from '../(protected)/settings/actions';

export default async function ControlPage({ searchParams }: { searchParams?: { q?: string } }) {
  const meRes = await apiFetch<{ actor: { role: string; roleLabel?: string; email: string }; workspace?: { slug?: string }; workspaces?: Array<{ id: string; name: string; slug?: string; workspaceType?: string; environment?: string; membershipRole?: string; active?: boolean }> }>('/api/access/me');
  if (!isPlatformRole(meRes.actor.role)) redirect('/dashboard');

  const query = (searchParams?.q || '').trim();
  const directoryRes = query
    ? await apiFetch<{ users: Array<{ id: string; fullName: string; email: string; roleLabel?: string; role: string; organizationName?: string }>; organizations: Array<{ id: string; name: string; slug?: string; workspace_type: string; created_at: string }> }>(`/api/platform/directory?q=${encodeURIComponent(query)}`)
    : { users: [], organizations: [] };
  const navItems = buildPrimaryNav({ role: meRes.actor.role, workspaceSlug: meRes.workspace?.slug });
  const hasResults = directoryRes.users.length > 0 || directoryRes.organizations.length > 0;

  return (
    <AppShell title="Platform control plane" subtitle="Search for organizations or users, then open the specific entity you want to inspect." navItems={navItems} headerExtra={<WorkspaceSwitcher workspaces={meRes.workspaces || []} />}>
      <section style={{ ...cardStyle, marginBottom: 16 }}>
        <form action={createTestOrganizationAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input name="name" placeholder="Create internal test org" style={{ ...inputStyle, minWidth: 280 }} />
          <button type="submit">Create test organization</button>
        </form>
        <form method="get" action="/control" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input name="q" defaultValue={query} placeholder="Search org name, slug, user name, or user email" style={{ ...inputStyle, minWidth: 320 }} />
          <button type="submit">Search</button>
        </form>
        <p style={{ marginBottom: 0, color: '#6b7280' }}>Authenticated as {meRes.actor.email} · {meRes.actor.roleLabel || meRes.actor.role}</p>
      </section>

      {!query ? (
        <section style={cardStyle}>
          <div style={{ color: '#6b7280' }}>No entities are shown by default in the control plane. Search for an organization or user to open the relevant management context.</div>
        </section>
      ) : !hasResults ? (
        <section style={cardStyle}>
          <div style={{ color: '#6b7280' }}>No users or organizations matched <strong>{query}</strong>.</div>
        </section>
      ) : (
        <section style={{ display: 'grid', gap: 16 }}>
          {directoryRes.organizations.length ? (
            <article style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>Organizations</h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {directoryRes.organizations.map((org) => (
                  <div key={org.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                    <div style={{ fontWeight: 700 }}>{org.name}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>{org.workspace_type} · slug: {org.slug || '—'}</div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {directoryRes.users.length ? (
            <article style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>Users</h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {directoryRes.users.map((user) => (
                  <div key={user.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                    <div style={{ fontWeight: 700 }}>{user.fullName}</div>
                    <div style={{ color: '#6b7280', fontSize: 13 }}>{user.email}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>{user.roleLabel || user.role} · {user.organizationName || 'No org'}</div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </section>
      )}
    </AppShell>
  );
}
