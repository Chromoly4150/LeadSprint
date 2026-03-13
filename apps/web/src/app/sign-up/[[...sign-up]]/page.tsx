import Link from 'next/link';
import { cookies } from 'next/headers';
import { SignUp } from '@clerk/nextjs';
import { apiFetch } from '../../../lib/api';
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

export default async function SignUpPage({ searchParams }: { searchParams?: { invite?: string; approved?: string; redirect_url?: string; activation_token?: string } }) {
  const hasDraft = Boolean(cookies().get('leadsprint_request_access_draft')?.value);
  const activationToken = searchParams?.activation_token || '';
  const activation = activationToken
    ? await apiFetch<{ activation: { email: string; fullName: string; organizationName: string; requestKind: string; activatedAt?: string | null } }>(`/api/public/access/activation/${activationToken}`).catch(() => null)
    : null;
  const allowed = Boolean(searchParams?.invite || searchParams?.approved || hasDraft || activation);
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
            LeadSprint account creation is reserved for invited or approved users. If you’re new here, submit the request-access form first and wait for approval before creating an account.
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
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f6f7fb', gap: 16 }}>
      {activation ? (
        <div style={{ maxWidth: 520, width: '100%', background: '#fff', padding: 20, borderRadius: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <h1 style={{ marginTop: 0, fontSize: 24 }}>Activate your approved LeadSprint access</h1>
          <p style={{ color: '#4b5563' }}>
            This request was approved for <strong>{activation.activation.organizationName}</strong>. Create your account with the same approved email so LeadSprint can attach it and finish provisioning automatically.
          </p>
          <div style={{ fontSize: 14, color: '#374151' }}>
            <div>Email: {activation.activation.email}</div>
            <div>Request type: {activation.activation.requestKind === 'individual_workspace' ? 'Individual workspace' : 'Business workspace'}</div>
          </div>
        </div>
      ) : null}
      <SignUp signInUrl="/sign-in" forceRedirectUrl={redirectUrl} fallbackRedirectUrl={redirectUrl} />
    </main>
  );
}
