'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { clearPermissionOverride, getUserById, setPermissionOverride } from '@/lib/db';
import { getCurrentUser, requirePermission } from '@/lib/permissions';

export async function setActingUserAction(formData: FormData) {
  const userId = String(formData.get('userId') || '');
  const target = getUserById(userId);
  if (!target) return;

  const cookieStore = await cookies();
  cookieStore.set('leadsprint_user_id', target.id, { path: '/', sameSite: 'lax' });
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
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  revalidatePath('/leads');
  revalidatePath('/reports');
}
