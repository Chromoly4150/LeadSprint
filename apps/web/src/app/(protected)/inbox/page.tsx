import Link from 'next/link';
import { AppShell, cardStyle, inputStyle } from '../../../components/app-shell';
import { apiFetch } from '../../../lib/api';
import { buildPrimaryNav } from '../../../lib/surfaces';
import { processLeadOutboxQueueAction } from '../leads/actions';

export default async function InboxPage() {
  const [leadsRes, accessRes] = await Promise.all([
    apiFetch<{ leads: Array<{ id: string; fullName: string; source: string; status: string; urgencyStatus: string; assignedUserName: string | null; lastContactedAt: string | null }> }>('/api/leads?limit=100'),
    apiFetch<{ workspace?: { slug?: string }; user?: { role: string } }>('/api/access/me'),
  ]);

  const leadsWithThreads = await Promise.all(
    leadsRes.leads.map(async (lead) => {
      const [comms, outbox] = await Promise.all([
        apiFetch<{ communications: Array<{ id: string; channel: string; direction: string; actorName: string; summary: string; occurredAt: string; providerKey?: string | null; providerThreadId?: string | null }> }>(`/api/leads/${lead.id}/communications`),
        apiFetch<{ items: Array<{ id: string; sendStatus: string; canProcess?: boolean; isFailed?: boolean; isQueued?: boolean }> }>(`/api/leads/${lead.id}/email-outbox`),
      ]);
      const latest = comms.communications[0] || null;
      const processableCount = outbox.items.filter((item) => item.canProcess).length;
      const failedCount = outbox.items.filter((item) => item.isFailed).length;
      const providerThreadCount = new Set(comms.communications.map((item) => item.providerThreadId).filter(Boolean)).size;
      const syncedCount = comms.communications.filter((item) => item.providerKey).length;
      return {
        ...lead,
        threadCount: comms.communications.length,
        latest,
        processableCount,
        failedCount,
        providerThreadCount,
        syncedCount,
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

  const navItems = buildPrimaryNav({ role: accessRes.user?.role || 'company_owner', workspaceSlug: accessRes.workspace?.slug });

  return (
    <AppShell title="Inbox" subtitle="Conversation-style operator view built on existing lead communications" navItems={navItems}>
      <section style={{ ...cardStyle, display: 'grid', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Active threads</h2>
          <p style={{ margin: '6px 0 0', color: '#6b7280' }}>Grouped by lead using the existing communication history already in the API.</p>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {items.length ? items.map((item) => (
            <div key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <Link href={`/inbox/${item.id}`} style={{ textDecoration: 'none', color: '#111827', fontWeight: 700 }}>{item.fullName}</Link>
                  <div style={{ color: '#6b7280', fontSize: 13 }}>{item.source} · {item.status} · {item.urgencyStatus}</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>Assigned: {item.assignedUserName || 'Unassigned'} · Messages: {item.threadCount}{item.latest?.providerKey ? ` · ${item.latest.providerKey} sync` : ''}{item.providerThreadCount ? ` · provider threads: ${item.providerThreadCount}` : ''}</div>
                  {item.syncedCount ? <div style={{ color: '#6b7280', fontSize: 12 }}>Synced messages: {item.syncedCount}</div> : null}
                  <div style={{ color: item.failedCount ? '#991b1b' : '#6b7280', fontSize: 12 }}>Outbox ready: {item.processableCount || 0}{item.failedCount ? ` · failed: ${item.failedCount}` : ''}</div>
                </div>
                <div style={{ textAlign: 'right', color: '#6b7280', fontSize: 12 }}>
                  {item.latest ? new Date(item.latest.occurredAt).toLocaleString() : '—'}
                </div>
              </div>
              {item.latest ? <div style={{ marginTop: 8, fontSize: 14 }}><strong>{item.latest.direction} {item.latest.channel}:</strong> {item.latest.summary}</div> : null}
              {item.processableCount ? (
                <form action={processLeadOutboxQueueAction} style={{ marginTop: 10 }}>
                  <input type="hidden" name="leadId" value={item.id} />
                  <input type="hidden" name="returnTo" value="inbox-thread" />
                  <button type="submit" style={{ ...inputStyle, background: item.failedCount ? '#fee2e2' : '#ecfccb', cursor: 'pointer' }}>{item.failedCount ? 'Process / retry outbox' : 'Process queued outbox'}</button>
                </form>
              ) : null}
            </div>
          )) : <div style={{ color: '#6b7280' }}>No active communication threads yet.</div>}
        </div>
      </section>
    </AppShell>
  );
}
