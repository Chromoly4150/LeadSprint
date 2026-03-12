import { ClerkProvider } from '@clerk/nextjs';
import { authScaffoldEnabled } from '../lib/auth/config';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!authScaffoldEnabled) return <>{children}</>;
  return <ClerkProvider>{children}</ClerkProvider>;
}
