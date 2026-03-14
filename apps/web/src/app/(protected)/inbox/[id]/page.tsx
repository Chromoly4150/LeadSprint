import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell, cardStyle, inputStyle } from '../../../../components/app-shell';
import { apiFetch } from '../../../../lib/api';
import { addCommunicationAction, addLeadNoteAction, createDraftAction, generateAiDraftAction, queueOutboxAction } from '../../leads/actions';

export default async function InboxThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [leadRes, notesRes, commsRes, draftsRes, outboxRes] = await Promise.all([
    apiFetch<{ lead: { id: string; fullName: string; email: string | null; phone: string | null; source: string; message: string | null; status: string; urgencyStatus: string; assignedUserName: string | null; lastContactedAt: string | null } }>(`/api/leads/${id}`),
    apiFetch<{ notes: Array<{ id: string; content: string; noteType: string; authorName: string; createdAt: string }> }>(`/api/leads/${id}/notes`),
    apiFetch<{ communications: Array<{ id: string; channel: string; direction: string; actorName: string; subject: string | null; summary: string; content: string; occurredAt: string }> }>(`/api/leads/${id}/communications`),
    apiFetch<{ drafts: Array<{ id: string; toEmail: string; subject: string; body: string; status: string; createdAt: string; createdByName: string }> }>(`/api/leads/${id}/email-drafts`),
    apiFetch<{ items: Array<{ id: string; providerKey: string; sendStatus: string; queuedAt: string; lastError: string | null; subject: string; toEmail: string; emailDraftId: string | null }> }>(`/api/leads/${id}/email-outbox`),
  ]).catch(() => [null, null, null, null, null] as const);

  if (!leadRes) notFound();

  const lead = leadRes.lead;
  const notes = notesRes?.notes ?? [];
  const communications = commsRes?.communications ?? [];
  const drafts = draftsRes?.drafts ?? [];
  const outbox = outboxRes?.items ?? [];

  return (
    <AppShell title="Inbox Thread" subtitle={`${lead.fullName} · ${lead.source} · ${lead.status}`}>
      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16 }}>
        <article style={{ ...cardStyle, display: 'grid', gap: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>{lead.fullName}</h2>
            <div style={{ color: '#6b7280', marginTop: 6 }}>{lead.email || 'No email'} · {lead.phone || 'No phone'} · Assigned: {lead.assignedUserName || 'Unassigned'}</div>
            <div style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>{lead.message || 'No intake message provided.'}</div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {communications.length ? communications.map((item) => (
              <div key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: item.direction === 'outbound' ? '#eef2ff' : '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>{item.direction} {item.channel}</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>{new Date(item.occurredAt).toLocaleString()}</div>
                </div>
                <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>{item.actorName}</div>
                {item.subject ? <div style={{ marginTop: 8 }}><strong>Subject:</strong> {item.subject}</div> : null}
                <div style={{ marginTop: 8 }}>{item.content || item.summary}</div>
              </div>
            )) : <div style={{ color: '#6b7280' }}>No thread messages yet.</div>}
          </div>
        </article>

        <aside style={{ display: 'grid', gap: 16 }}>
          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Quick reply / log</h3>
            <form action={addCommunicationAction} style={{ display: 'grid', gap: 8 }}>
              <input type="hidden" name="leadId" value={lead.id} />
              <select name="channel" style={inputStyle} defaultValue="email">
                <option value="email">email</option>
                <option value="sms">sms</option>
                <option value="call">call</option>
                <option value="chat">chat</option>
              </select>
              <input name="subject" style={inputStyle} placeholder="Subject (optional)" defaultValue={lead.email ? 'Quick follow-up' : ''} />
              <input name="summary" style={inputStyle} placeholder="Summary" />
              <textarea name="content" rows={5} style={{ ...inputStyle, width: '100%' }} placeholder="Type the reply or communication log here" />
              <button type="submit" style={{ ...inputStyle, background: '#eef2ff', cursor: 'pointer' }}>Save communication</button>
            </form>
          </section>

          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Internal note</h3>
            <form action={addLeadNoteAction} style={{ display: 'grid', gap: 8 }}>
              <input type="hidden" name="leadId" value={lead.id} />
              <textarea name="content" rows={4} style={{ ...inputStyle, width: '100%' }} placeholder="Add operator-only note" />
              <button type="submit" style={{ ...inputStyle, background: '#eef2ff', cursor: 'pointer' }}>Add note</button>
            </form>
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {notes.slice(0, 3).map((note) => (
                <div key={note.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontWeight: 600 }}>{note.authorName}</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>{new Date(note.createdAt).toLocaleString()}</div>
                  <div style={{ marginTop: 6 }}>{note.content}</div>
                </div>
              ))}
            </div>
          </section>

          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Draft + outbox</h3>
            <form action={generateAiDraftAction} style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
              <input type="hidden" name="leadId" value={lead.id} />
              <input type="hidden" name="toEmail" value={lead.email || ''} />
              <button type="submit" style={{ ...inputStyle, background: '#dcfce7', cursor: 'pointer' }}>Generate AI draft</button>
            </form>
            <form action={createDraftAction} style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
              <input type="hidden" name="leadId" value={lead.id} />
              <input name="toEmail" defaultValue={lead.email || ''} style={inputStyle} placeholder="Recipient email" />
              <input name="subject" style={inputStyle} placeholder="Draft subject" />
              <textarea name="body" rows={4} style={{ ...inputStyle, width: '100%' }} placeholder="Draft body" />
              <button type="submit" style={{ ...inputStyle, background: '#eef2ff', cursor: 'pointer' }}>Create draft</button>
            </form>
            <form action={queueOutboxAction} style={{ display: 'grid', gap: 8 }}>
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
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {drafts.slice(0, 3).map((draft) => (
                <div key={draft.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontWeight: 600 }}>{draft.subject}</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>{draft.toEmail} · {draft.status}</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>By {draft.createdByName} · {new Date(draft.createdAt).toLocaleString()}</div>
                  <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 13, color: '#374151' }}>{draft.body}</div>
                </div>
              ))}
              {outbox.slice(0, 4).map((item) => (
                <div key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontWeight: 600 }}>{item.subject}</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>{item.toEmail} · {item.providerKey} · {item.sendStatus}</div>
                  {item.lastError ? <div style={{ color: '#991b1b', fontSize: 12, marginTop: 6 }}>{item.lastError}</div> : null}
                </div>
              ))}
              {drafts.length === 0 && outbox.length === 0 ? <div style={{ color: '#6b7280' }}>No drafts or outbox items yet.</div> : null}
            </div>
          </section>

          <section style={cardStyle}>
            <Link href={`/leads?selected=${lead.id}`} style={{ textDecoration: 'none', color: '#2563eb', fontWeight: 700 }}>Open full lead workspace →</Link>
          </section>
        </aside>
      </section>
    </AppShell>
  );
}
