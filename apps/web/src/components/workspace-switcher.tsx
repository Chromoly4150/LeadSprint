import { switchWorkspaceAction } from '../app/(protected)/settings/actions';

type Workspace = {
  id: string;
  name: string;
  slug?: string;
  workspaceType?: string;
  environment?: string;
  membershipRole?: string;
  active?: boolean;
};

export function WorkspaceSwitcher({ workspaces }: { workspaces: Workspace[] }) {
  if (!workspaces?.length) return null;
  const active = workspaces.find((workspace) => workspace.active) || workspaces[0];

  return (
    <form action={switchWorkspaceAction} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <label style={{ fontSize: 12, color: '#6b7280' }}>Workspace</label>
      <select name="workspaceId" defaultValue={active.id} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db', background: '#fff' }}>
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}{workspace.environment === 'internal_test' ? ' (internal test)' : ''}
          </option>
        ))}
      </select>
      <button type="submit" style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #d1d5db', background: '#fff' }}>Switch</button>
    </form>
  );
}
