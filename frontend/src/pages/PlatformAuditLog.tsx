import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, AlertCircle } from 'lucide-react';
import api from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  notes?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
}

interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  pages: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'LOGIN_FAILED',
  'PASSWORD_CHANGE',
  'ROLE_CHANGE',
  'STATUS_CHANGE',
  'ASSIGN',
  'UNASSIGN',
  'EXPORT',
  'SIGN',
] as const;

type AuditAction = (typeof AUDIT_ACTIONS)[number];

const ACTION_BADGE: Record<AuditAction, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN: 'bg-gray-100 text-gray-600',
  LOGOUT: 'bg-gray-100 text-gray-500',
  LOGIN_FAILED: 'bg-red-100 text-red-700',
  PASSWORD_CHANGE: 'bg-amber-100 text-amber-700',
  ROLE_CHANGE: 'bg-violet-100 text-violet-700',
  STATUS_CHANGE: 'bg-indigo-100 text-indigo-700',
  ASSIGN: 'bg-orange-100 text-orange-700',
  UNASSIGN: 'bg-orange-100 text-orange-700',
  EXPORT: 'bg-teal-100 text-teal-700',
  SIGN: 'bg-purple-100 text-purple-700',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateId(id?: string | null): string {
  if (!id) return '—';
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function isKnownAction(action: string): action is AuditAction {
  return AUDIT_ACTIONS.includes(action as AuditAction);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const className = isKnownAction(action)
    ? ACTION_BADGE[action]
    : 'bg-gray-100 text-gray-600';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-gray-200 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

function ExpandedDetails({ log }: { log: AuditLog }) {
  const hasOld = log.oldValues != null;
  const hasNew = log.newValues != null;

  return (
    <tr className="bg-gray-50 border-b border-gray-100">
      <td colSpan={6} className="px-4 py-4">
        <div className="space-y-3">
          {(log.notes || log.ipAddress || log.userAgent) && (
            <div className="grid gap-3 sm:grid-cols-3 text-xs text-gray-600">
              {log.notes && (
                <div>
                  <p className="font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                  <p>{log.notes}</p>
                </div>
              )}
              {log.ipAddress && (
                <div>
                  <p className="font-semibold text-gray-500 uppercase tracking-wide mb-1">IP Address</p>
                  <p className="font-mono">{log.ipAddress}</p>
                </div>
              )}
              {log.userAgent && (
                <div>
                  <p className="font-semibold text-gray-500 uppercase tracking-wide mb-1">User Agent</p>
                  <p className="truncate" title={log.userAgent}>{log.userAgent}</p>
                </div>
              )}
            </div>
          )}

          {(hasOld || hasNew) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {hasOld && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Previous Values
                  </p>
                  <pre className="text-xs bg-red-50 border border-red-100 rounded-lg p-3 overflow-x-auto text-red-800 font-mono leading-relaxed whitespace-pre-wrap">
                    {JSON.stringify(log.oldValues, null, 2)}
                  </pre>
                </div>
              )}
              {hasNew && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    New Values
                  </p>
                  <pre className="text-xs bg-green-50 border border-green-100 rounded-lg p-3 overflow-x-auto text-green-800 font-mono leading-relaxed whitespace-pre-wrap">
                    {JSON.stringify(log.newValues, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {!hasOld && !hasNew && !log.notes && !log.ipAddress && !log.userAgent && (
            <p className="text-xs text-gray-400">No additional details available.</p>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlatformAuditLogPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [debouncedResource, setDebouncedResource] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Debounce resource filter
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedResource(resourceFilter);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [resourceFilter]);

  // Reset page when action filter changes
  useEffect(() => {
    setPage(1);
  }, [actionFilter]);

  const queryParams = new URLSearchParams({ page: String(page), limit: '50' });
  if (actionFilter) queryParams.set('action', actionFilter);
  if (debouncedResource) queryParams.set('resource', debouncedResource);

  const { data, isLoading, isError } = useQuery<AuditLogResponse>({
    queryKey: ['platform-audit', page, actionFilter, debouncedResource],
    queryFn: () => api.get(`/platform/audit?${queryParams}`).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const hasFilters = !!actionFilter || !!debouncedResource;

  const clearFilters = () => {
    setActionFilter('');
    setResourceFilter('');
    setDebouncedResource('');
    setPage(1);
  };

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tamper-evident record of all administrative and user actions.
          </p>
        </div>
        {data && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {data.total.toLocaleString()} total records
          </span>
        )}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">All Actions</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
          ))}
        </select>

        <input
          type="search"
          placeholder="Filter by resource…"
          value={resourceFilter}
          onChange={(e) => setResourceFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
        />

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-gray-500 hover:text-gray-800 underline underline-offset-2 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Error state */}
      {isError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle size={14} /> Failed to load audit logs.
        </div>
      )}

      {/* Log table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Timestamp', 'User', 'Action', 'Resource', 'Resource ID', 'IP Address'].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading
              ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
              : data?.logs.map((log) => (
                  <>
                    <tr
                      key={log.id}
                      onClick={() => toggleExpanded(log.id)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <ChevronRight
                            size={12}
                            className={`flex-shrink-0 text-gray-400 transition-transform ${
                              expandedId === log.id ? 'rotate-90' : ''
                            }`}
                          />
                          {formatTimestamp(log.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {log.user ? (
                          <>
                            <div className="font-medium text-gray-900">{log.user.name}</div>
                            <div className="text-xs text-gray-400">{log.user.email}</div>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 italic">System</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{log.resource}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500" title={log.resourceId ?? undefined}>
                        {truncateId(log.resourceId)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                        {log.ipAddress ?? '—'}
                      </td>
                    </tr>
                    {expandedId === log.id && <ExpandedDetails key={`${log.id}-detail`} log={log} />}
                  </>
                ))}

            {!isLoading && data?.logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                  No audit log entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-gray-500">
            Page {data.page} of {data.pages} · {data.total.toLocaleString()} total records
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              disabled={page >= data.pages || isLoading}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
