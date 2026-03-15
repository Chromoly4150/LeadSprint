export type WorkspaceSummary = {
  id: string;
  name: string;
  slug?: string;
  workspaceType?: string;
  surface?: string;
};

export type ActorSummary = {
  id: string;
  email: string;
  role: string;
  roleLabel?: string;
  status?: string;
};

export function isPlatformRole(role = '') {
  return role.startsWith('platform_');
}

export function buildPrimaryNav({ role, workspaceSlug }: { role: string; workspaceSlug?: string }) {
  if (isPlatformRole(role)) {
    return [{ href: '/control', label: 'Control' }];
  }

  return [
    { href: `/workspace/${workspaceSlug || 'current'}`, label: 'Workspace' },
    { href: '/leads', label: 'Leads' },
    { href: '/inbox', label: 'Inbox' },
    { href: '/reports', label: 'Reports' },
    { href: '/settings', label: 'Settings' },
  ];
}
