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

const rolePermissions: Record<Role, PermissionKey[]> = {
  Owner: [
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
  ],
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

const usersByMode: Record<string, CurrentUser> = {
  owner: { id: 'user_owner', name: 'Josiah', email: 'owner@leadsprint.local', role: 'Owner' },
  admin: { id: 'user_ava', name: 'Ava', email: 'ava@leadsprint.local', role: 'Admin' },
  general: { id: 'user_noah', name: 'Noah', email: 'noah@leadsprint.local', role: 'General User' },
  support: { id: 'user_system', name: 'System', email: 'system@leadsprint.local', role: 'Support User' },
};

export function getCurrentUser(): CurrentUser {
  const mode = process.env.LEADSPRINT_ACTING_ROLE?.toLowerCase();
  return usersByMode[mode ?? 'owner'] ?? usersByMode.owner;
}

export function hasPermission(user: CurrentUser, permission: PermissionKey) {
  return rolePermissions[user.role].includes(permission);
}

export function requirePermission(user: CurrentUser, permission: PermissionKey) {
  if (!hasPermission(user, permission)) {
    throw new Error(`${user.role} cannot perform ${permission}`);
  }
}

export function rolePermissionMatrix() {
  return rolePermissions;
}
