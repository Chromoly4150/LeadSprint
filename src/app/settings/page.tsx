import { AppShell } from '@/components/app-shell';
import { PermissionGuard } from '@/components/permission-guard';
import { listAssignees, listAuditLogs, listPermissionOverrides } from '@/lib/db';
import { allPermissions, getCurrentUser, getUserPermissionState, rolePermissionMatrix } from '@/lib/permissions';
import { clearPermissionOverrideAction, setActingUserAction, setPermissionOverrideAction } from '@/app/settings/actions';

export default async function SettingsPage() {
  const matrix = rolePermissionMatrix();
  const users = listAssignees();
  const currentUser = await getCurrentUser();
  const permissionState = await getUserPermissionState(currentUser);
  const overrides = listPermissionOverrides();
  const auditLogs = listAuditLogs(25);
  const organizationId = users[0]?.organizationId ?? 'org_demo';

  return (
    <AppShell title="Settings" subtitle="Session and permission scaffold">
      <header className="page-header">
        <div>
          <p className="eyebrow">Permissions</p>
          <h2>Role capability matrix</h2>
          <p className="muted">Lightweight app-session selection plus DB-backed permission overrides.</p>
        </div>
      </header>

      <section className="split-grid">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Acting user</p>
              <h3>Session context</h3>
            </div>
          </div>
          <form action={setActingUserAction} className="inline-form">
            <label>
              <span>Current acting user</span>
              <select name="userId" defaultValue={currentUser.id}>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name} · {user.role}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="button-primary">Switch user</button>
          </form>
          <div className="note-card">
            <div className="note-header">
              <strong>{currentUser.name}</strong>
              <span className="muted">{currentUser.role}</span>
            </div>
            <div className="permission-chips">
              {permissionState.allowed.map((permission) => (
                <span key={permission} className="pill">{permission}</span>
              ))}
            </div>
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Overrides</p>
              <h3>User-specific permission changes</h3>
            </div>
          </div>
          <PermissionGuard permission="permissions.manage" fallback={<p className="muted">Your role cannot manage permission overrides.</p>}>
            <form action={setPermissionOverrideAction} className="stack form-stack">
              <input type="hidden" name="organizationId" value={organizationId} />
              <div className="field-grid">
                <label>
                  <span>User</span>
                  <select name="userId" defaultValue={currentUser.id}>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.name} · {user.role}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Effect</span>
                  <select name="effect" defaultValue="deny">
                    <option value="allow">Allow</option>
                    <option value="deny">Deny</option>
                  </select>
                </label>
              </div>
              <label>
                <span>Permission</span>
                <select name="permissionKey" defaultValue="exports.run">
                  {allPermissions.map((permission) => (
                    <option key={permission} value={permission}>{permission}</option>
                  ))}
                </select>
              </label>
              <button type="submit" className="button-secondary">Save override</button>
            </form>
          </PermissionGuard>
        </article>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Override table</p>
            <h3>Persisted permission assignments</h3>
          </div>
        </div>
        <div className="stack">
          {overrides.length ? overrides.map((override) => {
            const user = users.find((entry) => entry.id === override.subjectId);
            return (
              <div key={override.id} className="note-card">
                <div className="note-header">
                  <strong>{user?.name ?? override.subjectId}</strong>
                  <span className="muted">{override.effect} · {override.permissionKey}</span>
                </div>
                <PermissionGuard permission="permissions.manage">
                  <form action={clearPermissionOverrideAction} className="toolbar">
                    <input type="hidden" name="userId" value={override.subjectId} />
                    <input type="hidden" name="permissionKey" value={override.permissionKey} />
                    <button type="submit" className="button-secondary">Clear override</button>
                  </form>
                </PermissionGuard>
              </div>
            );
          }) : <p className="muted">No permission overrides have been saved yet.</p>}
        </div>
      </section>

      <section className="split-grid">
        <article className="card">
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
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Audit trail</p>
              <h3>Recent sensitive actions</h3>
            </div>
          </div>
          <div className="stack">
            {auditLogs.length ? auditLogs.map((entry) => (
              <div key={entry.id} className="note-card">
                <div className="note-header">
                  <strong>{entry.actorName}</strong>
                  <span className="muted">{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
                <div className="muted smallcaps">{entry.action}</div>
                <p className="muted">{entry.targetType} · {entry.targetId}</p>
              </div>
            )) : <p className="muted">No audit entries yet.</p>}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
