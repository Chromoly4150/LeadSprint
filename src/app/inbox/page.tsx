import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Badge, toneForUrgency } from '@/components/badge';
import { conversationInbox } from '@/lib/db';

export default function InboxPage() {
  const conversations = conversationInbox();

  return (
    <AppShell title="Inbox" subtitle="Channel-threaded conversation workspace">
      <header className="page-header">
        <div>
          <p className="eyebrow">Inbox</p>
          <h2>Active conversations</h2>
          <p className="muted">Grouped by lead + channel so handoff and follow-up live in a recognizable thread.</p>
        </div>
      </header>

      <section className="card leads-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Conversation queue</p>
            <h3>{conversations.length} active threads</h3>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Urgency</th>
                <th>Assignee</th>
                <th>Last message</th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((conversation) => (
                <tr key={conversation.id}>
                  <td>
                    <Link href={`/inbox/${conversation.id}`} className="lead-link"><strong>{conversation.leadName}</strong></Link>
                    <div className="muted">{conversation.company}</div>
                  </td>
                  <td>{conversation.channel}</td>
                  <td><Badge>{conversation.status}</Badge></td>
                  <td><Badge tone={toneForUrgency(conversation.urgency)}>{conversation.urgency}</Badge></td>
                  <td>{conversation.assigneeName}</td>
                  <td>{conversation.lastMessageLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
