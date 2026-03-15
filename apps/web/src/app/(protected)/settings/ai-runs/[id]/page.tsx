import Link from 'next/link';
import { AppShell, cardStyle } from '../../../../../components/app-shell';
import { internalApiFetch } from '../../../../../lib/api/internal-api';
import { buildPrimaryNav } from '../../../../../lib/surfaces';

type RunDetail = {
  id: string;
  workflow_type: string;
  status: string;
  mode: string;
  provider?: string | null;
  model?: string | null;
  input_tokens?: number;
  output_tokens?: number;
  estimated_cost?: number;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  lead?: { id: string; fullName?: string | null; email?: string | null; status?: string | null; urgencyStatus?: string | null } | null;
};

type RunOutput = { id: string; outputType: string; content: any; createdAt: string };

export default async function AiRunDetailPage({ params }: { params: { id: string } }) {
  const [meRes, runRes, access] = await Promise.all([
    internalApiFetch<{ actor: { role: string; roleLabel?: string; email: string } }>('/api/me/permissions'),
    internalApiFetch<{ run: RunDetail; outputs: RunOutput[] }>(`/api/ai/runs/${params.id}`),
    internalApiFetch<{ workspace?: { slug?: string } }>('/api/access/me').catch(() => ({ workspace: { slug: undefined } })),
  ]);
  const navItems = buildPrimaryNav({ role: meRes.actor.role, workspaceSlug: access.workspace?.slug });
  const run = runRes.run;

  return (
    <AppShell title="AI run detail" subtitle={`${run.workflow_type} · ${run.provider || 'stub'} · ${run.model || 'draft-v1'}`} navItems={navItems}>
      <section style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div><strong>Status:</strong> {run.status}</div>
          <div><strong>Mode:</strong> {run.mode}</div>
          <div><strong>Created:</strong> {run.created_at}</div>
          <div><strong>Started:</strong> {run.started_at || '—'}</div>
          <div><strong>Completed:</strong> {run.completed_at || '—'}</div>
          <div><strong>Tokens:</strong> {run.input_tokens || 0} in / {run.output_tokens || 0} out</div>
          <div><strong>Estimated cost:</strong> {run.estimated_cost || 0}</div>
          {run.error_message ? <div style={{ color: '#991b1b' }}><strong>Error:</strong> {run.error_message}</div> : null}
          {run.lead ? (
            <div>
              <strong>Lead:</strong> <Link href={`/leads?selected=${run.lead.id}`}>{run.lead.fullName || run.lead.id}</Link>
              <span style={{ color: '#6b7280' }}> · {run.lead.email || 'no email'} · {run.lead.status || '—'} · {run.lead.urgencyStatus || '—'}</span>
            </div>
          ) : null}
        </div>
      </section>

      <section style={{ ...cardStyle }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Outputs</h2>
          <Link href="/settings">Back to settings</Link>
        </div>
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          {runRes.outputs.length === 0 ? (
            <p style={{ margin: 0, color: '#6b7280' }}>No outputs recorded for this run.</p>
          ) : runRes.outputs.map((output) => (
            <article key={output.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 700 }}>{output.outputType}</div>
              <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>{output.createdAt}</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13, color: '#374151' }}>{JSON.stringify(output.content, null, 2)}</pre>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
