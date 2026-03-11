import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { PermissionGuard } from '@/components/permission-guard';
import { reportSummary, queuedOutboundJobs, recentInboundEvents } from '@/lib/db';

export default function ReportsPage() {
  const report = reportSummary();
  const inbound = recentInboundEvents().slice(0, 8);
  const queued = queuedOutboundJobs().slice(0, 8);

  return (
    <AppShell title="Reports" subtitle="Operational outputs from the live lead database">
      <header className="page-header">
        <div>
          <p className="eyebrow">Reports</p>
          <h2>Reporting workspace</h2>
          <p className="muted">Start with exportable operational truth before more advanced analytics.</p>
        </div>
        <div className="toolbar">
          <PermissionGuard permission="exports.run" fallback={<span className="pill">CSV export requires higher permission</span>}>
            <a href="/api/reports/leads" className="button-primary">Download leads CSV</a>
          </PermissionGuard>
          <Link href="/leads" className="button-secondary">Open lead workspace</Link>
        </div>
      </header>

      <section className="kpi-grid">
        <article className="card kpi-card">
          <span className="muted">Total leads</span>
          <strong>{report.totals.total}</strong>
        </article>
        <article className="card kpi-card">
          <span className="muted">Hot / SLA pressure</span>
          <strong>{report.totals.hot}</strong>
        </article>
        <article className="card kpi-card">
          <span className="muted">Unassigned</span>
          <strong>{report.totals.unassigned}</strong>
        </article>
        <article className="card kpi-card">
          <span className="muted">With contact logged</span>
          <strong>{report.totals.withContact}</strong>
        </article>
      </section>

      <section className="split-grid">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Breakdown</p>
              <h3>Leads by source</h3>
            </div>
          </div>
          <ul className="attention-list">
            {report.bySource.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong>
                <span className="muted"> · {item.count}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Pipeline</p>
              <h3>Leads by lifecycle</h3>
            </div>
          </div>
          <ul className="attention-list">
            {report.byLifecycle.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong>
                <span className="muted"> · {item.count}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="split-grid">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Ownership</p>
              <h3>Lead load by assignee</h3>
            </div>
          </div>
          <ul className="attention-list">
            {report.byAssignee.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong>
                <span className="muted"> · {item.count}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Exports</p>
              <h3>Operational outputs</h3>
            </div>
          </div>
          <ul className="attention-list">
            <li>CSV export of the full lead table</li>
            <li>Recent inbound event activity</li>
            <li>Queued first-response job visibility</li>
            <li>Fast foundation for printable or scheduled reports</li>
          </ul>
        </article>
      </section>

      <section className="split-grid">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recent inbound</p>
              <h3>Latest intake events</h3>
            </div>
          </div>
          <ul className="attention-list">
            {inbound.length ? inbound.map((event) => (
              <li key={event.id}>
                <strong>{event.source}</strong>
                <span className="muted"> · {event.status} · {new Date(event.createdAt).toLocaleString()}</span>
              </li>
            )) : <li className="muted">No inbound events yet.</li>}
          </ul>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Queued outbound</p>
              <h3>First-response jobs</h3>
            </div>
          </div>
          <ul className="attention-list">
            {queued.length ? queued.map((job) => (
              <li key={job.id}>
                <strong>{job.channel}</strong>
                <span className="muted"> · {job.toAddress} · {job.status}</span>
              </li>
            )) : <li className="muted">No queued jobs.</li>}
          </ul>
        </article>
      </section>
    </AppShell>
  );
}
