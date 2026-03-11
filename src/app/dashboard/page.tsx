import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/badge';
import { dashboardMetrics, listLeads, queuedOutboundJobs, recentInboundEvents } from '@/lib/db';

export default function DashboardPage() {
  const metrics = dashboardMetrics();
  const leads = listLeads().slice(0, 5);
  const inbound = recentInboundEvents().slice(0, 5);
  const jobs = queuedOutboundJobs().slice(0, 5);

  const kpis = [
    { label: 'Inbound leads', value: String(metrics.total) },
    { label: 'Hot / SLA risk', value: String(metrics.hot) },
    { label: 'Needs action', value: String(metrics.needsAction) },
    { label: 'Avg first response (min)', value: String(metrics.avgResponseMinutes) },
  ];

  return (
    <AppShell title="Dashboard" subtitle="Operational snapshot from the live data layer">
      <header className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h2>Lead operations overview</h2>
          <p className="muted">Recent inbound volume, attention items, queued responses, and lead activity.</p>
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
            <li><Badge tone="hot">Hot</Badge> {metrics.hot} leads are hot or near SLA pressure</li>
            <li><Badge tone="sla-risk">Queue</Badge> {jobs.length} outbound first-response jobs are currently queued</li>
            <li><Badge tone="warm">Active</Badge> {metrics.needsAction} leads still need active handling</li>
          </ul>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recent leads</p>
              <h3>Fresh activity</h3>
            </div>
          </div>
          <ul className="attention-list">
            {leads.map((lead) => (
              <li key={lead.id}>
                <Link href={`/leads/${lead.id}`} className="lead-link"><strong>{lead.name}</strong></Link>
                <span className="muted"> · {lead.source} · {lead.receivedLabel}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="split-grid">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Inbound events</p>
              <h3>Latest normalized submissions</h3>
            </div>
          </div>
          <ul className="attention-list">
            {inbound.map((event) => (
              <li key={event.id}>
                <strong>{event.source}</strong>
                <span className="muted"> · {event.status} · {new Date(event.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Outbound jobs</p>
              <h3>Queued first responses</h3>
            </div>
          </div>
          <ul className="attention-list">
            {jobs.length ? jobs.map((job) => (
              <li key={job.id}>
                <Link href={`/leads/${job.leadId}`} className="lead-link"><strong>{job.channel}</strong></Link>
                <span className="muted"> · {job.provider} · {job.toAddress}</span>
              </li>
            )) : <li className="muted">No queued jobs.</li>}
          </ul>
        </article>
      </section>
    </AppShell>
  );
}
