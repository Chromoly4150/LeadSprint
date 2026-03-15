import { redirect } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { isPlatformRole } from '../../../lib/surfaces';

export default async function DashboardPage() {
  const access = await apiFetch<{ state: string; workspace?: { slug?: string }; user?: { role: string } }>('/api/access/me');

  if (isPlatformRole(access.user?.role || '')) {
    redirect('/control');
  }

  const workspaceSlug = access.workspace?.slug;
  if (workspaceSlug) {
    redirect(`/workspace/${workspaceSlug}`);
  }

  redirect('/onboarding');
}
