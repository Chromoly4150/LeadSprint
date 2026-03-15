import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell, cardStyle } from '../../../components/app-shell';
import { apiFetch } from '../../../lib/api';
import { buildPrimaryNav, isPlatformRole } from '../../../lib/surfaces';

export default async function WorkspaceHomePage({ params }: { params: { slug: string } }) {
  const access = await apiFetch<{
    state: string;
    workspace?: { id: string; name: string; slug?: string; workspaceType?: string };
    user?: { role: string; roleLabel?: string; email: string };
  }>('/api/access/me');

  if (isPlatformRole(access.user?.role || '')) {
    redirect('/control');
  }

  const workspace = access.workspace;
  if (!workspace) redirect('/dashboard');
  if (params.slug !== workspace.slug) redirect(`/workspace/${workspace.slug}`);

  const [summaryRes, leadsRes] = await Promise.all([
    apiFetch<{ summary: { totalLeads: number; newLeads: number; contactedLeads: number; bookedLeads: number; hotLeads: number; needsAttentionLeads: number; conversionRate: number; recentInbound30d: number } }>('/api/dashboard/summary'),
    apiFetch<{ leads: Array<{ id: string; fullName: string; source: string; status: string; urgencyStatus: string }> }>('/api/leads?limit=5'),
  ]);

  const navItems = buildPrimaryNav({ role: access.user?.role || 'company_owner', workspaceSlug: workspace.slug });
  const summary = summaryRes.summary;

  return (
    <AppShell title={workspace.name} subtitle={`Workspace surface · slug ${workspace.slug} · ${workspace.workspaceType}`} navItems={navItems}>
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
          <h2 style={{ marginTop: 0 }}>Workspace routing foundation</h2>
          <ul>
            <li>This workspace now has a stable LeadSprint-owned slug.</li>
            <li>Platform operators should live in <strong>/control</strong>.</li>
            <li>Company users should land in <strong>/workspace/{workspace.slug}</strong>.</li>
            <li>Legacy routes still exist while the rest of the app is being ported onto slug-aware surfaces.</li>
          </ul>
        </article>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Recent leads</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {leadsRes.leads.map((lead) => (
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
