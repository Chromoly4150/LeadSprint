'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { clearPermissionOverride, getUserById, setPermissionOverride, writeAuditLog } from '@/lib/db';
import { getCurrentUser, requirePermission } from '@/lib/permissions';

export async function setActingUserAction(formData: FormData) {
  const priorUser = await getCurrentUser();
  const userId = String(formData.get('userId') || '');
  const target = getUserById(userId);
  if (!target) return;

  const cookieStore = await cookies();
  cookieStore.set('leadsprint_user_id', target.id, { path: '/', sameSite: 'lax' });
  writeAuditLog({
    organizationId: target.organizationId,
    actorId: priorUser.id,
    actorName: priorUser.name,
    action: 'session.acting_user_switched',
    targetType: 'user',
    targetId: target.id,
    metadata: { fromUserId: priorUser.id, toUserId: target.id, toRole: target.role },
  });
  revalidatePath('/dashboard');
  revalidatePath('/leads');
  revalidatePath('/reports');
  revalidatePath('/settings');
}

export async function setPermissionOverrideAction(formData: FormData) {
  const currentUser = await getCurrentUser();
  await requirePermission(currentUser, 'permissions.manage');

  const organizationId = String(formData.get('organizationId'));
  const userId = String(formData.get('userId'));
  const permissionKey = String(formData.get('permissionKey'));
  const effect = String(formData.get('effect')) as 'allow' | 'deny';

  if (!organizationId || !userId || !permissionKey || !['allow', 'deny'].includes(effect)) return;

  setPermissionOverride({ organizationId, userId, permissionKey, effect });
  writeAuditLog({
    organizationId,
    actorId: currentUser.id,
    actorName: currentUser.name,
    action: 'permissions.override_set',
    targetType: 'user',
    targetId: userId,
    metadata: { permissionKey, effect },
  });
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  revalidatePath('/leads');
  revalidatePath('/reports');
}

export async function clearPermissionOverrideAction(formData: FormData) {
  const currentUser = await getCurrentUser();
  await requirePermission(currentUser, 'permissions.manage');

  const userId = String(formData.get('userId'));
  const permissionKey = String(formData.get('permissionKey'));
  if (!userId || !permissionKey) return;

  clearPermissionOverride(userId, permissionKey);
  const target = getUserById(userId);
  writeAuditLog({
    organizationId: target?.organizationId ?? 'org_demo',
    actorId: currentUser.id,
    actorName: currentUser.name,
    action: 'permissions.override_cleared',
    targetType: 'user',
    targetId: userId,
    metadata: { permissionKey },
  });
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  revalidatePath('/leads');
  revalidatePath('/reports');
}
