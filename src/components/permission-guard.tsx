import { ReactNode } from 'react';
import { getCurrentUser, hasPermission, type PermissionKey } from '@/lib/permissions';

export function PermissionGuard({
  permission,
  children,
  fallback = null,
}: {
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const user = getCurrentUser();
  return hasPermission(user, permission) ? <>{children}</> : <>{fallback}</>;
}
