import Link from 'next/link';
import { AppShell, cardStyle } from '../../../components/app-shell';
import { apiFetch } from '../../../lib/api';

export default async function InboxPage() {
  const leadsRes = await apiFetch<{ leads: Array<{ id: string; fullName: string; source: string; status: string; urgencyStatus: string; assignedUserName: string | null; lastContactedAt: string | null }> }>('/api/leads?limit=100');

  const leadsWithThreads = await Promise.all(
    leadsRes.leads.map(async (lead) => {
      const comms = await apiFetch<{ communications: Array<{ id: string; channel: string; direction: string; actorName: string; summary: string; occurredAt: string }> }>(`/api/leads/${lead.id}/communications`);
      const latest = comms.communications[0] || null;
      return {
        ...lead,
        threadCount: comms.communications.length,
        latest,
      };
    })
  );

  const items = leadsWithThreads
    .filter((item) => item.threadCount > 0)
    .sort((a, b) => {
      const aTime = a.latest ? new Date(a.latest.occurredAt).getTime() : 0;
      const bTime = b.latest ? new Date(b.latest.occurredAt).getTime() : 0;
      return bTime - aTime;
    });

  return (
    <AppShell title="Inbox" subtitle="Conversation-style operator view built on existing lead communications">
      <section style={{ ...cardStyle, display: 'grid', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Active threads</h2>
          <p style={{ margin: '6px 0 0', color: '#6b7280' }}>Grouped by lead using the existing communication history already in the API.</p>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {items.length ? items.map((item) => (
            <Link key={item.id} href={`/inbox/${item.id}`} style={{ textDecoration: 'none', color: '#111827', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{item.fullName}</div>
                  <div style={{ color: '#6b7280', fontSize: 13 }}>{item.source} · {item.status} · {item.urgencyStatus}</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>Assigned: {item.assignedUserName || 'Unassigned'} · Messages: {item.threadCount}</div>
                </div>
                <div style={{ textAlign: 'right', color: '#6b7280', fontSize: 12 }}>
                  {item.latest ? new Date(item.latest.occurredAt).toLocaleString() : '—'}
                </div>
              </div>
              {item.latest ? <div style={{ marginTop: 8, fontSize: 14 }}><strong>{item.latest.direction} {item.latest.channel}:</strong> {item.latest.summary}</div> : null}
            </Link>
          )) : <div style={{ color: '#6b7280' }}>No active communication threads yet.</div>}
        </div>
      </section>
    </AppShell>
  );
}
