import { NextResponse } from 'next/server';
import { dispatchQueuedOutboundJobs } from '@/lib/outbound/dispatch';
import { getCurrentUser, hasPermission } from '@/lib/permissions';

export async function POST() {
  const user = await getCurrentUser();
  if (!(await hasPermission(user, 'conversations.takeover'))) {
    return NextResponse.json({ error: `${user.role} cannot dispatch outbound jobs.` }, { status: 403 });
  }

  const results = await dispatchQueuedOutboundJobs(user, 10);
  return NextResponse.json({ ok: true, results });
}
