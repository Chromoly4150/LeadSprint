import Link from 'next/link';

const cardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  padding: 24,
  background: '#fff',
};

export const metadata = {
  robots: {
    index: true,
    follow: true,
  },
};

export default function RequestAccessPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: '48px 24px' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: 20 }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280' }}>Request Access</div>
          <h1 style={{ margin: '8px 0 0', fontSize: 42 }}>Start the right LeadSprint setup</h1>
          <p style={{ color: '#4b5563', maxWidth: 720 }}>
            Choose the path that matches how you plan to use LeadSprint. If your company already has a workspace, ask your owner or admin for an invite instead of requesting a new account here.
          </p>
        </div>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
          <article style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Individual workspace</h2>
            <p style={{ color: '#4b5563' }}>For sole proprietors and one-person operations. No teammate invites, no business verification required to begin.</p>
            <Link href="/onboarding/individual">Continue as an individual</Link>
          </article>
          <article style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Verified business workspace</h2>
            <p style={{ color: '#4b5563' }}>For companies and teams. We’ll review the business and confirm you’re authorized to act on its behalf before enabling multi-user access.</p>
            <Link href="/onboarding/business">Request business workspace</Link>
          </article>
        </section>

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Already approved or invited?</h2>
          <p style={{ color: '#4b5563' }}>Use the sign-in flow if you already have access, or if a workspace owner/admin invited you.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/sign-in">Sign in</Link>
            <Link href="/support">Contact support</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
