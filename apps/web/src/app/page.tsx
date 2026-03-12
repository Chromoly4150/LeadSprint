import Link from 'next/link';

const sectionStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: '48px 24px',
};

const cardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  padding: 20,
  background: '#fff',
};

export default function HomePage() {
  return (
    <main style={{ background: '#f8fafc', minHeight: '100vh' }}>
      <section style={{ ...sectionStyle, paddingTop: 72 }}>
        <div style={{ display: 'grid', gap: 20, maxWidth: 760 }}>
          <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280' }}>LeadSprint</div>
          <h1 style={{ fontSize: 56, lineHeight: 1.05, margin: 0 }}>Lead follow-up that feels organized before your team gets big.</h1>
          <p style={{ fontSize: 18, color: '#4b5563', margin: 0 }}>
            LeadSprint helps small businesses capture leads, keep conversations moving, and stay on top of follow-up without turning the process into chaos.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/request-access" style={{ background: '#111827', color: '#fff', padding: '12px 18px', borderRadius: 10, textDecoration: 'none' }}>Request Access</Link>
            <Link href="/sign-in" style={{ background: '#fff', color: '#111827', padding: '12px 18px', borderRadius: 10, textDecoration: 'none', border: '1px solid #d1d5db' }}>Sign In</Link>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
          <article style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>For solo operators</h2>
            <p style={{ color: '#4b5563' }}>Run your pipeline alone with an individual workspace built for owner-operators and sole proprietors.</p>
          </article>
          <article style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>For verified businesses</h2>
            <p style={{ color: '#4b5563' }}>Create a reviewed business workspace, bring your team in by invite, and keep access tied to the right organization.</p>
          </article>
          <article style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>For growing teams</h2>
            <p style={{ color: '#4b5563' }}>Track lead status, communications, drafts, inbox activity, and next steps from one place instead of scattered tools.</p>
          </article>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
          <h2 style={{ marginTop: 0 }}>How access works</h2>
          <ul style={{ margin: 0, paddingLeft: 20, color: '#4b5563' }}>
            <li>New customers request access before creating a product account.</li>
            <li>Verified business workspaces are reviewed before multi-user access is enabled.</li>
            <li>Team members join by invite from an owner or admin.</li>
            <li>Existing users can sign in at any time.</li>
          </ul>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/request-access" style={{ color: '#111827' }}>Start workspace setup</Link>
            <Link href="/about" style={{ color: '#111827' }}>About LeadSprint</Link>
            <Link href="/support" style={{ color: '#111827' }}>Contact support</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
