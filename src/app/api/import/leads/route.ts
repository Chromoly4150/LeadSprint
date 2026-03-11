import { NextRequest, NextResponse } from 'next/server';
import { importLeadsFromCsv, writeAuditLog } from '@/lib/db';
import { getCurrentUser, hasPermission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!(await hasPermission(user, 'leads.create'))) {
    return NextResponse.json({ error: `${user.role} cannot import leads.` }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const csvText = typeof body?.csvText === 'string' ? body.csvText : '';
  if (!csvText.trim()) {
    return NextResponse.json({ error: 'Expected csvText in request body.' }, { status: 400 });
  }

  const result = importLeadsFromCsv(csvText);
  const organizationId = result.created[0]?.organizationId ?? 'org_demo';
  writeAuditLog({
    organizationId,
    actorId: user.id,
    actorName: user.name,
    action: 'lead.csv_imported_api',
    targetType: 'import',
    targetId: `csv_${Date.now()}`,
    metadata: { created: result.created.length, skipped: result.skipped.length },
  });

  return NextResponse.json({
    ok: true,
    created: result.created.map((lead) => ({ id: lead?.id, name: lead?.name, source: lead?.source })),
    skipped: result.skipped,
  });
}
