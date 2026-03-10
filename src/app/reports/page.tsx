import { AppShell } from '@/components/app-shell';

export default function ReportsPage() {
  return (
    <AppShell title="Reports" subtitle="Exports, print views, and reporting outputs">
      <header className="page-header">
        <div>
          <p className="eyebrow">Reports</p>
          <h2>Reporting workspace</h2>
          <p className="muted">Start with practical operational outputs before complex analytics.</p>
        </div>
      </header>

      <section className="split-grid">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Saved reports</p>
              <h3>Common exports</h3>
            </div>
          </div>
          <ul className="attention-list">
            <li>Inbound lead performance (30d)</li>
            <li>First-response SLA report</li>
            <li>Lead status breakdown by source</li>
          </ul>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Actions</p>
              <h3>Output formats</h3>
            </div>
          </div>
          <ul className="attention-list">
            <li>Export spreadsheet / CSV</li>
            <li>Print-friendly summaries</li>
            <li>Assigned-user activity snapshot</li>
          </ul>
        </article>
      </section>
    </AppShell>
  );
}
