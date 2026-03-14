import Link from 'next/link';
import { AppShell, cardStyle, inputStyle } from '../../../components/app-shell';
import { apiFetch } from '../../../lib/api';

export default async function DashboardPage({ searchParams }: { searchParams?: { q?: string } }) {
  const meRes = await apiFetch<{ actor: { role: string; roleLabel?: string; email: string } }>('/api/me/permissions');
  const query = (searchParams?.q || '').trim();

  if (meRes.actor.role.startsWith('platform_')) {
    const directoryRes = await apiFetch<{ users: Array<{ id: string; fullName: string; email: string; roleLabel?: string; role: string; organizationName?: string }>; organizations: Array<{ id: string; name: string; workspace_type: string; created_at: string }> }>(`/api/platform/directory${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    return (
      <AppShell title="Platform Owner View" subtitle="Search and access organizations, operators, and customer accounts from a single control-plane surface.">
        <section style={{ ...cardStyle, marginBottom: 16 }}>
          <form method="get" action="/dashboard" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input name="q" defaultValue={query} placeholder="Search org name, user name, or user email" style={{ ...inputStyle, minWidth: 320 }} />
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
            <h2 style={{ marginTop: 0 }}>Organizations</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {directoryRes.organizations.length ? directoryRes.organizations.map((org) => (
                <div key={org.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontWeight: 700 }}>{org.name}</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>{org.workspace_type} · {org.id}</div>
                </div>
              )) : <div style={{ color: '#6b7280' }}>No organizations matched this search.</div>}
            </div>
            <div style={{ marginTop: 12, color: '#6b7280', fontSize: 12 }}>Impersonation should be added later as an explicitly audited platform-owner action, not a casual click-through.</div>
          </article>
        </section>
      </AppShell>
    );
  }

  const [summaryRes, leadsRes] = await Promise.all([
    apiFetch<{ summary: { totalLeads: number; newLeads: number; contactedLeads: number; bookedLeads: number; hotLeads: number; needsAttentionLeads: number; conversionRate: number; recentInbound30d: number } }>('/api/dashboard/summary'),
    apiFetch<{ leads: Array<{ id: string; fullName: string; source: string; status: string; urgencyStatus: string }> }>('/api/leads?limit=5'),
  ]);

  const summary = summaryRes.summary;
  const leads = leadsRes.leads;

  return (
    <AppShell title="Dashboard" subtitle="Remote-main architecture with ported workflow surfaces underway">
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          ['Inbound (30d)', summary.recentInbound30d],
          ['Hot leads', summary.hotLeads],
          ['Needs attention', summary.needsAttentionLeads],
          ['Conversion rate', `${summary.conversionRate}%`],
        ].map(([label, value]) => (
          <article key={String(label)} style={cardStyle}><div style={{ color: '#6b7280', fontSize: 12 }}>{label}</div><div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{value}</div></article>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Pipeline snapshot</h2>
          <ul>
            <li>New leads: {summary.newLeads}</li>
            <li>Contacted leads: {summary.contactedLeads}</li>
            <li>Booked leads: {summary.bookedLeads}</li>
            <li>Total leads: {summary.totalLeads}</li>
          </ul>
        </article>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Recent leads</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {leads.map((lead) => (
              <div key={lead.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                <Link href={`/leads?selected=${lead.id}`} style={{ textDecoration: 'none', color: '#111827', fontWeight: 700 }}>{lead.fullName}</Link>
                <div style={{ color: '#6b7280', fontSize: 13 }}>{lead.source} · {lead.status} · {lead.urgencyStatus}</div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
