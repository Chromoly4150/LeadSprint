import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/badge';

const kpis = [
  { label: 'Inbound leads (30d)', value: '128' },
  { label: 'Hot leads', value: '14' },
  { label: 'Avg first response', value: '3m 42s' },
  { label: 'SLA met', value: '94%' },
];

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard" subtitle="Lead operations overview">
      <header className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h2>Lead operations overview</h2>
          <p className="muted">Recent inbound volume, attention items, and SLA performance.</p>
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
            <li><Badge tone="hot">Hot</Badge> 6 leads awaiting first response</li>
            <li><Badge tone="sla-risk">SLA Risk</Badge> 2 leads near response deadline</li>
            <li><Badge tone="warm">Warm</Badge> 8 conversations need follow-up notes</li>
          </ul>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Performance</p>
              <h3>Recent trends</h3>
            </div>
          </div>
          <ul className="attention-list">
            <li>Inbound leads up 18% over previous 30 days</li>
            <li>First-response SLA strongest on web-form source</li>
            <li>Most conversions currently coming from FL and NC</li>
          </ul>
        </article>
      </section>
    </AppShell>
  );
}
