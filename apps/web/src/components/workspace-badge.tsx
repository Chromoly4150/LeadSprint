export function WorkspaceBadge({ workspaceType, role }: { workspaceType?: string | null; role?: string | null }) {
  const label = workspaceType === 'business_verified'
    ? 'Verified business workspace'
    : workspaceType === 'individual'
      ? 'Individual workspace'
      : 'Workspace not provisioned';

  return (
    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: '#f3f4f6', color: '#374151', fontSize: 12 }}>
      <span>{label}</span>
      {role ? <span style={{ color: '#6b7280' }}>· {role}</span> : null}
    </div>
  );
}
