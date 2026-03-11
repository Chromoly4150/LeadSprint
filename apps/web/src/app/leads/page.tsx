import { AppShell, cardStyle, inputStyle } from '../../components/app-shell';
import { apiFetch } from '../../lib/api';

type SearchParams = { selected?: string };

export default async function LeadsPage({ searchParams }: { searchParams?: SearchParams }) {
  const [leadsRes, usersRes] = await Promise.all([
    apiFetch<{ leads: Array<{ id: string; fullName: string; email: string | null; phone: string | null; source: string; message: string | null; status: string; urgencyStatus: string; assignedUserId: string | null; assignedUserName: string | null; ownerUserName: string | null; lastContactedAt: string | null }> }>('/api/leads?limit=50'),
    apiFetch<{ users: Array<{ id: string; fullName: string; role: string }> }>('/api/users-lite'),
  ]);

  const leads = leadsRes.leads;
  const selectedId = searchParams?.selected || leads[0]?.id;
  const selectedLead = selectedId ? leads.find((lead) => lead.id === selectedId) ?? null : null;

  const [leadRes, notesRes, commsRes, draftsRes, outboxRes] = selectedLead
    ? await Promise.all([
        apiFetch<{ lead: { id: string; fullName: string; email: string | null; phone: string | null; source: string; message: string | null; status: string; urgencyStatus: string; assignedUserId: string | null; assignedUserName: string | null; ownerUserName: string | null; receivedAt: string; lastContactedAt: string | null } }>(`/api/leads/${selectedLead.id}`),
        apiFetch<{ notes: Array<{ id: string; content: string; noteType: string; authorName: string; createdAt: string }> }>(`/api/leads/${selectedLead.id}/notes`),
        apiFetch<{ communications: Array<{ id: string; channel: string; direction: string; actorName: string; subject: string | null; summary: string; content: string; occurredAt: string }> }>(`/api/leads/${selectedLead.id}/communications`),
        apiFetch<{ drafts: Array<{ id: string; toEmail: string; subject: string; body: string; status: string; createdAt: string; createdByName: string }> }>(`/api/leads/${selectedLead.id}/email-drafts`),
        apiFetch<{ items: Array<{ id: string; providerKey: string; sendStatus: string; queuedAt: string; sentAt: string | null; failedAt: string | null; lastError: string | null; subject: string; toEmail: string }> }>(`/api/leads/${selectedLead.id}/email-outbox`),
      ])
    : [null, null, null, null, null];

  const users = usersRes.users;
  const lead = leadRes?.lead;
  const notes = notesRes?.notes ?? [];
  const communications = commsRes?.communications ?? [];
  const drafts = draftsRes?.drafts ?? [];
  const outbox = outboxRes?.items ?? [];

  return (
    <AppShell title="Leads" subtitle="Split queue + detail workspace ported onto remote main">
      <section style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.5fr', gap: 16 }}>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Lead queue</h2>
          <div style={{ display: 'grid', gap: 8, maxHeight: '80vh', overflow: 'auto' }}>
            {leads.map((item) => {
              const active = item.id === selectedId;
              return (
                <a
                  key={item.id}
                  href={`/leads?selected=${item.id}`}
                  style={{
                    border: active ? '2px solid #2563eb' : '1px solid #e5e7eb',
                    borderRadius: 10,
                    padding: 10,
                    textDecoration: 'none',
                    color: '#111827',
                    background: active ? '#eff6ff' : '#fff',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{item.fullName}</div>
                  <div style={{ color: '#6b7280', fontSize: 13 }}>{item.source} · {item.status} · {item.urgencyStatus}</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>Assignee: {item.assignedUserName || 'Unassigned'}</div>
                </a>
              );
            })}
          </div>
        </article>

        <article style={{ display: 'grid', gap: 16 }}>
          {lead ? (
            <>
              <section style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ margin: '0 0 4px' }}>{lead.fullName}</h2>
                    <div style={{ color: '#6b7280' }}>{lead.source} · {lead.status} · {lead.urgencyStatus}</div>
                    <div style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>{lead.email || 'No email'} · {lead.phone || 'No phone'}</div>
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>Assigned: {lead.assignedUserName || 'Unassigned'}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                  <form action={`${process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000'}/api/leads/${lead.id}`} method="post">
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Assignment/status changes still need interactive API form wiring. Current team:</div>
                    <select style={{ ...inputStyle, width: '100%' }} defaultValue={lead.assignedUserId || ''}>
                      <option value="">Unassigned</option>
                      {users.map((user) => <option key={user.id} value={user.id}>{user.fullName} · {user.role}</option>)}
                    </select>
                  </form>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Message</div>
                    <div style={{ fontSize: 14 }}>{lead.message || 'No intake message provided.'}</div>
                  </div>
                </div>
              </section>

              <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <article style={cardStyle}>
                  <h3 style={{ marginTop: 0 }}>Internal notes</h3>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {notes.length ? notes.map((note) => (
                      <div key={note.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                        <div style={{ fontWeight: 600 }}>{note.authorName}</div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>{note.noteType} · {new Date(note.createdAt).toLocaleString()}</div>
                        <div style={{ marginTop: 6 }}>{note.content}</div>
                      </div>
                    )) : <div style={{ color: '#6b7280' }}>No notes yet.</div>}
                  </div>
                </article>

                <article style={cardStyle}>
                  <h3 style={{ marginTop: 0 }}>Communications</h3>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {communications.length ? communications.map((item) => (
                      <div key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                        <div style={{ fontWeight: 600 }}>{item.direction} {item.channel}</div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>{item.actorName} · {new Date(item.occurredAt).toLocaleString()}</div>
                        {item.subject ? <div style={{ marginTop: 6 }}><strong>Subject:</strong> {item.subject}</div> : null}
                        <div style={{ marginTop: 6 }}>{item.summary}</div>
                      </div>
                    )) : <div style={{ color: '#6b7280' }}>No communications yet.</div>}
                  </div>
                </article>
              </section>

              <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <article style={cardStyle}>
                  <h3 style={{ marginTop: 0 }}>Email drafts</h3>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {drafts.length ? drafts.map((draft) => (
                      <div key={draft.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                        <div style={{ fontWeight: 600 }}>{draft.subject}</div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>{draft.toEmail} · {draft.status}</div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>By {draft.createdByName} · {new Date(draft.createdAt).toLocaleString()}</div>
                      </div>
                    )) : <div style={{ color: '#6b7280' }}>No drafts yet.</div>}
                  </div>
                </article>

                <article style={cardStyle}>
                  <h3 style={{ marginTop: 0 }}>Email outbox</h3>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {outbox.length ? outbox.map((item) => (
                      <div key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                        <div style={{ fontWeight: 600 }}>{item.subject}</div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>{item.toEmail} · {item.providerKey} · {item.sendStatus}</div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>Queued {new Date(item.queuedAt).toLocaleString()}</div>
                        {item.lastError ? <div style={{ color: '#991b1b', fontSize: 12, marginTop: 6 }}>{item.lastError}</div> : null}
                      </div>
                    )) : <div style={{ color: '#6b7280' }}>No outbox items yet.</div>}
                  </div>
                </article>
              </section>
            </>
          ) : (
            <section style={cardStyle}>No lead selected.</section>
          )}
        </article>
      </section>
    </AppShell>
  );
}
