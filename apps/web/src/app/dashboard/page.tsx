import Link from 'next/link';
import { AppShell, cardStyle } from '../../components/app-shell';
import { apiFetch } from '../../lib/api';

export default async function DashboardPage() {
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
