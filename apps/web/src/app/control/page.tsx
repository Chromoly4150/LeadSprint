import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell, cardStyle, inputStyle } from '../../components/app-shell';
import { apiFetch } from '../../lib/api';
import { buildPrimaryNav, isPlatformRole } from '../../lib/surfaces';

export default async function ControlPage({ searchParams }: { searchParams?: { q?: string } }) {
  const meRes = await apiFetch<{ actor: { role: string; roleLabel?: string; email: string }; workspace?: { slug?: string } }>('/api/me/permissions');
  if (!isPlatformRole(meRes.actor.role)) redirect('/dashboard');

  const query = (searchParams?.q || '').trim();
  const directoryRes = await apiFetch<{ users: Array<{ id: string; fullName: string; email: string; roleLabel?: string; role: string; organizationName?: string }>; organizations: Array<{ id: string; name: string; slug?: string; workspace_type: string; created_at: string }> }>(`/api/platform/directory${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  const navItems = buildPrimaryNav({ role: meRes.actor.role, workspaceSlug: meRes.workspace?.slug });

  return (
    <AppShell title="Platform control plane" subtitle="Search and access organizations, operators, approvals, and platform activity from a dedicated internal surface." navItems={navItems}>
      <section style={{ ...cardStyle, marginBottom: 16 }}>
        <form method="get" action="/control" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input name="q" defaultValue={query} placeholder="Search org name, slug, user name, or user email" style={{ ...inputStyle, minWidth: 320 }} />
          <button type="submit">Search</button>
        </form>
        <p style={{ marginBottom: 0, color: '#6b7280' }}>Authenticated as {meRes.actor.email} · {meRes.actor.roleLabel || meRes.actor.role}</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Users</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {directoryRes.users.length ? directoryRes.users.map((user) => (
              <div key={user.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                <div style={{ fontWeight: 700 }}>{user.fullName}</div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>{user.email}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{user.roleLabel || user.role} · {user.organizationName || 'No org'}</div>
              </div>
            )) : <div style={{ color: '#6b7280' }}>No users matched this search.</div>}
          </div>
        </article>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Workspaces</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {directoryRes.organizations.length ? directoryRes.organizations.map((org) => (
              <div key={org.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                <div style={{ fontWeight: 700 }}>{org.name}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{org.workspace_type} · slug: {org.slug || '—'}</div>
                <div style={{ marginTop: 8 }}><Link href={`/workspace/${org.slug || org.id}`}>Open workspace surface</Link></div>
              </div>
            )) : <div style={{ color: '#6b7280' }}>No organizations matched this search.</div>}
          </div>
          <div style={{ marginTop: 12, color: '#6b7280', fontSize: 12 }}>Impersonation should still be introduced later as an explicitly audited action, not a casual click-through.</div>
        </article>
      </section>
    </AppShell>
  );
}
