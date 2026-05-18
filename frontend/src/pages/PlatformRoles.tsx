import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Permission } from '../types';

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
}

interface RolesResponse {
  roles: Role[];
  permissions: Permission[];
}

export default function PlatformRolesPage() {
  const { organizationId } = useParams();
  const qc = useQueryClient();
  const [savingId, setSavingId] = useState('');
  const { data, isLoading } = useQuery<RolesResponse>({
    queryKey: ['platform-roles', organizationId],
    queryFn: () => api.get(`/platform/organizations/${organizationId}/roles`).then((r) => r.data),
    enabled: !!organizationId,
  });

  const togglePermission = async (role: Role, permission: Permission) => {
    const next = role.permissions.includes(permission)
      ? role.permissions.filter((p) => p !== permission)
      : [...role.permissions, permission];
    setSavingId(role.id);
    try {
      await api.patch(`/platform/organizations/${organizationId}/roles/${role.id}`, { permissions: next });
      qc.invalidateQueries({ queryKey: ['platform-roles', organizationId] });
    } finally {
      setSavingId('');
    }
  };

  if (isLoading) return <div className="text-sm text-gray-400">Loading roles...</div>;

  return (
    <div className="space-y-4">
      <div>
        <Link to="/platform/organizations" className="text-sm text-blue-600 hover:text-blue-700">Back to organizations</Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-2">Role Permissions</h1>
        <p className="text-sm text-gray-500 mt-1">Change what each organization role can do. These permissions combine with subscription entitlements.</p>
      </div>

      <div className="space-y-4">
        {data?.roles.map((role) => (
          <div key={role.id} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">{role.name}</h2>
                <p className="text-xs text-gray-500">{role.description}</p>
              </div>
              {savingId === role.id && <span className="text-xs text-gray-400">Saving...</span>}
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {data.permissions.map((permission) => (
                <label key={permission} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={role.permissions.includes(permission)}
                    disabled={savingId === role.id}
                    onChange={() => togglePermission(role, permission)}
                    className="rounded"
                  />
                  {permission}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
