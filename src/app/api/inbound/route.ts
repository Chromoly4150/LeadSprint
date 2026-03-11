import { NextRequest, NextResponse } from 'next/server';
import { createInboundLead } from '@/lib/db';
import { getCurrentUser, hasPermission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!(await hasPermission(user, 'leads.create'))) {
    return NextResponse.json({ error: `${user.role} cannot create inbound leads.` }, { status: 403 });
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== 'object' || !('name' in body) || !('source' in body)) {
    return NextResponse.json({ error: 'Expected JSON body with at least name and source.' }, { status: 400 });
  }

  const lead = createInboundLead({
    source: String(body.source || 'Webhook'),
    name: String(body.name || '').trim(),
    company: String(body.company || '').trim(),
    email: String(body.email || '').trim(),
    phone: String(body.phone || '').trim(),
    state: String(body.state || '').trim(),
    service: String(body.service || '').trim(),
    details: String(body.details || '').trim(),
  });

  return NextResponse.json({
    ok: true,
    lead: {
      id: lead.id,
      name: lead.name,
      source: lead.source,
      urgency: lead.urgency,
      lifecycle: lead.lifecycle,
      firstResponseDueAt: lead.firstResponseDueAt,
    },
  }, { status: 201 });
}
