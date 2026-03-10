import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Badge, toneForUrgency } from '@/components/badge';
import { getLead } from '@/lib/mock-data';

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = getLead(id);

  if (!lead) notFound();

  return (
    <AppShell title="Lead detail" subtitle={`${lead.name} · ${lead.company}`}>
      <header className="page-header">
        <div>
          <p className="eyebrow">Lead workspace</p>
          <h2>{lead.name}</h2>
          <p className="muted">{lead.company} · {lead.service}</p>
        </div>
        <div className="toolbar">
          <Badge>{lead.lifecycle}</Badge>
          <Badge tone={toneForUrgency(lead.urgency)}>{lead.urgency}</Badge>
          <span className="pill">Assigned: {lead.assignee}</span>
        </div>
      </header>

      <section className="detail-grid">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Overview</p>
              <h3>Lead details</h3>
            </div>
          </div>
          <dl className="meta-grid">
            <div><dt>Email</dt><dd>{lead.email}</dd></div>
            <div><dt>Phone</dt><dd>{lead.phone}</dd></div>
            <div><dt>Source</dt><dd>{lead.source}</dd></div>
            <div><dt>State</dt><dd>{lead.state}</dd></div>
            <div><dt>Received</dt><dd>{lead.receivedAt}</dd></div>
            <div><dt>Last activity</dt><dd>{lead.lastActivity}</dd></div>
          </dl>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Internal notes</p>
              <h3>Org-only context</h3>
            </div>
          </div>
          <div className="stack">
            {lead.notes.map((note) => (
              <div key={note.id} className="note-card">
                <div className="note-header">
                  <strong>{note.author}</strong>
                  <span className="muted">{note.createdAt}</span>
                </div>
                <div className="muted smallcaps">{note.type.replace('_', ' ')}</div>
                <p>{note.content}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="detail-grid detail-grid-wide">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Communication log</p>
              <h3>Full timestamped history</h3>
            </div>
          </div>
          <div className="stack">
            {lead.communications.map((item) => (
              <div key={item.id} className="timeline-item">
                <div className="timeline-topline">
                  <div className="toolbar">
                    <Badge>{item.channel}</Badge>
                    <Badge>{item.direction}</Badge>
                  </div>
                  <span className="muted">{item.createdAt}</span>
                </div>
                <strong>{item.actor}</strong>
                {item.subject ? <div className="muted">Subject: {item.subject}</div> : null}
                <p><strong>Summary:</strong> {item.summary}</p>
                <p className="muted">{item.content}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Activity</p>
              <h3>Timeline</h3>
            </div>
          </div>
          <div className="stack">
            {lead.activity.map((item) => (
              <div key={item.id} className="timeline-item">
                <div className="timeline-topline">
                  <strong>{item.label}</strong>
                  <span className="muted">{item.createdAt}</span>
                </div>
                <p className="muted">{item.detail}</p>
              </div>
            ))}
          </div>
          <div className="detail-actions">
            <Link href="/leads" className="pill">Back to leads</Link>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
