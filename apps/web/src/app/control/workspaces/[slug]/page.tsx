import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell, cardStyle } from '../../../../components/app-shell';
import { internalApiFetch } from '../../../../lib/api/internal-api';
import { buildPrimaryNav, isPlatformRole } from '../../../../lib/surfaces';
import { createInvitationAction, revokeInvitationAction, switchWorkspaceAction, updateAiSettingsAction, updatePlatformWorkspaceBusinessSettingsAction, updateUserAction } from '../../../(protected)/settings/actions';

type AccessRes = {
  state: string;
  workspace?: { id: string; name: string; slug?: string; workspaceType?: string; environment?: string; surface?: string };
  user?: { role: string; roleLabel?: string; email: string };
};

type UserRow = { id: string; fullName: string; email: string; role: string; roleLabel?: string; status?: string };
type InvitationRow = { id: string; email: string; role: string; status: string; created_at: string };
type BusinessSettings = { businessName?: string; timezone?: string; bookingLink?: string; lineOfBusiness?: string; requestKind?: string; onboardingNotes?: string };
type AiSettings = { ai_enabled: number; default_mode: string; usage_plan: string; monthly_message_limit: number; monthly_ai_token_budget: number; response_sla_target_minutes: number; allowed_channels?: string[]; allowed_actions?: string[]; tone_profile?: { defaultTone?: string }; business_context?: { businessName?: string; bookingLink?: string }; compliance_policy?: { autoGenerateFirstResponseOnLeadCreate?: boolean; requireHumanApprovalForOutbound?: boolean }; model_policy?: { primaryProvider?: string; primaryModel?: string; allowedModels?: string[] } };
type Summary = { totalLeads: number; newLeads: number; contactedLeads: number; bookedLeads: number; hotLeads: number; needsAttentionLeads: number; conversionRate: number; recentInbound30d: number };

type WorkspaceCandidate = { id: string; name: string; slug?: string; workspace_type?: string; environment?: string; created_at?: string };

function statusBadge(status?: string) {
  const normalized = status || 'active';
  const styles: Record<string, React.CSSProperties> = {
    active: { background: '#dcfce7', color: '#166534' },
    deactivated: { background: '#e5e7eb', color: '#374151' },
    suspended: { background: '#fee2e2', color: '#991b1b' },
    pending: { background: '#fef3c7', color: '#92400e' },
  };
  return <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600, ...(styles[normalized] || styles.active) }}>{normalized.replaceAll('_', ' ')}</span>;
}

export default async function ControlWorkspacePage({ params }: { params: { slug: string } }) {
  const access = await internalApiFetch<AccessRes>('/api/access/me');
  if (!access.user?.role || !isPlatformRole(access.user.role)) redirect('/dashboard');

  const targetSlug = params.slug;
  const workspaceRes = await internalApiFetch<{
    workspace: { id: string; name: string; slug?: string; workspaceType?: string; environment?: string; timezone?: string };
    users: UserRow[];
    invitations: InvitationRow[];
    settings: { business: BusinessSettings; businessUpdatedAt?: string | null; ai: AiSettings; aiUpdatedAt?: string | null };
    summary: Summary;
    leads: Array<{ id: string; fullName: string; source: string; status: string; urgencyStatus: string }>;
    activity: {
      aiRuns: Array<{ id: string; workflowType: string; status: string; mode: string; provider?: string | null; model?: string | null; leadId?: string | null; createdAt: string; completedAt?: string | null; errorMessage?: string | null }>;
      communications: Array<{ id: string; leadId?: string | null; leadFullName?: string | null; channel: string; direction: string; actorType: string; actorName: string; subject?: string | null; summary: string; occurredAt: string }>;
      events: Array<{ id: string; leadId?: string | null; leadFullName?: string | null; eventType: string; payload?: unknown; createdAt: string }>;
    };
  }>(`/api/platform/workspaces/${encodeURIComponent(targetSlug)}/summary`).catch(async (): Promise<{
    workspace: { id: string; name: string; slug?: string; workspaceType?: string; environment?: string; timezone?: string };
    users: UserRow[];
    invitations: InvitationRow[];
    settings: { business: BusinessSettings; businessUpdatedAt?: string | null; ai: AiSettings; aiUpdatedAt?: string | null };
    summary: Summary;
    leads: Array<{ id: string; fullName: string; source: string; status: string; urgencyStatus: string }>;
    activity: {
      aiRuns: Array<{ id: string; workflowType: string; status: string; mode: string; provider?: string | null; model?: string | null; leadId?: string | null; createdAt: string; completedAt?: string | null; errorMessage?: string | null }>;
      communications: Array<{ id: string; leadId?: string | null; leadFullName?: string | null; channel: string; direction: string; actorType: string; actorName: string; subject?: string | null; summary: string; occurredAt: string }>;
      events: Array<{ id: string; leadId?: string | null; leadFullName?: string | null; eventType: string; payload?: unknown; createdAt: string }>;
    };
  }> => {
    const directory = await internalApiFetch<{ organizations: WorkspaceCandidate[] }>(`/api/platform/directory?q=${encodeURIComponent(targetSlug)}&limit=100`);
    const candidate = directory.organizations.find((org) => org.slug === targetSlug);
    if (!candidate) throw new Error('Workspace not found');
    return {
      workspace: { id: candidate.id, name: candidate.name, slug: candidate.slug || targetSlug, workspaceType: candidate.workspace_type, environment: candidate.environment || 'customer' },
      users: [],
      invitations: [],
      settings: { business: {}, ai: { ai_enabled: 0, default_mode: 'draft_only', usage_plan: 'standard', monthly_message_limit: 0, monthly_ai_token_budget: 0, response_sla_target_minutes: 5 } },
      summary: { totalLeads: 0, newLeads: 0, contactedLeads: 0, bookedLeads: 0, hotLeads: 0, needsAttentionLeads: 0, conversionRate: 0, recentInbound30d: 0 },
      leads: [],
      activity: { aiRuns: [], communications: [], events: [] },
    };
  });

  const activeWorkspace = workspaceRes.workspace;
  const navItems = buildPrimaryNav({ role: access.user.role, workspaceSlug: access.workspace?.slug || activeWorkspace.slug });
  const companyUsers = workspaceRes.users.filter((user) => !user.role.startsWith('platform_'));
  const returnTo = `/control/workspaces/${activeWorkspace.slug}`;

  return (
    <AppShell title={activeWorkspace.name} subtitle={`Tenant control view · ${activeWorkspace.workspaceType} · ${activeWorkspace.environment || 'customer'} · slug ${activeWorkspace.slug}`} navItems={navItems}>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          ['Inbound (30d)', workspaceRes.summary.recentInbound30d],
          ['Hot leads', workspaceRes.summary.hotLeads],
          ['Needs attention', workspaceRes.summary.needsAttentionLeads],
          ['Conversion rate', `${workspaceRes.summary.conversionRate}%`],
        ].map(([label, value]) => (
          <article key={String(label)} style={cardStyle}><div style={{ color: '#6b7280', fontSize: 12 }}>{label}</div><div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{value}</div></article>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 16, marginBottom: 16 }}>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Workspace profile</h2>
          <form action={updatePlatformWorkspaceBusinessSettingsAction} style={{ display: 'grid', gap: 8, color: '#374151', fontSize: 14 }}>
            <input type="hidden" name="workspaceSlug" value={activeWorkspace.slug} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <label style={{ display: 'grid', gap: 4 }}><strong>Business name</strong><input name="businessName" defaultValue={workspaceRes.settings.business.businessName || activeWorkspace.name} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db' }} /></label>
            <label style={{ display: 'grid', gap: 4 }}><strong>Timezone</strong><input name="timezone" defaultValue={workspaceRes.settings.business.timezone || activeWorkspace.timezone || 'America/New_York'} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db' }} /></label>
            <label style={{ display: 'grid', gap: 4 }}><strong>Line of business</strong><input name="lineOfBusiness" defaultValue={workspaceRes.settings.business.lineOfBusiness || ''} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db' }} /></label>
            <label style={{ display: 'grid', gap: 4 }}><strong>Request kind</strong><input name="requestKind" defaultValue={workspaceRes.settings.business.requestKind || activeWorkspace.workspaceType || ''} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db' }} /></label>
            <label style={{ display: 'grid', gap: 4 }}><strong>Booking link</strong><input name="bookingLink" defaultValue={workspaceRes.settings.business.bookingLink || ''} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db' }} /></label>
            <label style={{ display: 'grid', gap: 4 }}><strong>Notes</strong><textarea name="onboardingNotes" defaultValue={workspaceRes.settings.business.onboardingNotes || ''} rows={4} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db', resize: 'vertical' }} /></label>
            <div><button type="submit">Save workspace profile</button></div>
          </form>
        </article>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>AI policy</h2>
          <form action={updateAiSettingsAction} style={{ display: 'grid', gap: 8, color: '#374151', fontSize: 14 }}>
            <input type="hidden" name="workspaceSlug" value={activeWorkspace.slug} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <label><input type="checkbox" name="aiEnabled" defaultChecked={Boolean(workspaceRes.settings.ai.ai_enabled)} /> Enable AI</label>
            <label style={{ display: 'grid', gap: 4 }}><strong>Mode</strong>
              <select name="defaultMode" defaultValue={workspaceRes.settings.ai.default_mode} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db' }}>
                <option value="draft_only">Draft only</option>
                <option value="approval_required">Approval required</option>
                <option value="guarded_autopilot">Guarded autopilot</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}><strong>Usage plan</strong><input name="usagePlan" defaultValue={workspaceRes.settings.ai.usage_plan} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db' }} /></label>
            <label style={{ display: 'grid', gap: 4 }}><strong>SLA target (minutes)</strong><input type="number" name="responseSlaTargetMinutes" defaultValue={workspaceRes.settings.ai.response_sla_target_minutes} min={1} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db' }} /></label>
            <label style={{ display: 'grid', gap: 4 }}><strong>Monthly message limit</strong><input type="number" name="monthlyMessageLimit" defaultValue={workspaceRes.settings.ai.monthly_message_limit} min={1} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db' }} /></label>
            <label style={{ display: 'grid', gap: 4 }}><strong>Monthly AI token budget</strong><input type="number" name="monthlyAiTokenBudget" defaultValue={workspaceRes.settings.ai.monthly_ai_token_budget} min={1000} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db' }} /></label>
            <label style={{ display: 'grid', gap: 4 }}><strong>Primary provider</strong><input name="primaryProvider" defaultValue={workspaceRes.settings.ai.model_policy?.primaryProvider || 'stub'} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db' }} /></label>
            <label style={{ display: 'grid', gap: 4 }}><strong>Primary model</strong><input name="primaryModel" defaultValue={workspaceRes.settings.ai.model_policy?.primaryModel || 'stub/draft-v1'} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db' }} /></label>
            <label style={{ display: 'grid', gap: 4 }}><strong>Default tone</strong><input name="defaultTone" defaultValue={workspaceRes.settings.ai.tone_profile?.defaultTone || 'professional and warm'} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db' }} /></label>
            <label style={{ display: 'grid', gap: 4 }}><strong>Business name in AI context</strong><input name="businessName" defaultValue={workspaceRes.settings.ai.business_context?.businessName || workspaceRes.settings.business.businessName || activeWorkspace.name} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db' }} /></label>
            <label style={{ display: 'grid', gap: 4 }}><strong>Booking link in AI context</strong><input name="bookingLink" defaultValue={workspaceRes.settings.ai.business_context?.bookingLink || workspaceRes.settings.business.bookingLink || ''} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db' }} /></label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <label><input type="checkbox" name="allowedChannels" value="email" defaultChecked={(workspaceRes.settings.ai.allowed_channels || []).includes('email')} /> Email</label>
              <label><input type="checkbox" name="allowedChannels" value="sms" defaultChecked={(workspaceRes.settings.ai.allowed_channels || []).includes('sms')} /> SMS</label>
              <label><input type="checkbox" name="allowedActions" value="draft_message" defaultChecked={(workspaceRes.settings.ai.allowed_actions || []).includes('draft_message')} /> Draft message</label>
              <label><input type="checkbox" name="autoGenerateFirstResponseOnLeadCreate" defaultChecked={Boolean(workspaceRes.settings.ai.compliance_policy?.autoGenerateFirstResponseOnLeadCreate)} /> Auto-generate first response</label>
            </div>
            <div><button type="submit">Save AI policy</button></div>
          </form>
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <article style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h2 style={{ marginTop: 0, marginBottom: 0 }}>Members</h2>
            <Link href="/settings">Open settings</Link>
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {companyUsers.length === 0 ? <div style={{ color: '#6b7280' }}>No company users yet.</div> : companyUsers.map((user) => (
              <div key={user.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{user.fullName}</div>
                    <div style={{ color: '#6b7280', fontSize: 13 }}>{user.email}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>{user.roleLabel || user.role}</div>
                  </div>
                  {statusBadge(user.status)}
                </div>
                <form action={updateUserAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="workspaceSlug" value={activeWorkspace.slug} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <input name="fullName" defaultValue={user.fullName} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db', minWidth: 160 }} />
                  <select name="role" defaultValue={user.role} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db' }}>
                    <option value="company_agent">Agent</option>
                    <option value="company_admin">Admin</option>
                    <option value="company_owner">Company Owner</option>
                  </select>
                  <select name="status" defaultValue={user.status || 'active'} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db' }}>
                    <option value="active">Active</option>
                    <option value="deactivated">Deactivated</option>
                    <option value="suspended">Suspended</option>
                  </select>
                  <button type="submit">Save</button>
                </form>
              </div>
            ))}
          </div>
        </article>

        <article style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h2 style={{ marginTop: 0, marginBottom: 0 }}>Invitations</h2>
            <span style={{ color: '#6b7280', fontSize: 12 }}>{workspaceRes.invitations.length} total</span>
          </div>
          {activeWorkspace.workspaceType === 'business_verified' ? (
            <form action={createInvitationAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, marginBottom: 12 }}>
              <input type="hidden" name="organizationId" value={activeWorkspace.id} />
              <input type="hidden" name="workspaceSlug" value={activeWorkspace.slug} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <input name="email" placeholder="invite@example.com" style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db', minWidth: 220 }} />
              <select name="role" defaultValue="company_agent" style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db' }}>
                <option value="company_agent">Agent</option>
                <option value="company_admin">Admin</option>
              </select>
              <button type="submit">Send invite</button>
            </form>
          ) : null}
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {workspaceRes.invitations.length === 0 ? <div style={{ color: '#6b7280' }}>No invitations for this workspace.</div> : workspaceRes.invitations.map((invitation) => (
              <div key={invitation.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                <div style={{ fontWeight: 700 }}>{invitation.email}</div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>{invitation.role} · {invitation.status}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{invitation.created_at}</div>
                {invitation.status === 'pending' ? (
                  <form action={revokeInvitationAction}>
                    <input type="hidden" name="invitationId" value={invitation.id} />
                    <input type="hidden" name="workspaceSlug" value={activeWorkspace.slug} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button type="submit">Revoke</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section style={{ ...cardStyle, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>Recent leads</h2>
          <Link href="/leads">Open leads</Link>
        </div>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {workspaceRes.leads.length === 0 ? <div style={{ color: '#6b7280' }}>No leads in this workspace yet.</div> : workspaceRes.leads.map((lead) => (
            <div key={lead.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
              <div style={{ fontWeight: 700 }}>{lead.fullName}</div>
              <div style={{ color: '#6b7280', fontSize: 13 }}>{lead.source} · {lead.status} · {lead.urgencyStatus}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Recent AI runs</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {workspaceRes.activity.aiRuns.length === 0 ? <div style={{ color: '#6b7280' }}>No AI runs yet.</div> : workspaceRes.activity.aiRuns.map((run) => (
              <div key={run.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                <div style={{ fontWeight: 700 }}>{run.workflowType}</div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>{run.status} · {run.mode}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{run.model || run.provider || 'Unknown model'} · {run.createdAt}</div>
                {run.errorMessage ? <div style={{ color: '#991b1b', fontSize: 12, marginTop: 4 }}>{run.errorMessage}</div> : null}
              </div>
            ))}
          </div>
        </article>

        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Recent communications</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {workspaceRes.activity.communications.length === 0 ? <div style={{ color: '#6b7280' }}>No communications yet.</div> : workspaceRes.activity.communications.map((item) => (
              <div key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                <div style={{ fontWeight: 700 }}>{item.subject || item.summary || `${item.channel} communication`}</div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>{item.channel} · {item.direction} · {item.actorName}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{item.leadFullName || 'Unknown lead'} · {item.occurredAt}</div>
              </div>
            ))}
          </div>
        </article>

        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Recent events</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {workspaceRes.activity.events.length === 0 ? <div style={{ color: '#6b7280' }}>No events yet.</div> : workspaceRes.activity.events.map((event) => (
              <div key={event.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                <div style={{ fontWeight: 700 }}>{event.eventType}</div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>{event.leadFullName || 'Unknown lead'}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{event.createdAt}</div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
