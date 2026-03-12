import { AppShell, cardStyle, inputStyle } from '../../../components/app-shell';
import { apiFetch } from '../../../lib/api';
import {
  addCommunicationAction,
  addLeadNoteAction,
  createDraftAction,
  queueOutboxAction,
  updateLeadStatusAction,
  updateLeadUrgencyAction,
} from './actions';

type SearchParams = { selected?: string };

export default async function LeadsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) || {};
  const [leadsRes, usersRes] = await Promise.all([
    apiFetch<{ leads: Array<{ id: string; fullName: string; email: string | null; phone: string | null; source: string; message: string | null; status: string; urgencyStatus: string; assignedUserId: string | null; assignedUserName: string | null; ownerUserName: string | null; lastContactedAt: string | null }> }>('/api/leads?limit=50'),
    apiFetch<{ users: Array<{ id: string; fullName: string; role: string }> }>('/api/users-lite'),
  ]);

  const leads = leadsRes.leads;
  const selectedId = params.selected || leads[0]?.id;
  const selectedLead = selectedId ? leads.find((lead) => lead.id === selectedId) ?? null : null;

  const [leadRes, notesRes, commsRes, draftsRes, outboxRes] = selectedLead
    ? await Promise.all([
        apiFetch<{ lead: { id: string; fullName: string; email: string | null; phone: string | null; source: string; message: string | null; status: string; urgencyStatus: string; assignedUserId: string | null; assignedUserName: string | null; ownerUserName: string | null; receivedAt: string; lastContactedAt: string | null } }>(`/api/leads/${selectedLead.id}`),
        apiFetch<{ notes: Array<{ id: string; content: string; noteType: string; authorName: string; createdAt: string }> }>(`/api/leads/${selectedLead.id}/notes`),
        apiFetch<{ communications: Array<{ id: string; channel: string; direction: string; actorName: string; subject: string | null; summary: string; content: string; occurredAt: string }> }>(`/api/leads/${selectedLead.id}/communications`),
        apiFetch<{ drafts: Array<{ id: string; toEmail: string; subject: string; body: string; status: string; createdAt: string; createdByName: string }> }>(`/api/leads/${selectedLead.id}/email-drafts`),
        apiFetch<{ items: Array<{ id: string; providerKey: string; sendStatus: string; queuedAt: string; sentAt: string | null; failedAt: string | null; lastError: string | null; subject: string; toEmail: string; emailDraftId: string | null }> }>(`/api/leads/${selectedLead.id}/email-outbox`),
      ])
    : [null, null, null, null, null];

  const users = usersRes.users;
  const lead = leadRes?.lead;
  const notes = notesRes?.notes ?? [];
  const communications = commsRes?.communications ?? [];
  const drafts = draftsRes?.drafts ?? [];
  const outbox = outboxRes?.items ?? [];

  return (
    <AppShell title="Leads" subtitle="Split queue + interactive detail workspace on remote main">
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
                  <form action={updateLeadStatusAction}>
                    <input type="hidden" name="leadId" value={lead.id} />
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Status</div>
                    <select name="status" style={{ ...inputStyle, width: '100%' }} defaultValue={lead.status}>
                      <option value="new">new</option>
                      <option value="contacted">contacted</option>
                      <option value="booked">booked</option>
                      <option value="closed">closed</option>
                    </select>
                    <button type="submit" style={{ marginTop: 8, ...inputStyle, background: '#eef2ff', cursor: 'pointer' }}>Update status</button>
                  </form>
                  <form action={updateLeadUrgencyAction}>
                    <input type="hidden" name="leadId" value={lead.id} />
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Urgency</div>
                    <select name="urgencyStatus" style={{ ...inputStyle, width: '100%' }} defaultValue={lead.urgencyStatus}>
                      <option value="hot">hot</option>
                      <option value="warm">warm</option>
                      <option value="cold">cold</option>
                      <option value="needs_attention">needs_attention</option>
                      <option value="sla_risk">sla_risk</option>
                    </select>
                    <button type="submit" style={{ marginTop: 8, ...inputStyle, background: '#eef2ff', cursor: 'pointer' }}>Update urgency</button>
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
                  <form action={addLeadNoteAction} style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                    <input type="hidden" name="leadId" value={lead.id} />
                    <textarea name="content" rows={3} style={{ ...inputStyle, width: '100%' }} placeholder="Add internal context or next-step notes" />
                    <button type="submit" style={{ ...inputStyle, background: '#eef2ff', cursor: 'pointer' }}>Add note</button>
                  </form>
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
                  <form action={addCommunicationAction} style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                    <input type="hidden" name="leadId" value={lead.id} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <select name="channel" style={inputStyle} defaultValue="email">
                        <option value="email">email</option>
                        <option value="sms">sms</option>
                        <option value="call">call</option>
                        <option value="chat">chat</option>
                      </select>
                      <select name="direction" style={inputStyle} defaultValue="outbound">
                        <option value="outbound">outbound</option>
                        <option value="inbound">inbound</option>
                      </select>
                    </div>
                    <input name="subject" style={inputStyle} placeholder="Subject (optional)" />
                    <input name="summary" style={inputStyle} placeholder="Summary" />
                    <textarea name="content" rows={3} style={{ ...inputStyle, width: '100%' }} placeholder="Communication content" />
                    <button type="submit" style={{ ...inputStyle, background: '#eef2ff', cursor: 'pointer' }}>Log communication</button>
                  </form>
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
                  <form action={createDraftAction} style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                    <input type="hidden" name="leadId" value={lead.id} />
                    <input name="toEmail" defaultValue={lead.email || ''} style={inputStyle} placeholder="Recipient email" />
                    <input name="subject" style={inputStyle} placeholder="Draft subject" />
                    <textarea name="body" rows={4} style={{ ...inputStyle, width: '100%' }} placeholder="Draft body" />
                    <button type="submit" style={{ ...inputStyle, background: '#eef2ff', cursor: 'pointer' }}>Create draft</button>
                  </form>
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
                  <form action={queueOutboxAction} style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                    <input type="hidden" name="leadId" value={lead.id} />
                    <select name="emailDraftId" style={inputStyle} defaultValue="">
                      <option value="">Queue latest/inline draft</option>
                      {drafts.map((draft) => <option key={draft.id} value={draft.id}>{draft.subject}</option>)}
                    </select>
                    <select name="providerKey" style={inputStyle} defaultValue="gmail">
                      <option value="gmail">gmail</option>
                      <option value="stub">stub</option>
                    </select>
                    <button type="submit" style={{ ...inputStyle, background: '#eef2ff', cursor: 'pointer' }}>Queue outbox item</button>
                  </form>
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
