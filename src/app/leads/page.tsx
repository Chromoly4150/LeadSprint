import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Badge, toneForUrgency } from '@/components/badge';
import { leads } from '@/lib/mock-data';

export default function LeadsPage() {
  return (
    <AppShell title="Leads" subtitle="Sortable, filterable lead workspace">
      <header className="page-header">
        <div>
          <p className="eyebrow">Lead list</p>
          <h2>All leads</h2>
          <p className="muted">Review lead status, urgency, assignee, and recent contact activity.</p>
        </div>
      </header>

      <section className="card leads-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Filters & sorting</p>
            <h3>Current controls</h3>
          </div>
          <div className="toolbar">
            <span className="pill">Sort: newest received</span>
            <span className="pill">Filter: state</span>
            <span className="pill">Filter: lifecycle</span>
            <span className="pill">Filter: urgency</span>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Source</th>
                <th>State</th>
                <th>Lifecycle</th>
                <th>Urgency</th>
                <th>Assignee</th>
                <th>Received</th>
                <th>Last contact</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <Link href={`/leads/${lead.id}`} className="lead-link">
                      <strong>{lead.name}</strong>
                    </Link>
                    <div className="muted">{lead.company}</div>
                  </td>
                  <td>{lead.source}</td>
                  <td>{lead.state}</td>
                  <td><Badge>{lead.lifecycle}</Badge></td>
                  <td><Badge tone={toneForUrgency(lead.urgency)}>{lead.urgency}</Badge></td>
                  <td>{lead.assignee}</td>
                  <td>{lead.receivedAt}</td>
                  <td>{lead.lastContact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
