import { AppShell } from '@/components/app-shell';
import { rolePermissionMatrix } from '@/lib/permissions';

export default function SettingsPage() {
  const matrix = rolePermissionMatrix();

  return (
    <AppShell title="Settings" subtitle="Role and permission scaffold">
      <header className="page-header">
        <div>
          <p className="eyebrow">Permissions</p>
          <h2>Role capability matrix</h2>
          <p className="muted">First-pass server-enforced permission scaffold before full auth and custom RBAC.</p>
        </div>
      </header>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Current defaults</p>
            <h3>System role permissions</h3>
          </div>
        </div>
        <div className="stack">
          {Object.entries(matrix).map(([role, permissions]) => (
            <div key={role} className="note-card">
              <div className="note-header">
                <strong>{role}</strong>
                <span className="muted">{permissions.length} permissions</span>
              </div>
              <div className="permission-chips">
                {permissions.map((permission) => (
                  <span key={permission} className="pill">{permission}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
