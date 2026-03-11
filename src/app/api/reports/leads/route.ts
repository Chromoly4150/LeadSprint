import { leadsCsv } from '@/lib/db';
import { getCurrentUser, hasPermission } from '@/lib/permissions';

export async function GET() {
  const user = await getCurrentUser();
  if (!(await hasPermission(user, 'exports.run'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const csv = leadsCsv();

  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="leads-export.csv"',
    },
  });
}
