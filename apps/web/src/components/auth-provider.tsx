import { ClerkProvider, SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { authScaffoldEnabled } from '../lib/auth/config';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!authScaffoldEnabled) {
    return (
      <>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fff', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ fontWeight: 700 }}>LeadSprint</div>
          <div style={{ color: '#6b7280', fontSize: 14 }}>Clerk keys not configured yet</div>
        </header>
        {children}
      </>
    );
  }

  return (
    <ClerkProvider>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fff', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ fontWeight: 700 }}>LeadSprint</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <SignedOut>
            <SignInButton mode="modal" />
            <SignUpButton mode="modal" />
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </header>
      {children}
    </ClerkProvider>
  );
}
