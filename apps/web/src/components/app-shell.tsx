import Link from 'next/link';

const nav = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/leads', label: 'Leads' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
  { href: '/onboarding', label: 'Onboarding' },
];

export function AppShell({ title, subtitle, children, showNav = true }: { title: string; subtitle?: string; children: React.ReactNode; showNav?: boolean }) {
  return (
    <main style={{ minHeight: '100vh', background: '#f6f7fb', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>LeadSprint</div>
          <h1 style={{ margin: '6px 0 4px' }}>{title}</h1>
          {subtitle ? <p style={{ margin: 0, color: '#6b7280' }}>{subtitle}</p> : null}
        </div>
        {showNav ? (
          <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {nav.map((item) => (
              <Link key={item.href} href={item.href} style={{ padding: '8px 12px', borderRadius: 10, textDecoration: 'none', background: '#e5e7eb', color: '#111827', fontWeight: 600 }}>
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
      {children}
    </main>
  );
}

export const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };
export const inputStyle: React.CSSProperties = { padding: 8, borderRadius: 8, border: '1px solid #d1d5db' };
