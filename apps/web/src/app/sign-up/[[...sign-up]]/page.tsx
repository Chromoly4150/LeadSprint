import Link from 'next/link';
import { cookies } from 'next/headers';
import { SignUp } from '@clerk/nextjs';
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

export default function SignUpPage({ searchParams }: { searchParams?: { invite?: string; approved?: string; redirect_url?: string } }) {
  const hasDraft = Boolean(cookies().get('leadsprint_request_access_draft')?.value);
  const allowed = Boolean(searchParams?.invite || searchParams?.approved || hasDraft);
  const redirectUrl = getSafeRedirectUrl(searchParams?.redirect_url || (hasDraft ? '/request-access?resume=1' : undefined));

  if (!authScaffoldEnabled) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f6f7fb' }}>
        <div style={{ maxWidth: 520, background: '#fff', padding: 24, borderRadius: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <h1 style={{ marginTop: 0 }}>Auth scaffold is installed</h1>
          <p>Clerk is not configured yet. Add the Clerk publishable and secret keys to enable sign-up.</p>
          <p><Link href="/">Back to site</Link></p>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f6f7fb' }}>
        <div style={{ maxWidth: 560, background: '#fff', padding: 24, borderRadius: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <h1 style={{ marginTop: 0 }}>Request access first</h1>
          <p>
            LeadSprint account creation is reserved for invited or approved users. If you’re new here, start with the request-access flow so we can associate your account correctly.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/request-access">Request access</Link>
            <Link href="/sign-in">Sign in</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f6f7fb' }}>
      <SignUp signInUrl="/sign-in" forceRedirectUrl={redirectUrl} fallbackRedirectUrl={redirectUrl} />
    </main>
  );
}
