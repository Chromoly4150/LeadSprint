import { AppShell, cardStyle } from '../../../components/app-shell';
import { apiFetch } from '../../../lib/api';

export default async function ReportsPage() {
  const [summaryRes, reportRes] = await Promise.all([
    apiFetch<{ summary: { totalLeads: number; hotLeads: number; bookedLeads: number; conversionRate: number } }>('/api/dashboard/summary'),
    apiFetch<{ rows: Array<{ status: string; urgencyStatus: string; count: number }> }>('/api/reports/status-summary'),
  ]);

  return (
    <AppShell title="Reports" subtitle="Route extracted from the monolithic MVP screen">
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Status / urgency summary</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={{ textAlign: 'left', paddingBottom: 8 }}>Lifecycle</th><th style={{ textAlign: 'left', paddingBottom: 8 }}>Urgency</th><th style={{ textAlign: 'left', paddingBottom: 8 }}>Count</th></tr>
            </thead>
            <tbody>
              {reportRes.rows.map((row, idx) => (
                <tr key={`${row.status}-${row.urgencyStatus}-${idx}`}>
                  <td style={{ padding: '6px 0' }}>{row.status}</td>
                  <td style={{ padding: '6px 0' }}>{row.urgencyStatus}</td>
                  <td style={{ padding: '6px 0' }}>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Export-ready snapshot</h2>
          <ul>
            <li>Total leads: {summaryRes.summary.totalLeads}</li>
            <li>Hot leads: {summaryRes.summary.hotLeads}</li>
            <li>Booked leads: {summaryRes.summary.bookedLeads}</li>
            <li>Conversion rate: {summaryRes.summary.conversionRate}%</li>
          </ul>
        </article>
      </section>
    </AppShell>
  );
}
