function roleLabel(role?: string | null) {
  switch (role) {
    case 'platform_owner': return 'Platform Owner';
    case 'platform_admin': return 'Platform Admin';
    case 'platform_sme': return 'SME';
    case 'platform_agent': return 'Agent';
    case 'company_owner': return 'Company Owner';
    case 'company_admin': return 'Admin';
    case 'company_agent': return 'Agent';
    default: return role;
  }
}

export function WorkspaceBadge({ workspaceType, role }: { workspaceType?: string | null; role?: string | null }) {
  const label = workspaceType === 'business_verified'
    ? 'Verified business workspace'
    : workspaceType === 'individual'
      ? 'Individual workspace'
      : role?.startsWith('platform_')
        ? 'Platform control plane'
        : 'Workspace not provisioned';

  return (
    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: '#f3f4f6', color: '#374151', fontSize: 12 }}>
      <span>{label}</span>
      {role ? <span style={{ color: '#6b7280' }}>· {roleLabel(role)}</span> : null}
    </div>
  );
}
