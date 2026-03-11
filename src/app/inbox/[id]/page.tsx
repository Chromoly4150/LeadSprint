import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Badge, toneForUrgency } from '@/components/badge';
import { getConversationThread } from '@/lib/db';

export default async function InboxThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const thread = getConversationThread(id);
  if (!thread) notFound();

  return (
    <AppShell title="Conversation" subtitle={`${thread.lead.name} · ${thread.channel}`}>
      <header className="page-header">
        <div>
          <p className="eyebrow">Thread</p>
          <h2>{thread.lead.name}</h2>
          <p className="muted">{thread.lead.company} · {thread.channel} · Assigned to {thread.assigneeName}</p>
        </div>
        <div className="toolbar">
          <Badge>{thread.status}</Badge>
          <Badge>{thread.lead.lifecycle}</Badge>
          <Badge tone={toneForUrgency(thread.lead.urgency)}>{thread.lead.urgency}</Badge>
          <span className="pill">Last message: {thread.lastMessageLabel}</span>
        </div>
      </header>

      <section className="detail-grid detail-grid-wide">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Messages</p>
              <h3>{thread.messages.length} messages in thread</h3>
            </div>
          </div>
          <div className="stack">
            {thread.messages.map((item) => (
              <div key={item.id} className="timeline-item">
                <div className="timeline-topline">
                  <div className="toolbar">
                    <Badge>{item.direction}</Badge>
                    <Badge>{item.channel}</Badge>
                  </div>
                  <span className="muted">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                <strong>{item.actorName}</strong>
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
              <p className="eyebrow">Lead context</p>
              <h3>Jump back to operations</h3>
            </div>
          </div>
          <ul className="attention-list">
            <li><strong>Email:</strong> {thread.lead.email}</li>
            <li><strong>Phone:</strong> {thread.lead.phone}</li>
            <li><strong>Source:</strong> {thread.lead.source}</li>
            <li><strong>Service:</strong> {thread.lead.service}</li>
          </ul>
          <div className="toolbar">
            <Link href={`/leads/${thread.lead.id}`} className="button-primary">Open lead workspace</Link>
            <Link href="/inbox" className="button-secondary">Back to inbox</Link>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
