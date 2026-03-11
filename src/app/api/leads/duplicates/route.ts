import { NextRequest, NextResponse } from 'next/server';
import { findDuplicateLeads } from '@/lib/db';
import { getCurrentUser, hasPermission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!(await hasPermission(user, 'leads.view'))) {
    return NextResponse.json({ error: `${user.role} cannot check duplicates.` }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Expected JSON body.' }, { status: 400 });
  }

  const result = findDuplicateLeads({
    name: String(body.name || '').trim(),
    company: String(body.company || '').trim(),
    email: String(body.email || '').trim(),
    phone: String(body.phone || '').trim(),
  });

  return NextResponse.json({ ok: true, ...result });
}
