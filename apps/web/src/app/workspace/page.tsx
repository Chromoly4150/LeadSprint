import { redirect } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import { isPlatformRole } from '../../lib/surfaces';

export default async function WorkspaceIndexPage() {
  const access = await apiFetch<{ workspace?: { slug?: string }; user?: { role: string } }>('/api/access/me');
  if (isPlatformRole(access.user?.role || '')) redirect('/control');
  if (access.workspace?.slug) redirect(`/workspace/${access.workspace.slug}`);
  redirect('/dashboard');
}
