import { GuardedAppShell } from '../../components/guarded-app-shell';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <GuardedAppShell>{children}</GuardedAppShell>;
}
