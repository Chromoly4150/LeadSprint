import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Badge, toneForUrgency } from '@/components/badge';
import { PermissionGuard } from '@/components/permission-guard';
import { listAssignees, listLeads } from '@/lib/db';
import { createInboundLeadAction, createManualLeadAction, importLeadsCsvAction } from '@/app/leads/actions';

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; lifecycle?: string; urgency?: string; assignee?: string }>;
}) {
  const params = await searchParams;
  const leads = listLeads({
    query: params.query,
    lifecycle: params.lifecycle,
    urgency: params.urgency,
    assignee: params.assignee,
  });
  const assignees = listAssignees();

  return (
    <AppShell title="Leads" subtitle="Real lead workspace backed by SQLite + Drizzle">
      <header className="page-header">
        <div>
          <p className="eyebrow">Lead list</p>
          <h2>All leads</h2>
          <p className="muted">Review live lead status, urgency, assignee, and recent contact activity.</p>
        </div>
      </header>

      <section className="split-grid split-grid-rail-3">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Inbound MVP</p>
              <h3>Create a live inbound lead</h3>
            </div>
          </div>
          <PermissionGuard
            permission="leads.create"
            fallback={<p className="muted">Your current role cannot create inbound leads.</p>}
          >
            <form action={createInboundLeadAction} className="stack form-stack">
              <div className="field-grid">
                <label>
                  <span>Source</span>
                  <select name="source" defaultValue="Website Form">
                    <option>Website Form</option>
                    <option>Google Form</option>
                    <option>Webhook</option>
                  </select>
                </label>
                <label>
                  <span>Name</span>
                  <input name="name" placeholder="Alex Carter" required />
                </label>
              </div>
              <div className="field-grid">
                <label>
                  <span>Company</span>
                  <input name="company" placeholder="Carter Lending" />
                </label>
                <label>
                  <span>Service</span>
                  <input name="service" placeholder="Purchase loan follow-up" />
                </label>
              </div>
              <div className="field-grid">
                <label>
                  <span>Email</span>
                  <input name="email" type="email" placeholder="alex@example.com" />
                </label>
                <label>
                  <span>Phone</span>
                  <input name="phone" placeholder="(555) 000-0000" />
                </label>
              </div>
              <div className="field-grid">
                <label>
                  <span>State</span>
                  <input name="state" placeholder="FL" />
                </label>
                <label>
                  <span>Details</span>
                  <input name="details" placeholder="Needs callback this afternoon" />
                </label>
              </div>
              <button type="submit" className="button-primary">Create lead + SLA + queued first response</button>
            </form>
          </PermissionGuard>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Manual intake</p>
              <h3>Create operator-entered lead</h3>
            </div>
          </div>
          <PermissionGuard
            permission="leads.create"
            fallback={<p className="muted">Your current role cannot create manual leads.</p>}
          >
            <form action={createManualLeadAction} className="stack form-stack">
              <input type="hidden" name="source" value="Manual Intake" />
              <div className="field-grid">
                <label>
                  <span>Name</span>
                  <input name="name" placeholder="Jamie Rivera" required />
                </label>
                <label>
                  <span>Company</span>
                  <input name="company" placeholder="Rivera Insurance" />
                </label>
              </div>
              <div className="field-grid">
                <label>
                  <span>Email</span>
                  <input name="email" type="email" placeholder="jamie@example.com" />
                </label>
                <label>
                  <span>Phone</span>
                  <input name="phone" placeholder="(555) 111-2222" />
                </label>
              </div>
              <div className="field-grid">
                <label>
                  <span>Service</span>
                  <input name="service" placeholder="Referral setup" />
                </label>
                <label>
                  <span>State</span>
                  <input name="state" placeholder="NC" />
                </label>
              </div>
              <label>
                <span>Details</span>
                <textarea name="details" rows={3} placeholder="Operator notes from phone call or imported CRM context." />
              </label>
              <button type="submit" className="button-secondary">Create manual lead</button>
            </form>
          </PermissionGuard>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">CSV import</p>
              <h3>Bulk-create leads</h3>
            </div>
          </div>
          <PermissionGuard
            permission="leads.create"
            fallback={<p className="muted">Your current role cannot import leads.</p>}
          >
            <form action={importLeadsCsvAction} className="stack form-stack">
              <label>
                <span>Paste CSV</span>
                <textarea
                  name="csvText"
                  rows={10}
                  placeholder={"name,company,email,phone,state,service,details,source\nJamie Rivera,Rivera Insurance,jamie@example.com,(555) 111-2222,NC,Referral setup,Needs follow-up this afternoon,CSV Import"}
                />
              </label>
              <p className="muted small">Expected headers: name, company, email, phone, state, service, details, source. Missing name rows are skipped.</p>
              <button type="submit" className="button-secondary">Import CSV leads</button>
            </form>
          </PermissionGuard>
        </article>
      </section>

      <section className="card leads-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Operational queue</p>
            <h3>{leads.length} live leads</h3>
          </div>
          <div className="toolbar">
            <span className="pill">Sort: newest received</span>
            <span className="pill">Statuses: live</span>
            <span className="pill">Storage: SQLite</span>
          </div>
        </div>

        <form className="filter-bar" method="GET">
          <input name="query" placeholder="Search name, company, email, phone..." defaultValue={params.query ?? ''} />
          <select name="lifecycle" defaultValue={params.lifecycle ?? 'All'}>
            <option>All</option>
            <option>New</option>
            <option>Contacted</option>
            <option>In Progress</option>
            <option>Qualified</option>
            <option>Unresponsive</option>
            <option>Converted</option>
          </select>
          <select name="urgency" defaultValue={params.urgency ?? 'All'}>
            <option>All</option>
            <option>Hot</option>
            <option>Warm</option>
            <option>Needs Attention</option>
            <option>SLA Risk</option>
          </select>
          <select name="assignee" defaultValue={params.assignee ?? 'All'}>
            <option>All</option>
            <option>Unassigned</option>
            {assignees.map((user) => (
              <option key={user.id} value={user.name}>{user.name}</option>
            ))}
          </select>
          <button type="submit" className="button-secondary">Apply filters</button>
        </form>

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
                  <td>{lead.assigneeName}</td>
                  <td>{lead.receivedLabel}</td>
                  <td>{lead.lastContactLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
