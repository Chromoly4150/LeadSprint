import Link from 'next/link';
import { SignIn } from '@clerk/nextjs';
import { authScaffoldEnabled, getOnboardingRedirectUrl } from '../../../lib/auth/config';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

function getSafeRedirectUrl(value?: string) {
  if (!value || !value.startsWith('/')) return getOnboardingRedirectUrl();
  return value;
}

export default function SignInPage({ searchParams }: { searchParams?: { redirect_url?: string } }) {
  const redirectUrl = getSafeRedirectUrl(searchParams?.redirect_url);

  if (!authScaffoldEnabled) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f6f7fb' }}>
        <div style={{ maxWidth: 520, background: '#fff', padding: 24, borderRadius: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <h1 style={{ marginTop: 0 }}>Auth scaffold is installed</h1>
          <p>Clerk is not configured yet. Add the Clerk publishable and secret keys to enable sign-in.</p>
          <p><Link href="/">Back to home</Link></p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f6f7fb' }}>
      <SignIn signUpUrl="/sign-up" forceRedirectUrl={redirectUrl} fallbackRedirectUrl={redirectUrl} />
    </main>
  );
}
