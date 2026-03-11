'use client';

import { useEffect, useMemo, useState } from 'react';

type LeadStatus = 'new' | 'contacted' | 'booked' | 'closed';
type UrgencyStatus = 'hot' | 'warm' | 'cold' | 'needs_attention' | 'sla_risk';
type ViewTab = 'dashboard' | 'leads' | 'automation' | 'reports' | 'settings';

type Lead = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  source: string;
  message: string | null;
  status: LeadStatus;
  urgencyStatus: UrgencyStatus;
  receivedAt: string;
  updatedAt: string;
  lastContactedAt: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  ownerUserId: string | null;
  ownerUserName: string | null;
};

type LeadEvent = {
  id: string;
  eventType: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

type LeadNote = {
  id: string;
  content: string;
  noteType: string;
  authorName: string;
  createdAt: string;
};

type Communication = {
  id: string;
  channel: 'email' | 'sms' | 'call' | 'chat';
  direction: 'inbound' | 'outbound';
  actorType: string;
  actorName: string;
  subject: string | null;
  summary: string;
  content: string;
  occurredAt: string;
};

type EmailDraft = {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  status: string;
  source: string;
  createdAt: string;
  createdByName: string;
};

type EmailOutboxItem = {
  id: string;
  emailDraftId: string | null;
  toEmail: string;
  subject: string;
  body: string;
  providerKey: string;
  sendStatus: string;
  queuedAt: string;
  sentAt: string | null;
  failedAt: string | null;
  lastError: string | null;
  createdAt: string;
  createdByName: string;
};

type Template = { id: string; body: string; isEnabled: boolean; updatedAt: string };
type TemplateVersion = { id: string; body: string; changedAt: string };
type BusinessSettings = {
  businessName: string;
  timezone: string;
  bookingLink: string;
  hours: Record<string, string>;
};

type DashboardSummary = {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  bookedLeads: number;
  closedLeads: number;
  hotLeads: number;
  needsAttentionLeads: number;
  conversionRate: number;
  recentInbound30d: number;
};

type ReportRow = {
  status: string;
  urgencyStatus: string;
  count: number;
};

type TeamUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status?: string;
};

type EmailProviderSetting = {
  key: string;
  label: string;
  needsAuth: boolean;
  status: string;
  config: Record<string, string>;
  updatedAt: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000';
const statusOrder: LeadStatus[] = ['new', 'contacted', 'booked', 'closed'];
const urgencyOrder: UrgencyStatus[] = ['hot', 'warm', 'cold', 'needs_attention', 'sla_risk'];
const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

const card: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };
const input: React.CSSProperties = { padding: 8, borderRadius: 8, border: '1px solid #d1d5db' };
const chip = (active: boolean): React.CSSProperties => ({ ...input, border: 0, background: active ? '#111827' : '#e5e7eb', color: active ? '#fff' : '#111827' });

function formatWhen(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function urgencyColor(status: string) {
  switch (status) {
    case 'hot': return '#dc2626';
    case 'warm': return '#d97706';
    case 'cold': return '#2563eb';
    case 'needs_attention': return '#7c3aed';
    case 'sla_risk': return '#be123c';
    default: return '#4b5563';
  }
}

export default function HomePage() {
  const [tab, setTab] = useState<ViewTab>('dashboard');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | LeadStatus>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | UrgencyStatus>('all');
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [emailDrafts, setEmailDrafts] = useState<EmailDraft[]>([]);
  const [emailOutbox, setEmailOutbox] = useState<EmailOutboxItem[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteType, setNoteType] = useState<'general' | 'call_note' | 'follow_up' | 'internal_comment'>('general');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'agent'>('agent');
  const [emailProviders, setEmailProviders] = useState<EmailProviderSetting[]>([]);

  const [template, setTemplate] = useState<Template | null>(null);
  const [templateBodyDraft, setTemplateBodyDraft] = useState('');
  const [templateEnabledDraft, setTemplateEnabledDraft] = useState(true);
  const [templateVersions, setTemplateVersions] = useState<TemplateVersion[]>([]);

  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [previewName, setPreviewName] = useState('Prospect');
  const [previewText, setPreviewText] = useState('');

  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadMessage, setNewLeadMessage] = useState('');
  const [newLeadUrgency, setNewLeadUrgency] = useState<UrgencyStatus>('warm');

  const [contactNote, setContactNote] = useState('Left intro email, awaiting reply.');
  const [contactChannel, setContactChannel] = useState<'email' | 'sms' | 'call'>('email');
  const [communicationDirection, setCommunicationDirection] = useState<'inbound' | 'outbound'>('outbound');
  const [communicationSubject, setCommunicationSubject] = useState('');
  const [communicationSummary, setCommunicationSummary] = useState('');
  const [communicationContent, setCommunicationContent] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const filteredLeads = useMemo(() => leads.filter((l) => {
    const statusOk = statusFilter === 'all' || l.status === statusFilter;
    const urgencyOk = urgencyFilter === 'all' || l.urgencyStatus === urgencyFilter;
    return statusOk && urgencyOk;
  }), [leads, statusFilter, urgencyFilter]);

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedId) || filteredLeads[0] || leads[0] || null,
    [leads, filteredLeads, selectedId]
  );

  const [editLead, setEditLead] = useState({ fullName: '', email: '', phone: '', source: '', message: '', urgencyStatus: 'warm' as UrgencyStatus, assignedUserId: '', ownerUserId: '' });

  async function fetchLeads() {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (urgencyFilter !== 'all') params.set('urgency', urgencyFilter);
    const query = params.toString();
    const res = await fetch(`${API_BASE}/api/leads${query ? `?${query}` : ''}`);
    const json = await res.json();
    const next = (json.leads || []) as Lead[];
    setLeads(next);
    if (!selectedId && next[0]) setSelectedId(next[0].id);
  }

  async function fetchLeadEvents(leadId: string) {
    const res = await fetch(`${API_BASE}/api/leads/${leadId}/events`);
    const json = await res.json();
    setEvents((json.events || []) as LeadEvent[]);
  }

  async function fetchLeadNotes(leadId: string) {
    const res = await fetch(`${API_BASE}/api/leads/${leadId}/notes`, { headers: { 'x-user-email': 'owner@leadsprint.local' } });
    const json = await res.json();
    setNotes((json.notes || []) as LeadNote[]);
  }

  async function fetchLeadCommunications(leadId: string) {
    const res = await fetch(`${API_BASE}/api/leads/${leadId}/communications`, { headers: { 'x-user-email': 'owner@leadsprint.local' } });
    const json = await res.json();
    setCommunications((json.communications || []) as Communication[]);
  }

  async function fetchEmailDrafts(leadId: string) {
    const res = await fetch(`${API_BASE}/api/leads/${leadId}/email-drafts`, { headers: { 'x-user-email': 'owner@leadsprint.local' } });
    const json = await res.json();
    setEmailDrafts((json.drafts || []) as EmailDraft[]);
  }

  async function fetchEmailOutbox(leadId: string) {
    const res = await fetch(`${API_BASE}/api/leads/${leadId}/email-outbox`, { headers: { 'x-user-email': 'owner@leadsprint.local' } });
    const json = await res.json();
    setEmailOutbox((json.items || []) as EmailOutboxItem[]);
  }

  async function fetchSummary() {
    const res = await fetch(`${API_BASE}/api/dashboard/summary`, { headers: { 'x-user-email': 'owner@leadsprint.local' } });
    const json = await res.json();
    setSummary(json.summary || null);
  }

  async function fetchReportRows() {
    const res = await fetch(`${API_BASE}/api/reports/status-summary`, { headers: { 'x-user-email': 'owner@leadsprint.local' } });
    const json = await res.json();
    setReportRows((json.rows || []) as ReportRow[]);
  }

  async function fetchTeamUsers() {
    const res = await fetch(`${API_BASE}/api/users`, { headers: { 'x-user-email': 'owner@leadsprint.local' } });
    const json = await res.json();
    setTeamUsers((json.users || []) as TeamUser[]);
  }

  async function addLead() {
    if (!newLeadName.trim()) return;
    await fetch(`${API_BASE}/api/leads/intake`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: newLeadName, email: newLeadEmail || undefined, phone: newLeadPhone || undefined, source: 'manual_ui', message: newLeadMessage || undefined, urgencyStatus: newLeadUrgency }),
    });
    setNewLeadName(''); setNewLeadEmail(''); setNewLeadPhone(''); setNewLeadMessage(''); setNewLeadUrgency('warm');
    await Promise.all([fetchLeads(), fetchSummary(), fetchReportRows()]);
  }

  async function saveLeadEdits() {
    if (!selectedLead) return;
    await fetch(`${API_BASE}/api/leads/${selectedLead.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editLead),
    });
    await Promise.all([fetchLeads(), fetchSummary(), fetchReportRows()]);
    await Promise.all([fetchLeadEvents(selectedLead.id), fetchLeadNotes(selectedLead.id)]);
  }

  async function changeLeadStatus(leadId: string, status: LeadStatus) {
    await fetch(`${API_BASE}/api/leads/${leadId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    await Promise.all([fetchLeads(), fetchSummary(), fetchReportRows()]);
    await fetchLeadEvents(leadId);
  }

  async function changeLeadUrgency(leadId: string, urgencyStatus: UrgencyStatus) {
    await fetch(`${API_BASE}/api/leads/${leadId}/urgency`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urgencyStatus }) });
    await Promise.all([fetchLeads(), fetchSummary(), fetchReportRows()]);
    await fetchLeadEvents(leadId);
  }

  async function logManualContact() {
    if (!selectedLead) return;
    await fetch(`${API_BASE}/api/leads/${selectedLead.id}/contact-log`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: contactChannel, note: contactNote }),
    });
    await Promise.all([fetchLeads(), fetchSummary(), fetchReportRows()]);
    await fetchLeadEvents(selectedLead.id);
  }

  async function addInternalNote() {
    if (!selectedLead || !noteDraft.trim()) return;
    await fetch(`${API_BASE}/api/leads/${selectedLead.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-email': 'owner@leadsprint.local' },
      body: JSON.stringify({ content: noteDraft, noteType }),
    });
    setNoteDraft('');
    await fetchLeadNotes(selectedLead.id);
  }

  async function addCommunication() {
    if (!selectedLead || (!communicationSummary.trim() && !communicationContent.trim())) return;
    await fetch(`${API_BASE}/api/leads/${selectedLead.id}/communications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-email': 'owner@leadsprint.local' },
      body: JSON.stringify({
        channel: contactChannel,
        direction: communicationDirection,
        subject: communicationSubject,
        summary: communicationSummary,
        content: communicationContent,
      }),
    });
    setCommunicationSubject('');
    setCommunicationSummary('');
    setCommunicationContent('');
    await Promise.all([fetchLeadCommunications(selectedLead.id), fetchLeadEvents(selectedLead.id), fetchLeads(), fetchSummary(), fetchReportRows()]);
  }

  async function addEmailDraft() {
    if (!selectedLead || !emailSubject.trim() || !emailBody.trim()) return;
    await fetch(`${API_BASE}/api/leads/${selectedLead.id}/email-drafts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-email': 'owner@leadsprint.local' },
      body: JSON.stringify({ toEmail: selectedLead.email || '', subject: emailSubject, body: emailBody, source: 'workspace' }),
    });
    setEmailSubject('');
    setEmailBody('');
    await Promise.all([fetchEmailDrafts(selectedLead.id), fetchLeadEvents(selectedLead.id)]);
  }

  async function queueEmailDraft(draftId: string) {
    if (!selectedLead) return;
    await fetch(`${API_BASE}/api/leads/${selectedLead.id}/email-outbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-email': 'owner@leadsprint.local' },
      body: JSON.stringify({ emailDraftId: draftId, providerKey: 'stub' }),
    });
    await Promise.all([fetchEmailOutbox(selectedLead.id), fetchLeadEvents(selectedLead.id)]);
  }

  async function processOutboxItem(itemId: string) {
    if (!selectedLead) return;
    await fetch(`${API_BASE}/api/email-outbox/${itemId}/process`, {
      method: 'POST',
      headers: { 'x-user-email': 'owner@leadsprint.local' },
    });
    await Promise.all([fetchEmailOutbox(selectedLead.id), fetchLeadCommunications(selectedLead.id), fetchLeadEvents(selectedLead.id), fetchLeads()]);
  }

  async function fetchEmailProviders() {
    const res = await fetch(`${API_BASE}/api/email/provider-settings`, { headers: { 'x-user-email': 'owner@leadsprint.local' } });
    const json = await res.json();
    setEmailProviders((json.providers || []) as EmailProviderSetting[]);
  }

  async function saveEmailProvider(providerKey: string, patch: { status: string; config: Record<string, string> }) {
    await fetch(`${API_BASE}/api/email/provider-settings/${providerKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-email': 'owner@leadsprint.local' },
      body: JSON.stringify(patch),
    });
    await fetchEmailProviders();
  }

  async function bootstrapGmailProvider() {
    await fetch(`${API_BASE}/api/email/providers/gmail/bootstrap`, {
      method: 'POST',
      headers: { 'x-user-email': 'owner@leadsprint.local' },
    });
    await fetchEmailProviders();
  }

  async function connectGmailProvider() {
    const res = await fetch(`${API_BASE}/api/auth/gmail/start`, {
      headers: { 'x-user-email': 'owner@leadsprint.local' },
    });
    const json = await res.json();
    if (json.authUrl) window.open(json.authUrl, '_blank', 'noopener,noreferrer');
  }

  async function addTeamUser() {
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-email': 'owner@leadsprint.local' },
      body: JSON.stringify({ fullName: newUserName, email: newUserEmail, role: newUserRole }),
    });
    setNewUserName('');
    setNewUserEmail('');
    setNewUserRole('agent');
    await fetchTeamUsers();
  }

  async function updateTeamUser(userId: string, patch: { role?: string; status?: string }) {
    await fetch(`${API_BASE}/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-email': 'owner@leadsprint.local' },
      body: JSON.stringify(patch),
    });
    await fetchTeamUsers();
  }

  async function removeTeamUser(userId: string) {
    await fetch(`${API_BASE}/api/users/${userId}`, {
      method: 'DELETE',
      headers: { 'x-user-email': 'owner@leadsprint.local' },
    });
    await fetchTeamUsers();
  }

  async function fetchTemplate() {
    const res = await fetch(`${API_BASE}/api/templates/first-response`, { headers: { 'x-user-email': 'owner@leadsprint.local' } });
    const json = await res.json();
    const t = json.template as Template;
    setTemplate(t); setTemplateBodyDraft(t.body); setTemplateEnabledDraft(t.isEnabled);
  }
  async function fetchTemplateVersions() {
    const res = await fetch(`${API_BASE}/api/templates/first-response/versions`, { headers: { 'x-user-email': 'owner@leadsprint.local' } });
    const json = await res.json(); setTemplateVersions((json.versions || []) as TemplateVersion[]);
  }
  async function saveTemplate() {
    await fetch(`${API_BASE}/api/templates/first-response`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-user-email': 'owner@leadsprint.local' }, body: JSON.stringify({ body: templateBodyDraft, isEnabled: templateEnabledDraft }),
    });
    await fetchTemplate(); await fetchTemplateVersions();
  }
  async function revertTemplate(versionId: string) {
    await fetch(`${API_BASE}/api/templates/first-response/revert`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-email': 'owner@leadsprint.local' }, body: JSON.stringify({ versionId }),
    });
    await fetchTemplate(); await fetchTemplateVersions();
  }
  async function fetchSettings() {
    const res = await fetch(`${API_BASE}/api/settings/business`, { headers: { 'x-user-email': 'owner@leadsprint.local' } }); const json = await res.json(); setSettings(json.settings as BusinessSettings);
  }
  async function saveSettings() {
    if (!settings) return;
    const res = await fetch(`${API_BASE}/api/settings/business`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-user-email': 'owner@leadsprint.local' }, body: JSON.stringify(settings) });
    const json = await res.json(); setSettings(json.settings as BusinessSettings);
  }
  async function loadPreview() {
    if (!settings) return;
    const res = await fetch(`${API_BASE}/api/templates/first-response/preview`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-email': 'owner@leadsprint.local' },
      body: JSON.stringify({ body: templateBodyDraft, name: previewName, businessName: settings.businessName, bookingLink: settings.bookingLink }),
    });
    const json = await res.json(); setPreviewText(json.preview || '');
  }

  useEffect(() => { fetchLeads(); fetchTemplate(); fetchTemplateVersions(); fetchSettings(); fetchSummary(); fetchReportRows(); fetchTeamUsers(); fetchEmailProviders(); }, []);
  useEffect(() => { fetchLeads(); }, [statusFilter, urgencyFilter]);
  useEffect(() => {
    if (selectedLead) {
      setEditLead({
        fullName: selectedLead.fullName || '',
        email: selectedLead.email || '',
        phone: selectedLead.phone || '',
        source: selectedLead.source || '',
        message: selectedLead.message || '',
        urgencyStatus: selectedLead.urgencyStatus || 'warm',
        assignedUserId: selectedLead.assignedUserId || '',
        ownerUserId: selectedLead.ownerUserId || '',
      });
      fetchLeadEvents(selectedLead.id);
      fetchLeadNotes(selectedLead.id);
      fetchLeadCommunications(selectedLead.id);
      fetchEmailDrafts(selectedLead.id);
      fetchEmailOutbox(selectedLead.id);
    }
  }, [selectedLead?.id]);
  useEffect(() => { if (templateBodyDraft && settings) loadPreview(); }, [templateBodyDraft, previewName, settings?.businessName, settings?.bookingLink]);

  return (
    <main style={{ padding: 24, background: '#f6f7fb', minHeight: '100vh' }}>
      <h1 style={{ marginTop: 0 }}>LeadSprint — Working MVP</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['dashboard', 'leads', 'automation', 'reports', 'settings'] as ViewTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={chip(tab === t)}>{t}</button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
            {[
              ['Inbound (30d)', summary?.recentInbound30d ?? 0],
              ['Hot leads', summary?.hotLeads ?? 0],
              ['Needs attention', summary?.needsAttentionLeads ?? 0],
              ['Conversion rate', `${summary?.conversionRate ?? 0}%`],
            ].map(([label, value]) => (
              <div key={String(label)} style={card}><div style={{ color: '#6b7280', fontSize: 12 }}>{label}</div><div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{value}</div></div>
            ))}
          </section>
          <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
            <div style={card}>
              <h2 style={{ marginTop: 0 }}>Lead pipeline snapshot</h2>
              <ul>
                <li>New leads: {summary?.newLeads ?? 0}</li>
                <li>Contacted leads: {summary?.contactedLeads ?? 0}</li>
                <li>Booked leads: {summary?.bookedLeads ?? 0}</li>
                <li>Closed leads: {summary?.closedLeads ?? 0}</li>
              </ul>
            </div>
            <div style={card}>
              <h2 style={{ marginTop: 0 }}>Urgency watchlist</h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {leads.slice(0, 5).map((lead) => (
                  <div key={lead.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong>{lead.fullName}</strong>
                      <span style={{ color: urgencyColor(lead.urgencyStatus || 'warm'), fontWeight: 700 }}>{(lead.urgencyStatus || 'warm').replace('_', ' ')}</span>
                    </div>
                    <div style={{ color: '#6b7280', fontSize: 13 }}>{lead.source} · {lead.status}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {tab === 'leads' && (
        <>
          <section style={{ ...card, marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>Quick Add Lead</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 180px', gap: 8 }}>
              <input style={input} placeholder="Full name" value={newLeadName} onChange={(e) => setNewLeadName(e.target.value)} />
              <input style={input} placeholder="Email" value={newLeadEmail} onChange={(e) => setNewLeadEmail(e.target.value)} />
              <input style={input} placeholder="Phone" value={newLeadPhone} onChange={(e) => setNewLeadPhone(e.target.value)} />
              <select style={input} value={newLeadUrgency} onChange={(e) => setNewLeadUrgency(e.target.value as UrgencyStatus)}>
                {urgencyOrder.map((u) => <option key={u} value={u}>{u.replace('_', ' ')}</option>)}
              </select>
              <input style={{ ...input, gridColumn: '1 / span 4' }} placeholder="Message" value={newLeadMessage} onChange={(e) => setNewLeadMessage(e.target.value)} />
            </div>
            <button onClick={addLead} style={{ ...input, marginTop: 10, background: '#111827', color: '#fff', border: 0 }}>Add Lead</button>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.45fr', gap: 16 }}>
            <div style={card}>
              <h2 style={{ marginTop: 0 }}>Lead Inbox</h2>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <button onClick={() => setStatusFilter('all')} style={chip(statusFilter === 'all')}>all status</button>
                {statusOrder.map((s) => <button key={s} onClick={() => setStatusFilter(s)} style={chip(statusFilter === s)}>{s}</button>)}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <button onClick={() => setUrgencyFilter('all')} style={chip(urgencyFilter === 'all')}>all urgency</button>
                {urgencyOrder.map((u) => <button key={u} onClick={() => setUrgencyFilter(u)} style={chip(urgencyFilter === u)}>{u.replace('_', ' ')}</button>)}
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {filteredLeads.map((lead) => (
                  <button key={lead.id} onClick={() => setSelectedId(lead.id)} style={{ textAlign: 'left', border: lead.id === selectedLead?.id ? '2px solid #4f46e5' : '1px solid #ddd', borderRadius: 10, background: '#fff', padding: 12, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontWeight: 600 }}>{lead.fullName}</div>
                      <div style={{ color: urgencyColor(lead.urgencyStatus || 'warm'), fontWeight: 700, textTransform: 'capitalize' }}>{(lead.urgencyStatus || 'warm').replace('_', ' ')}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{lead.source}</div>
                    <div style={{ fontSize: 12 }}>Lifecycle: {lead.status}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>Assignee: {lead.assignedUserName || 'Unassigned'}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>Last contact: {formatWhen(lead.lastContactedAt)}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ ...card, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <div>
                  <h2 style={{ marginTop: 0, marginBottom: 4 }}>Lead Workspace</h2>
                  <div style={{ color: '#6b7280' }}>Professional lead detail with ownership, notes, communications, and draft outreach.</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ ...chip(true), background: '#eef2ff', color: '#312e81' }}>{selectedLead?.status || 'new'}</span>
                  <span style={{ ...chip(true), background: '#fff7ed', color: urgencyColor(selectedLead?.urgencyStatus || 'warm') }}>{(selectedLead?.urgencyStatus || 'warm').replace('_', ' ')}</span>
                </div>
              </div>
              {!selectedLead ? <p>Select a lead.</p> : (
                <>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12, color: '#4b5563' }}>
                    <span><strong>Assigned:</strong> {selectedLead.assignedUserName || 'Unassigned'}</span>
                    <span><strong>Owner:</strong> {selectedLead.ownerUserName || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input style={input} value={editLead.fullName} onChange={(e) => setEditLead((s) => ({ ...s, fullName: e.target.value }))} placeholder="Name" />
                    <input style={input} value={editLead.source} onChange={(e) => setEditLead((s) => ({ ...s, source: e.target.value }))} placeholder="Source" />
                    <input style={input} value={editLead.email} onChange={(e) => setEditLead((s) => ({ ...s, email: e.target.value }))} placeholder="Email" />
                    <input style={input} value={editLead.phone} onChange={(e) => setEditLead((s) => ({ ...s, phone: e.target.value }))} placeholder="Phone" />
                    <select style={input} value={editLead.urgencyStatus} onChange={(e) => setEditLead((s) => ({ ...s, urgencyStatus: e.target.value as UrgencyStatus }))}>
                      {urgencyOrder.map((u) => <option key={u} value={u}>{u.replace('_', ' ')}</option>)}
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', color: '#6b7280', fontSize: 13 }}>Received: {formatWhen(selectedLead.receivedAt)}</div>
                    <input style={{ ...input, gridColumn: '1 / span 2' }} value={editLead.message} onChange={(e) => setEditLead((s) => ({ ...s, message: e.target.value }))} placeholder="Message" />
                  </div>
                  <button onClick={saveLeadEdits} style={{ ...input, marginTop: 8, border: 0, background: '#2563eb', color: '#fff' }}>Save Lead Edits</button>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    {statusOrder.map((status) => <button key={status} onClick={() => changeLeadStatus(selectedLead.id, status)} style={{ border: 0, borderRadius: 8, cursor: 'pointer', padding: '8px 10px', background: selectedLead.status === status ? '#111827' : '#e0e7ff', color: selectedLead.status === status ? '#fff' : '#111827' }}>{status}</button>)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {urgencyOrder.map((status) => <button key={status} onClick={() => changeLeadUrgency(selectedLead.id, status)} style={{ border: 0, borderRadius: 8, cursor: 'pointer', padding: '8px 10px', background: (selectedLead.urgencyStatus || 'warm') === status ? urgencyColor(status) : '#f3f4f6', color: (selectedLead.urgencyStatus || 'warm') === status ? '#fff' : '#111827' }}>{status.replace('_', ' ')}</button>)}
                  </div>

                  <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 10 }}>
                    <strong>Manual Contact Log</strong>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <select value={contactChannel} onChange={(e) => setContactChannel(e.target.value as 'email' | 'sms' | 'call')} style={input}><option value="email">email</option><option value="sms">sms</option><option value="call">call</option></select>
                      <input style={{ ...input, flex: 1 }} value={contactNote} onChange={(e) => setContactNote(e.target.value)} />
                      <button onClick={logManualContact} style={{ ...input, border: 0, background: '#065f46', color: '#fff' }}>Log Contact</button>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 10 }}>
                    <strong>Internal Notes</strong>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <select value={noteType} onChange={(e) => setNoteType(e.target.value as typeof noteType)} style={input}>
                        <option value="general">general</option>
                        <option value="call_note">call note</option>
                        <option value="follow_up">follow up</option>
                        <option value="internal_comment">internal comment</option>
                      </select>
                      <input style={{ ...input, flex: 1 }} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Add internal note" />
                      <button onClick={addInternalNote} style={{ ...input, border: 0, background: '#4f46e5', color: '#fff' }}>Save Note</button>
                    </div>
                    <ul style={{ marginTop: 10 }}>
                      {notes.map((note) => (
                        <li key={note.id} style={{ marginTop: 8 }}>
                          <strong>{note.authorName}</strong> · <span style={{ color: '#6b7280' }}>{note.noteType.replace('_', ' ')}</span> · <code>{formatWhen(note.createdAt)}</code>
                          <div>{note.content}</div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 10 }}>
                    <strong>Communications</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: '160px 160px 1fr', gap: 8, marginTop: 8 }}>
                      <select value={contactChannel} onChange={(e) => setContactChannel(e.target.value as 'email' | 'sms' | 'call')} style={input}><option value='email'>email</option><option value='sms'>sms</option><option value='call'>call</option></select>
                      <select value={communicationDirection} onChange={(e) => setCommunicationDirection(e.target.value as 'inbound' | 'outbound')} style={input}><option value='outbound'>outbound</option><option value='inbound'>inbound</option></select>
                      <input style={input} value={communicationSubject} onChange={(e) => setCommunicationSubject(e.target.value)} placeholder='Subject (optional)' />
                      <input style={{ ...input, gridColumn: '1 / span 3' }} value={communicationSummary} onChange={(e) => setCommunicationSummary(e.target.value)} placeholder='Summary' />
                      <textarea style={{ ...input, gridColumn: '1 / span 3', minHeight: 80 }} value={communicationContent} onChange={(e) => setCommunicationContent(e.target.value)} placeholder='Content / transcript / notes' />
                    </div>
                    <button onClick={addCommunication} style={{ ...input, marginTop: 8, border: 0, background: '#111827', color: '#fff' }}>Add Communication</button>
                    <ul style={{ marginTop: 10 }}>
                      {communications.map((item) => (
                        <li key={item.id} style={{ marginTop: 10 }}>
                          <div><strong>{item.channel.toUpperCase()}</strong> · {item.direction} · {item.actorName} · <code>{formatWhen(item.occurredAt)}</code></div>
                          {item.subject ? <div style={{ color: '#6b7280' }}>Subject: {item.subject}</div> : null}
                          <div><strong>Summary:</strong> {item.summary}</div>
                          {item.content ? <div style={{ color: '#374151', whiteSpace: 'pre-wrap' }}>{item.content}</div> : null}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 10 }}>
                    <strong>Email Drafts & Outbox</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginTop: 8 }}>
                      <input style={input} value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder='Draft email subject' />
                      <textarea style={{ ...input, minHeight: 100 }} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} placeholder='Draft email body' />
                    </div>
                    <button onClick={addEmailDraft} style={{ ...input, marginTop: 8, border: 0, background: '#7c3aed', color: '#fff' }}>Save Email Draft</button>
                    <ul style={{ marginTop: 10 }}>
                      {emailDrafts.map((draft) => (
                        <li key={draft.id} style={{ marginTop: 10 }}>
                          <div><strong>{draft.subject}</strong> · <span style={{ color: '#6b7280' }}>{draft.toEmail}</span> · <code>{formatWhen(draft.createdAt)}</code></div>
                          <div style={{ color: '#6b7280' }}>Created by {draft.createdByName} · {draft.status}</div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{draft.body}</div>
                          <button onClick={() => queueEmailDraft(draft.id)} style={{ ...input, marginTop: 6, border: 0, background: '#111827', color: '#fff' }}>Queue for Send</button>
                        </li>
                      ))}
                    </ul>
                    <div style={{ marginTop: 14, color: '#4b5563', fontWeight: 600 }}>Outbox</div>
                    <ul style={{ marginTop: 10 }}>
                      {emailOutbox.map((item) => (
                        <li key={item.id} style={{ marginTop: 10 }}>
                          <div><strong>{item.subject}</strong> · <span style={{ color: '#6b7280' }}>{item.toEmail}</span></div>
                          <div style={{ color: '#6b7280' }}>status: {item.sendStatus} · provider: {item.providerKey} · queued: {formatWhen(item.queuedAt)}</div>
                          {item.lastError ? <div style={{ color: '#b91c1c' }}>error: {item.lastError}</div> : null}
                          {item.sendStatus !== 'sent' ? <button onClick={() => processOutboxItem(item.id)} style={{ ...input, marginTop: 6, border: 0, background: '#2563eb', color: '#fff' }}>Process Send</button> : null}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 10 }}>
                    <strong>Activity Log</strong>
                    <ul>
                      {events.map((evt) => (
                        <li key={evt.id} style={{ marginTop: 6 }}>
                          <code>{formatWhen(evt.createdAt)}</code> — {evt.eventType}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </section>
        </>
      )}

      {tab === 'automation' && (
        <section style={{ ...card }}>
          <h2 style={{ marginTop: 0 }}>Bot Automation Preview</h2>
          <p style={{ marginTop: 0, color: '#4b5563' }}>This is how auto outreach will look for Email/SMS when a new lead arrives.</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <input type="checkbox" checked={templateEnabledDraft} onChange={(e) => setTemplateEnabledDraft(e.target.checked)} /> Auto-reply enabled
          </label>
          <textarea rows={4} style={{ width: '100%', ...input }} value={templateBodyDraft} onChange={(e) => setTemplateBodyDraft(e.target.value)} />
          <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
            <input style={input} value={previewName} onChange={(e) => setPreviewName(e.target.value)} placeholder="Preview lead name" />
            <button onClick={saveTemplate} style={{ ...input, border: 0, background: '#4f46e5', color: '#fff' }}>Save Script</button>
          </div>
          <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#eef2ff' }}>
            <strong>Live Bot Message Preview</strong>
            <p style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{previewText || 'Preview will appear here.'}</p>
          </div>
          <div style={{ marginTop: 12 }}>
            <strong>Recent Script Versions</strong>
            <ul>
              {templateVersions.map((v) => (
                <li key={v.id} style={{ marginTop: 6 }}>
                  <code>{formatWhen(v.changedAt)}</code> — {v.body.slice(0, 85)}
                  <button onClick={() => revertTemplate(v.id)} style={{ ...input, marginLeft: 8, padding: '4px 8px', border: 0 }}>restore</button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {tab === 'reports' && (
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={card}>
            <h2 style={{ marginTop: 0 }}>Status / Urgency Summary</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr><th style={{ textAlign: 'left', paddingBottom: 8 }}>Lifecycle</th><th style={{ textAlign: 'left', paddingBottom: 8 }}>Urgency</th><th style={{ textAlign: 'left', paddingBottom: 8 }}>Count</th></tr>
              </thead>
              <tbody>
                {reportRows.map((row, idx) => (
                  <tr key={`${row.status}-${row.urgencyStatus}-${idx}`}>
                    <td style={{ padding: '6px 0' }}>{row.status}</td>
                    <td style={{ padding: '6px 0', color: urgencyColor(row.urgencyStatus) }}>{row.urgencyStatus.replace('_', ' ')}</td>
                    <td style={{ padding: '6px 0' }}>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={card}>
            <h2 style={{ marginTop: 0 }}>Export-ready snapshot</h2>
            <ul>
              <li>Total leads: {summary?.totalLeads ?? 0}</li>
              <li>Hot leads: {summary?.hotLeads ?? 0}</li>
              <li>Booked leads: {summary?.bookedLeads ?? 0}</li>
              <li>Conversion rate: {summary?.conversionRate ?? 0}%</li>
            </ul>
            <p style={{ color: '#6b7280' }}>This is still MVP-grade reporting, but it gives you something operational and presentable.</p>
          </div>
        </section>
      )}

      {tab === 'settings' && (
        <section style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 16 }}>
          <div style={card}>
            <h2 style={{ marginTop: 0 }}>Team Management</h2>
            <p style={{ marginTop: 0, color: '#4b5563' }}>Manage users, roles, and team access at the organization level.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 160px auto', gap: 8, marginBottom: 12 }}>
              <input style={input} placeholder='Full name' value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
              <input style={input} placeholder='Email' value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
              <select style={input} value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'agent')}>
                <option value='agent'>agent</option>
                <option value='admin'>admin</option>
              </select>
              <button onClick={addTeamUser} style={{ ...input, border: 0, background: '#111827', color: '#fff' }}>Add user</button>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {teamUsers.map((user) => (
                <div key={user.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{user.fullName}</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>{user.email}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ color: '#6b7280', fontSize: 13 }}>status: {user.status || 'active'}</span>
                      <select style={input} value={user.role} onChange={(e) => updateTeamUser(user.id, { role: e.target.value })}>
                        <option value='owner'>owner</option>
                        <option value='admin'>admin</option>
                        <option value='agent'>agent</option>
                      </select>
                      <select style={input} value={user.status || 'active'} onChange={(e) => updateTeamUser(user.id, { status: e.target.value })}>
                        <option value='active'>active</option>
                        <option value='suspended'>suspended</option>
                        <option value='deactivated'>deactivated</option>
                      </select>
                      {user.role !== 'owner' ? <button onClick={() => removeTeamUser(user.id)} style={{ ...input, border: 0, background: '#b91c1c', color: '#fff' }}>Remove</button> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={card}>
            <h2 style={{ marginTop: 0 }}>Organization Preferences</h2>
            <p style={{ marginTop: 0, color: '#4b5563' }}>Business profile, booking link, and working hours.</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input style={input} placeholder='Business name' value={settings?.businessName || ''} onChange={(e) => setSettings((s) => (s ? { ...s, businessName: e.target.value } : s))} />
              <input style={input} placeholder='Timezone' value={settings?.timezone || ''} onChange={(e) => setSettings((s) => (s ? { ...s, timezone: e.target.value } : s))} />
              <input style={{ ...input, minWidth: 300 }} placeholder='Booking link' value={settings?.bookingLink || ''} onChange={(e) => setSettings((s) => (s ? { ...s, bookingLink: e.target.value } : s))} />
            </div>
            <div style={{ marginTop: 12 }}>
              <strong>Business Hours</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
                {days.map((d) => (
                  <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 36, textTransform: 'capitalize', color: '#4b5563' }}>{d}</span>
                    <input style={{ ...input, flex: 1 }} value={settings?.hours?.[d] || ''} onChange={(e) => setSettings((s) => (s ? { ...s, hours: { ...(s.hours || {}), [d]: e.target.value } } : s))} placeholder='09:00-17:00 or closed' />
                  </label>
                ))}
              </div>
            </div>
            <button onClick={saveSettings} style={{ ...input, marginTop: 12, border: 0, background: '#065f46', color: '#fff' }}>Save Preferences</button>

            <div style={{ marginTop: 18, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
              <h3 style={{ marginTop: 0 }}>Email Providers</h3>
              <p style={{ marginTop: 0, color: '#4b5563' }}>Prepare provider settings now so Gmail can plug in cleanly next.</p>
              <div style={{ display: 'grid', gap: 10 }}>
                {emailProviders.map((provider) => (
                  <div key={provider.key} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{provider.label}</div>
                        <div style={{ color: '#6b7280', fontSize: 13 }}>status: {provider.status}{provider.needsAuth ? ' · requires auth' : ''}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {provider.key === 'stub' ? (
                          <button onClick={() => saveEmailProvider(provider.key, { status: 'connected', config: provider.config || {} })} style={{ ...input, border: 0, background: '#111827', color: '#fff' }}>Enable Stub</button>
                        ) : (
                          <>
                            <button onClick={bootstrapGmailProvider} style={{ ...input, border: 0, background: '#111827', color: '#fff' }}>Bootstrap Gmail</button>
                            <button onClick={connectGmailProvider} style={{ ...input, border: 0, background: '#2563eb', color: '#fff' }}>Connect Gmail</button>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ color: '#6b7280', fontSize: 12, marginTop: 6 }}>Updated: {formatWhen(provider.updatedAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
