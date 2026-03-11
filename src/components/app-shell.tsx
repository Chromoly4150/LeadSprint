import Link from 'next/link';
import { ReactNode } from 'react';
import { getCurrentUser } from '@/lib/permissions';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/leads', label: 'Leads' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
];

export async function AppShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  const currentUser = await getCurrentUser();

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">LeadSprint</p>
          <h1>{title}</h1>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
          <div className="sidebar-user muted small">Acting as: <strong>{currentUser.name}</strong> · {currentUser.role}</div>
        </div>
        <nav className="nav">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="content">{children}</section>
    </main>
  );
}
