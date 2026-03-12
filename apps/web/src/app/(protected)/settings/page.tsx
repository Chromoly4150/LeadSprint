import { AppShell, cardStyle, inputStyle } from '../../../components/app-shell';
import { apiFetch } from '../../../lib/api';

export default async function SettingsPage() {
  const [usersRes, providersRes] = await Promise.all([
    apiFetch<{ users: Array<{ id: string; fullName: string; email: string; role: string; status?: string }> }>('/api/users'),
    apiFetch<{ providers: Array<{ key: string; label: string; needsAuth: boolean; status: string; updatedAt: string | null }> }>('/api/email/provider-settings'),
  ]);

  return (
    <AppShell title="Settings" subtitle="Team and provider management route extracted from the MVP screen">
      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Team</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {usersRes.users.map((user) => (
              <div key={user.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700 }}>{user.fullName}</div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>{user.email}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{user.role} · {user.status || 'active'}</div>
              </div>
            ))}
          </div>
        </article>
        <article style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Email providers</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {providersRes.providers.map((provider) => (
              <div key={provider.key} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700 }}>{provider.label}</div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>status: {provider.status}{provider.needsAuth ? ' · requires auth' : ''}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>updated: {provider.updatedAt || '—'}</div>
              </div>
            ))}
          </div>
          <p style={{ ...inputStyle, marginTop: 12, background: '#f9fafb' as const }}>Next port step: move the interactive provider and team management controls here from the prototype branch.</p>
        </article>
      </section>
    </AppShell>
  );
}
