import { ReactNode } from 'react';
import { getCurrentUser, hasPermission, type PermissionKey } from '@/lib/permissions';

export async function PermissionGuard({
  permission,
  children,
  fallback = null,
}: {
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const user = await getCurrentUser();
  return (await hasPermission(user, permission)) ? <>{children}</> : <>{fallback}</>;
}
