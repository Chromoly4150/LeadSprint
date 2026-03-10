export type Urgency = 'Hot' | 'Warm' | 'Cold' | 'Needs Attention' | 'SLA Risk';
export type Lifecycle = 'New' | 'Contacted' | 'In Progress' | 'Qualified' | 'Unresponsive' | 'Converted';

export type Lead = {
  id: string;
  name: string;
  company: string;
  source: string;
  state: string;
  lifecycle: Lifecycle;
  urgency: Urgency;
  assignee: string;
  receivedAt: string;
  lastContact: string;
  lastActivity: string;
  email: string;
  phone: string;
  service: string;
  notes: { id: string; author: string; createdAt: string; type: string; content: string }[];
  communications: {
    id: string;
    channel: 'SMS' | 'Email' | 'Call' | 'Chat';
    direction: 'Inbound' | 'Outbound';
    actor: string;
    createdAt: string;
    subject?: string;
    summary: string;
    content: string;
  }[];
  activity: { id: string; label: string; detail: string; createdAt: string }[];
};

export const leads: Lead[] = [
  {
    id: 'lead-001',
    name: 'Taylor Brooks',
    company: 'Brooks Realty Group',
    source: 'Website Form',
    state: 'FL',
    lifecycle: 'New',
    urgency: 'Hot',
    assignee: 'Unassigned',
    receivedAt: '5 min ago',
    lastContact: '—',
    lastActivity: 'Just now',
    email: 'taylor@brooksrealty.com',
    phone: '(555) 201-9001',
    service: 'Referral partnership inquiry',
    notes: [
      {
        id: 'n1',
        author: 'System',
        createdAt: '2 min ago',
        type: 'follow_up',
        content: 'Lead marked hot because form included name, phone, email, and inquiry details. First-response window ends in 3 minutes.',
      },
    ],
    communications: [
      {
        id: 'c1',
        channel: 'Chat',
        direction: 'Outbound',
        actor: 'Bot',
        createdAt: '1 min ago',
        summary: 'Acknowledged inquiry and asked preferred callback time.',
        content: 'Thanks for reaching out — we got your inquiry and a team member will follow up shortly. What is the best number and time for a quick call?',
      },
    ],
    activity: [
      { id: 'a1', label: 'Lead received', detail: 'Website form submission normalized into system.', createdAt: '5 min ago' },
      { id: 'a2', label: 'Automation started', detail: 'Hot-lead response workflow triggered.', createdAt: '2 min ago' },
    ],
  },
  {
    id: 'lead-002',
    name: 'Jordan Lee',
    company: 'Lee Home Lending',
    source: 'Google Form',
    state: 'NC',
    lifecycle: 'Contacted',
    urgency: 'Warm',
    assignee: 'Ava',
    receivedAt: '42 min ago',
    lastContact: '12 min ago',
    lastActivity: '8 min ago',
    email: 'jordan@leehomelending.com',
    phone: '(555) 333-0021',
    service: 'Purchase loan follow-up',
    notes: [
      {
        id: 'n2',
        author: 'Ava',
        createdAt: '10 min ago',
        type: 'call_note',
        content: 'Spoke briefly. They want a callback after 7 PM and care most about turnaround time and down-payment options.',
      },
      {
        id: 'n3',
        author: 'Ava',
        createdAt: '8 min ago',
        type: 'internal_comment',
        content: 'Good fit. Send financing options summary before call if possible.',
      },
    ],
    communications: [
      {
        id: 'c2',
        channel: 'SMS',
        direction: 'Outbound',
        actor: 'Bot',
        createdAt: '30 min ago',
        summary: 'Initial response sent within SLA.',
        content: 'Thanks for your interest — we received your request and can help. Is text okay for a quick follow-up while we get the right person on it?',
      },
      {
        id: 'c3',
        channel: 'Call',
        direction: 'Outbound',
        actor: 'Ava',
        createdAt: '12 min ago',
        summary: 'Short live call; follow-up scheduled.',
        content: 'Call connected. Discussed timing and next-step expectations. Callback requested for this evening.',
      },
      {
        id: 'c4',
        channel: 'Email',
        direction: 'Outbound',
        actor: 'Ava',
        createdAt: '8 min ago',
        subject: 'Quick follow-up and next steps',
        summary: 'Sent recap email after call.',
        content: 'Thanks for your time earlier. I’ll follow up after 7 PM as requested and send over a few options ahead of the call.',
      },
    ],
    activity: [
      { id: 'a3', label: 'Lead received', detail: 'Google Form lead captured.', createdAt: '42 min ago' },
      { id: 'a4', label: 'First response sent', detail: 'SMS sent within 4 minutes.', createdAt: '30 min ago' },
      { id: 'a5', label: 'Assigned', detail: 'Assigned to Ava.', createdAt: '20 min ago' },
    ],
  },
  {
    id: 'lead-003',
    name: 'Morgan Patel',
    company: 'Patel Insurance',
    source: 'Webhook',
    state: 'TX',
    lifecycle: 'Qualified',
    urgency: 'Needs Attention',
    assignee: 'Noah',
    receivedAt: '3 hr ago',
    lastContact: '1 hr ago',
    lastActivity: '18 min ago',
    email: 'morgan@patelinsurance.com',
    phone: '(555) 811-7777',
    service: 'Cross-referral partnership',
    notes: [
      {
        id: 'n4',
        author: 'Noah',
        createdAt: '20 min ago',
        type: 'general',
        content: 'Strong strategic fit, but waiting on confirmation of office coverage area.',
      },
    ],
    communications: [
      {
        id: 'c5',
        channel: 'Email',
        direction: 'Inbound',
        actor: 'Morgan Patel',
        createdAt: '1 hr ago',
        subject: 'Re: partnership conversation',
        summary: 'Asked about service territory and referral process.',
        content: 'Can you send more detail on how you handle referrals in DFW and surrounding counties?',
      },
    ],
    activity: [
      { id: 'a6', label: 'Qualified', detail: 'Lead moved into qualified state after review.', createdAt: '1 hr ago' },
      { id: 'a7', label: 'Needs attention', detail: 'Pending reply to inbound email.', createdAt: '18 min ago' },
    ],
  },
];

export function getLead(id: string) {
  return leads.find((lead) => lead.id === id);
}
