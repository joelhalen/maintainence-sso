import { useParams, Link } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Shield } from 'lucide-react';
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

// ─── Permission categories ────────────────────────────────────────────────────

interface PermissionCategory {
  label: string;
  permissions: Permission[];
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    label: 'Tickets',
    permissions: [
      'TICKET_CREATE',
      'TICKET_READ',
      'TICKET_UPDATE',
      'TICKET_DELETE',
      'TICKET_ASSIGN',
      'TICKET_CLOSE',
      'TICKET_EXPORT',
    ],
  },
  {
    label: 'Users',
    permissions: [
      'USER_CREATE',
      'USER_READ',
      'USER_UPDATE',
      'USER_DELETE',
      'USER_ASSIGN_ROLE',
    ],
  },
  {
    label: 'Locations',
    permissions: [
      'LOCATION_CREATE',
      'LOCATION_READ',
      'LOCATION_UPDATE',
      'LOCATION_DELETE',
    ],
  },
  {
    label: 'Assets',
    permissions: [
      'ASSET_CREATE',
      'ASSET_READ',
      'ASSET_UPDATE',
      'ASSET_DELETE',
    ],
  },
  {
    label: 'Admin & Reports',
    permissions: [
      'REPORT_VIEW',
      'REPORT_EXPORT',
      'ADMIN_PANEL',
      'AUDIT_LOG_VIEW',
      'EMAIL_SETTINGS',
      'GROUP_MANAGE',
    ],
  },
];

const PERMISSION_LABEL: Record<Permission, string> = {
  TICKET_CREATE: 'Create Tickets',
  TICKET_READ: 'View Tickets',
  TICKET_UPDATE: 'Edit Tickets',
  TICKET_DELETE: 'Delete Tickets',
  TICKET_ASSIGN: 'Assign Tickets',
  TICKET_CLOSE: 'Close Tickets',
  TICKET_EXPORT: 'Export Tickets',
  USER_CREATE: 'Create Users',
  USER_READ: 'View Users',
  USER_UPDATE: 'Edit Users',
  USER_DELETE: 'Delete Users',
  USER_ASSIGN_ROLE: 'Assign Roles',
  LOCATION_CREATE: 'Create Locations',
  LOCATION_READ: 'View Locations',
  LOCATION_UPDATE: 'Edit Locations',
  LOCATION_DELETE: 'Delete Locations',
  ASSET_CREATE: 'Create Assets',
  ASSET_READ: 'View Assets',
  ASSET_UPDATE: 'Edit Assets',
  ASSET_DELETE: 'Delete Assets',
  REPORT_VIEW: 'View Reports',
  REPORT_EXPORT: 'Export Reports',
  ADMIN_PANEL: 'Admin Panel',
  AUDIT_LOG_VIEW: 'Audit Logs',
  EMAIL_SETTINGS: 'Email Settings',
  GROUP_MANAGE: 'Manage Groups',
};

const CATEGORY_ACCENT: Record<string, string> = {
  Tickets: 'bg-blue-50 text-blue-700 border-blue-100',
  Users: 'bg-violet-50 text-violet-700 border-violet-100',
  Locations: 'bg-green-50 text-green-700 border-green-100',
  Assets: 'bg-amber-50 text-amber-700 border-amber-100',
  'Admin & Reports': 'bg-red-50 text-red-700 border-red-100',
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-40" />
      <div className="h-8 bg-gray-200 rounded w-64" />
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="h-14 bg-gray-50 border-b border-gray-100 flex gap-4 px-4 items-center">
          <div className="h-4 bg-gray-200 rounded w-32" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 bg-gray-200 rounded w-20 flex-1" />
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-10 border-b border-gray-50 flex gap-4 px-4 items-center">
            <div className="h-3 bg-gray-100 rounded w-28" />
            {[0, 1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="h-4 w-4 bg-gray-100 rounded flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlatformRolesPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const qc = useQueryClient();
  const [savingRoleId, setSavingRoleId] = useState('');

  const { data, isLoading } = useQuery<RolesResponse>({
    queryKey: ['platform-roles', organizationId],
    queryFn: () =>
      api.get(`/platform/organizations/${organizationId}/roles`).then((r) => r.data),
    enabled: !!organizationId,
  });

  // Build a fast lookup set per role: roleId → Set<Permission>
  // We keep this derived from server state; local optimistic updates are applied
  // via query invalidation after each PATCH.
  const permissionSets = useCallback(
    (roles: Role[]): Map<string, Set<Permission>> => {
      const map = new Map<string, Set<Permission>>();
      for (const role of roles) {
        map.set(role.id, new Set(role.permissions));
      }
      return map;
    },
    [],
  );

  const togglePermission = useCallback(
    async (role: Role, permission: Permission) => {
      const has = role.permissions.includes(permission);
      const next = has
        ? role.permissions.filter((p) => p !== permission)
        : [...role.permissions, permission];

      setSavingRoleId(role.id);
      try {
        await api.patch(
          `/platform/organizations/${organizationId}/roles/${role.id}`,
          { permissions: next },
        );
        qc.invalidateQueries({ queryKey: ['platform-roles', organizationId] });
      } finally {
        setSavingRoleId('');
      }
    },
    [organizationId, qc],
  );

  if (isLoading) return <LoadingSkeleton />;

  const roles = data?.roles ?? [];
  const permSets = permissionSets(roles);

  // Collect only the permissions that actually exist in the server response
  // (so the matrix respects what the API says is available).
  const availablePerms = new Set(data?.permissions ?? []);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <Link
          to="/platform/organizations"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mb-3 transition-colors"
        >
          <ArrowLeft size={14} />
          Organizations
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Shield size={20} className="text-indigo-500" />
              Role Permissions
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Organization <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{organizationId}</span>
              {' '}— permissions combine with subscription entitlements.
            </p>
          </div>
          {savingRoleId && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 font-medium">
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Saving...
            </div>
          )}
        </div>
      </div>

      {/* Permission matrix */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {/* Permission label column header */}
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50 z-10 min-w-[180px] border-r border-gray-100">
                  Permission
                </th>
                {/* Role column headers */}
                {roles.map((role) => {
                  const count = role.permissions.length;
                  const isSaving = savingRoleId === role.id;
                  return (
                    <th
                      key={role.id}
                      className="text-center px-3 py-3.5 min-w-[120px] relative"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-xs font-semibold truncate max-w-[110px] ${isSaving ? 'text-blue-600' : 'text-gray-700'}`}>
                          {role.name}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isSaving ? 'bg-blue-100 text-blue-700' : 'bg-indigo-50 text-indigo-600'}`}>
                          {count} {count === 1 ? 'permission' : 'permissions'}
                        </span>
                        {isSaving && (
                          <div className="absolute inset-0 bg-blue-50/40 pointer-events-none rounded" />
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_CATEGORIES.map((category) => {
                // Only show permissions that the server says are available
                const catPerms = category.permissions.filter((p) =>
                  availablePerms.size === 0 ? true : availablePerms.has(p),
                );
                if (catPerms.length === 0) return null;

                return (
                  <>
                    {/* Category section header */}
                    <tr key={`cat-${category.label}`} className="bg-gray-50/70">
                      <td
                        colSpan={roles.length + 1}
                        className="sticky left-0 px-5 py-2 border-y border-gray-100"
                      >
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${CATEGORY_ACCENT[category.label] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}
                        >
                          {category.label}
                        </span>
                      </td>
                    </tr>

                    {/* Permission rows */}
                    {catPerms.map((permission) => (
                      <tr
                        key={permission}
                        className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors group"
                      >
                        {/* Permission label */}
                        <td className="px-5 py-2.5 sticky left-0 bg-white group-hover:bg-blue-50/30 z-10 border-r border-gray-100 transition-colors">
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-800 font-medium">
                              {PERMISSION_LABEL[permission]}
                            </span>
                            <span className="text-xs text-gray-400 font-mono">
                              {permission}
                            </span>
                          </div>
                        </td>

                        {/* Checkbox per role */}
                        {roles.map((role) => {
                          const checked = permSets.get(role.id)?.has(permission) ?? false;
                          const isSavingThis = savingRoleId === role.id;
                          return (
                            <td key={role.id} className="text-center px-3 py-2.5 relative">
                              {isSavingThis && (
                                <div className="absolute inset-0 bg-blue-50/50 pointer-events-none" />
                              )}
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!!savingRoleId}
                                onChange={() => togglePermission(role, permission)}
                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {roles.length === 0 && (
          <div className="py-16 text-center">
            <Shield size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No roles found for this organization</p>
            <p className="text-xs text-gray-400 mt-1">
              Roles are created automatically when users join.
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      {roles.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          Click any checkbox to immediately save the change. Rows highlighted in blue indicate an
          active save operation.
        </p>
      )}
    </div>
  );
}
