const kpis = [
  { label: 'Inbound leads (30d)', value: '128' },
  { label: 'Hot leads', value: '14' },
  { label: 'Avg first response', value: '3m 42s' },
  { label: 'SLA met', value: '94%' },
];

const leads = [
  {
    name: 'Taylor Brooks',
    company: 'Brooks Realty Group',
    source: 'Website Form',
    state: 'FL',
    lifecycle: 'New',
    urgency: 'Hot',
    assignee: 'Unassigned',
    lastContact: '—',
  },
  {
    name: 'Jordan Lee',
    company: 'Lee Home Lending',
    source: 'Google Form',
    state: 'NC',
    lifecycle: 'Contacted',
    urgency: 'Warm',
    assignee: 'Ava',
    lastContact: '12m ago',
  },
  {
    name: 'Morgan Patel',
    company: 'Patel Insurance',
    source: 'Webhook',
    state: 'TX',
    lifecycle: 'Qualified',
    urgency: 'Needs Attention',
    assignee: 'Noah',
    lastContact: '1h ago',
  },
];

export default function HomePage() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">LeadSprint</p>
          <h1>Workspace</h1>
        </div>
        <nav className="nav">
          <a className="active" href="#dashboard">Dashboard</a>
          <a href="#leads">Leads</a>
          <a href="#reports">Reports</a>
        </nav>
      </aside>

      <section className="content">
        <header className="page-header" id="dashboard">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h2>Lead operations overview</h2>
            <p className="muted">
              Modular-monolith MVP shell with dashboard, lead list, and hot-lead workflow framing.
            </p>
          </div>
        </header>

        <section className="kpi-grid">
          {kpis.map((item) => (
            <article key={item.label} className="card kpi-card">
              <span className="muted">{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>

        <section className="split-grid">
          <article className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Attention</p>
                <h3>Needs action</h3>
              </div>
            </div>
            <ul className="attention-list">
              <li><span className="badge hot">Hot</span> 6 leads awaiting first response</li>
              <li><span className="badge risk">SLA Risk</span> 2 leads near response deadline</li>
              <li><span className="badge warm">Warm</span> 8 conversations need follow-up notes</li>
            </ul>
          </article>

          <article className="card" id="reports">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Reports</p>
                <h3>Quick exports</h3>
              </div>
            </div>
            <ul className="attention-list">
              <li>Inbound lead performance (30d)</li>
              <li>First-response SLA report</li>
              <li>Lead status breakdown by source</li>
            </ul>
          </article>
        </section>

        <section className="card leads-panel" id="leads">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Leads</p>
              <h3>Lead list</h3>
            </div>
            <div className="toolbar">
              <span className="pill">Sort: newest received</span>
              <span className="pill">Filter: state</span>
              <span className="pill">Filter: status</span>
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
                  <th>Last contact</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.name}>
                    <td>
                      <strong>{lead.name}</strong>
                      <div className="muted">{lead.company}</div>
                    </td>
                    <td>{lead.source}</td>
                    <td>{lead.state}</td>
                    <td>{lead.lifecycle}</td>
                    <td>
                      <span className={`badge ${lead.urgency.toLowerCase().replace(/\s+/g, '-')}`}>
                        {lead.urgency}
                      </span>
                    </td>
                    <td>{lead.assignee}</td>
                    <td>{lead.lastContact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
