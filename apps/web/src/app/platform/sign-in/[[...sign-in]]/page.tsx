import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { authScaffoldEnabled } from '../../../../lib/auth/config';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function PlatformSignInPage() {
  const redirectUrl = '/control';

  if (!authScaffoldEnabled) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f6f7fb' }}>
        <div style={{ maxWidth: 520, background: '#fff', padding: 24, borderRadius: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <h1 style={{ marginTop: 0 }}>Platform sign-in unavailable</h1>
          <p>Clerk is not configured yet. Add the Clerk publishable and secret keys to enable platform sign-in.</p>
          <p><Link href="/">Back to home</Link></p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f6f7fb' }}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>LeadSprint</div>
          <h1 style={{ margin: '6px 0 4px' }}>Platform sign-in</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Internal entry point for platform staff. Access is still determined only by server-side platform roles.</p>
        </div>
        <SignIn signUpUrl="/sign-up" forceRedirectUrl={redirectUrl} fallbackRedirectUrl={redirectUrl} />
      </div>
    </main>
  );
}
