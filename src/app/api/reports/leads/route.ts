import { leadsCsv } from '@/lib/db';

export async function GET() {
  const csv = leadsCsv();

  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="leads-export.csv"',
    },
  });
}
