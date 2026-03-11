import { cookies } from 'next/headers';
import { db, listAssignees, listPermissionOverrides } from '@/lib/db';

export type Role = 'Owner' | 'Admin' | 'General User' | 'Support User';

export type PermissionKey =
  | 'organization.manage'
  | 'users.manage'
  | 'permissions.manage'
  | 'leads.view'
  | 'leads.create'
  | 'leads.edit'
  | 'leads.assign'
  | 'notes.create_internal'
  | 'conversations.view'
  | 'conversations.takeover'
  | 'messaging.send_email'
  | 'messaging.send_sms'
  | 'messaging.send_other'
  | 'exports.run'
  | 'reports.view'
  | 'integrations.manage'
  | 'audit.view';

export const allPermissions: PermissionKey[] = [
  'organization.manage',
  'users.manage',
  'permissions.manage',
  'leads.view',
  'leads.create',
  'leads.edit',
  'leads.assign',
  'notes.create_internal',
  'conversations.view',
  'conversations.takeover',
  'messaging.send_email',
  'messaging.send_sms',
  'messaging.send_other',
  'exports.run',
  'reports.view',
  'integrations.manage',
  'audit.view',
];

const rolePermissions: Record<Role, PermissionKey[]> = {
  Owner: allPermissions,
  Admin: [
    'users.manage',
    'leads.view',
    'leads.create',
    'leads.edit',
    'leads.assign',
    'notes.create_internal',
    'conversations.view',
    'conversations.takeover',
    'messaging.send_email',
    'messaging.send_sms',
    'messaging.send_other',
    'exports.run',
    'reports.view',
    'integrations.manage',
    'audit.view',
  ],
  'General User': [
    'leads.view',
    'leads.create',
    'leads.edit',
    'notes.create_internal',
    'conversations.view',
    'conversations.takeover',
    'messaging.send_email',
    'messaging.send_sms',
    'messaging.send_other',
    'reports.view',
  ],
  'Support User': [
    'leads.view',
    'leads.edit',
    'conversations.view',
    'notes.create_internal',
    'reports.view',
  ],
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export async function getCurrentUser(): Promise<CurrentUser> {
  const cookieStore = await cookies();
  const actingUserId = cookieStore.get('leadsprint_user_id')?.value;
  const users = listAssignees();
  const matched = users.find((user) => user.id === actingUserId) ?? users[0];
  return {
    id: matched.id,
    name: matched.name,
    email: matched.email,
    role: matched.role as Role,
  };
}

export async function getUserPermissionState(user: CurrentUser) {
  const overrides = listPermissionOverrides(user.id);
  const allowed = new Set<PermissionKey>(rolePermissions[user.role]);

  for (const override of overrides) {
    const permission = override.permissionKey as PermissionKey;
    if (override.effect === 'allow') allowed.add(permission);
    if (override.effect === 'deny') allowed.delete(permission);
  }

  return {
    allowed: Array.from(allowed),
    overrides,
  };
}

export async function hasPermission(user: CurrentUser, permission: PermissionKey) {
  const state = await getUserPermissionState(user);
  return state.allowed.includes(permission);
}

export async function requirePermission(user: CurrentUser, permission: PermissionKey) {
  if (!(await hasPermission(user, permission))) {
    throw new Error(`${user.role} cannot perform ${permission}`);
  }
}

export function rolePermissionMatrix() {
  return rolePermissions;
}
