import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Badge, toneForUrgency } from '@/components/badge';
import { PermissionGuard } from '@/components/permission-guard';
import { getLeadDetail, listAssignees, queuedOutboundJobs } from '@/lib/db';
import {
  addLeadNoteAction,
  logManualContactAction,
  markOutboundFailedAction,
  markOutboundSentAction,
  updateAssignmentAction,
  updateLifecycleAction,
} from '@/app/leads/actions';

const lifecycleOptions = ['New', 'Contacted', 'In Progress', 'Qualified', 'Unresponsive', 'Converted'];
const channelOptions = ['Call', 'SMS', 'Email', 'Chat'];

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = getLeadDetail(id);
  const assignees = listAssignees();

  if (!lead) notFound();

  const outboundQueue = queuedOutboundJobs().filter((job) => job.leadId === lead.id);

  return (
    <AppShell title="Lead detail" subtitle={`${lead.name} · ${lead.company}`}>
      <header className="page-header">
        <div>
          <p className="eyebrow">Lead workspace</p>
          <h2>{lead.name}</h2>
          <p className="muted">{lead.company} · {lead.service}</p>
        </div>
        <div className="toolbar">
          <Badge>{lead.lifecycle}</Badge>
          <Badge tone={toneForUrgency(lead.urgency)}>{lead.urgency}</Badge>
          <span className="pill">Assigned: {lead.assigneeName}</span>
          <span className="pill">Received: {lead.receivedLabel}</span>
        </div>
      </header>

      <section className="detail-grid">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Overview</p>
              <h3>Lead details</h3>
            </div>
          </div>
          <dl className="meta-grid">
            <div><dt>Email</dt><dd>{lead.email}</dd></div>
            <div><dt>Phone</dt><dd>{lead.phone}</dd></div>
            <div><dt>Source</dt><dd>{lead.source}</dd></div>
            <div><dt>State</dt><dd>{lead.state}</dd></div>
            <div><dt>Received</dt><dd>{lead.receivedLabel}</dd></div>
            <div><dt>Last contact</dt><dd>{lead.lastContactLabel}</dd></div>
            <div><dt>Last activity</dt><dd>{lead.lastActivityLabel}</dd></div>
            <div><dt>First response due</dt><dd>{lead.firstResponseDueAt ? new Date(lead.firstResponseDueAt).toLocaleString() : '—'}</dd></div>
          </dl>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Operations</p>
              <h3>Work the lead</h3>
            </div>
          </div>
          <div className="stack form-stack compact-forms">
            <PermissionGuard permission="leads.assign" fallback={<p className="muted">Your role cannot assign leads.</p>}>
              <form action={updateAssignmentAction} className="inline-form">
                <input type="hidden" name="leadId" value={lead.id} />
                <label>
                  <span>Assignee</span>
                  <select name="assigneeUserId" defaultValue={lead.assigneeUserId ?? ''}>
                    <option value="">Unassigned</option>
                    {assignees.map((user) => (
                      <option key={user.id} value={user.id}>{user.name} · {user.role}</option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="button-secondary">Save assignment</button>
              </form>
            </PermissionGuard>

            <PermissionGuard permission="leads.edit" fallback={<p className="muted">Your role cannot change lifecycle state.</p>}>
              <form action={updateLifecycleAction} className="inline-form">
                <input type="hidden" name="leadId" value={lead.id} />
                <label>
                  <span>Lifecycle</span>
                  <select name="lifecycle" defaultValue={lead.lifecycle}>
                    {lifecycleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <button type="submit" className="button-secondary">Update lifecycle</button>
              </form>
            </PermissionGuard>

            <PermissionGuard permission="notes.create_internal" fallback={<p className="muted">Your role cannot write internal notes.</p>}>
              <form action={addLeadNoteAction} className="stack">
                <input type="hidden" name="leadId" value={lead.id} />
                <label>
                  <span>Internal note</span>
                  <textarea name="content" rows={4} placeholder="Add internal context, call prep, or handoff notes." />
                </label>
                <button type="submit" className="button-secondary">Add note</button>
              </form>
            </PermissionGuard>

            <PermissionGuard permission="messaging.send_other" fallback={<p className="muted">Your role cannot log outbound contact actions.</p>}>
              <form action={logManualContactAction} className="stack">
                <input type="hidden" name="leadId" value={lead.id} />
                <div className="field-grid">
                  <label>
                    <span>Channel</span>
                    <select name="channel" defaultValue="Call">
                      {channelOptions.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Summary</span>
                    <input name="summary" placeholder="Left voicemail and texted callback window." />
                  </label>
                </div>
                <label>
                  <span>Detail</span>
                  <textarea name="content" rows={4} placeholder="What happened, what the lead asked for, and next step." />
                </label>
                <button type="submit" className="button-primary">Log manual contact</button>
              </form>
            </PermissionGuard>
          </div>
        </article>
      </section>

      <section className="detail-grid detail-grid-wide">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Communication log</p>
              <h3>Full timestamped history</h3>
            </div>
          </div>
          <div className="stack">
            {lead.communications.map((item) => (
              <div key={item.id} className="timeline-item">
                <div className="timeline-topline">
                  <div className="toolbar">
                    <Badge>{item.channel}</Badge>
                    <Badge>{item.direction}</Badge>
                  </div>
                  <span className="muted">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                <strong>{item.actorName}</strong>
                {item.subject ? <div className="muted">Subject: {item.subject}</div> : null}
                <p><strong>Summary:</strong> {item.summary}</p>
                <p className="muted">{item.content}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Unified timeline</p>
              <h3>Activity + notes + communication</h3>
            </div>
          </div>
          <div className="stack">
            {lead.timeline.map((item, index) => (
              <div key={`${item.kind}-${index}-${item.createdAt}`} className="timeline-item">
                <div className="timeline-topline">
                  <strong>{item.title}</strong>
                  <span className="muted">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                <div className="muted smallcaps">{item.kind} · {item.subtitle}</div>
                <p className="muted">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="detail-actions">
            <Link href="/leads" className="pill">Back to leads</Link>
          </div>
        </article>
      </section>

      <section className="split-grid">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Internal notes</p>
              <h3>Org-only context</h3>
            </div>
          </div>
          <div className="stack">
            {lead.notes.map((note) => (
              <div key={note.id} className="note-card">
                <div className="note-header">
                  <strong>{note.authorName}</strong>
                  <span className="muted">{new Date(note.createdAt).toLocaleString()}</span>
                </div>
                <div className="muted smallcaps">{note.type.replace('_', ' ')}</div>
                <p>{note.content}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Dispatch queue</p>
              <h3>Queued outbound jobs</h3>
            </div>
          </div>
          <div className="stack">
            {outboundQueue.length ? outboundQueue.map((job) => (
              <div key={job.id} className="note-card">
                <div className="note-header">
                  <strong>{job.channel} · {job.provider}</strong>
                  <span className="muted">{new Date(job.createdAt).toLocaleString()}</span>
                </div>
                <div className="muted smallcaps">status · {job.status}</div>
                <p><strong>To:</strong> {job.toAddress}</p>
                {job.subject ? <p><strong>Subject:</strong> {job.subject}</p> : null}
                <p className="muted">{job.body}</p>
                <PermissionGuard permission="conversations.takeover" fallback={<p className="muted">Your role cannot operate the dispatch queue.</p>}>
                  <div className="toolbar">
                    <form action={markOutboundSentAction}>
                      <input type="hidden" name="jobId" value={job.id} />
                      <input type="hidden" name="leadId" value={lead.id} />
                      <button type="submit" className="button-primary">Mark sent</button>
                    </form>
                    <form action={markOutboundFailedAction} className="inline-form fail-inline">
                      <input type="hidden" name="jobId" value={job.id} />
                      <input type="hidden" name="leadId" value={lead.id} />
                      <input name="reason" placeholder="Failure reason / manual follow-up note" />
                      <button type="submit" className="button-secondary">Mark failed</button>
                    </form>
                  </div>
                </PermissionGuard>
              </div>
            )) : <p className="muted">No queued outbound jobs for this lead.</p>}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
