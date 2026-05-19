import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Shield, Trash2, ChevronRight, ShieldPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import { OrganizationSubscriptionResponse, PermissionRule, RuleAction, RuleEffect, TicketTypeValue, Location } from '../types';
import { isLimitReached, limitMessage } from '../components/SubscriptionUsage';

interface Role { id: string; name: string; description?: string; }

interface UserRow {
  id: string; name: string; email: string; role: Role;
  department?: string; active: boolean; lastLoginAt?: string;
}

const ACTION_LABELS: Record<RuleAction, string> = {
  VIEW: 'View tickets', COMMENT: 'Leave comments', UPDATE_STATUS: 'Update status',
  CLOSE: 'Close / complete', ASSIGN: 'Assign tickets', CREATE: 'Create tickets', EXPORT: 'Export tickets',
};

const TICKET_TYPES: TicketTypeValue[] = ['CORRECTIVE', 'PREVENTIVE', 'INSPECTION', 'SAFETY', 'PROJECT'];

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery<UserRow[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: hasPermission('USER_READ'),
  });
  const { data: subscription } = useQuery<OrganizationSubscriptionResponse>({
    queryKey: ['organization-me'],
    queryFn: () => api.get('/organizations/me').then((r) => r.data),
    enabled: hasPermission('USER_READ'),
  });

  const userLimitReached = isLimitReached(subscription?.organization, subscription?.usage, 'activeUsers');

  if (!hasPermission('USER_READ')) {
    return <div className="text-center py-12 text-gray-400">You don't have permission to view users.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Users</h1>
        {hasPermission('USER_CREATE') && (
          userLimitReached ? (
            <button
              disabled
              title={subscription ? limitMessage(subscription.organization, 'activeUsers') : undefined}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium opacity-50 cursor-not-allowed"
            >
              <Plus size={16} /> Add User
            </button>
          ) : (
            <Link
              to="/users/new"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} /> Add User
            </Link>
          )
        )}
      </div>
      {userLimitReached && subscription && (
        <div className="bg-amber-50 text-amber-800 text-sm px-4 py-3 rounded-lg">
          {limitMessage(subscription.organization, 'activeUsers')} Upgrade to add more users.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading users...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Email', 'Role', 'Department', 'Status', 'Last Login', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <React.Fragment key={u.id}>
                  <tr className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                          {u.name[0].toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{u.role.name}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.department ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {hasPermission('GROUP_MANAGE') && (
                          <button
                            onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                            title="Permission rules"
                            className="text-gray-400 hover:text-purple-600 p-1"
                          >
                            <Shield size={14} />
                          </button>
                        )}
                        {hasPermission('USER_UPDATE') && (
                          <Link to={`/users/${u.id}/edit`} className="text-gray-400 hover:text-blue-600 p-1">
                            <Pencil size={14} />
                          </Link>
                        )}
                        <ChevronRight size={14} className={`text-gray-300 transition-transform ${expandedUser === u.id ? 'rotate-90' : ''}`} />
                      </div>
                    </td>
                  </tr>
                  {expandedUser === u.id && (
                    <tr key={`${u.id}-rules`} className="bg-purple-50/40">
                      <td colSpan={7} className="px-6 py-4">
                        <UserRulesPanel userId={u.id} userName={u.name} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

function UserRulesPanel({ userId, userName }: { userId: string; userName: string }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<{ action: RuleAction; effect: RuleEffect; locationId: string; ticketType: string }>({
    action: 'VIEW', effect: 'ALLOW', locationId: '', ticketType: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const { data: rules = [], isLoading } = useQuery<PermissionRule[]>({
    queryKey: ['user-rules', userId],
    queryFn: () => api.get(`/permission-rules?userId=${userId}`).then((r) => r.data),
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => api.get('/locations').then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/permission-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-rules', userId] }),
  });

  const addRule = async () => {
    setSubmitting(true);
    try {
      await api.post('/permission-rules', {
        userId,
        action: form.action,
        effect: form.effect,
        locationId: form.locationId || undefined,
        ticketType: form.ticketType || undefined,
      });
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ['user-rules', userId] });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <div className="text-xs text-gray-400">Loading rules…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
          <Shield size={13} className="text-purple-600" />
          Direct permission rules for {userName}
        </span>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1 text-xs px-2.5 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          <ShieldPlus size={12} /> Add rule
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-lg p-3 border border-purple-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
              <select value={form.action} onChange={(e) => setForm((f) => ({ ...f, action: e.target.value as RuleAction }))} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs">
                {(Object.keys(ACTION_LABELS) as RuleAction[]).map((a) => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Effect</label>
              <select value={form.effect} onChange={(e) => setForm((f) => ({ ...f, effect: e.target.value as RuleEffect }))} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs">
                <option value="ALLOW">Allow</option>
                <option value="DENY">Deny</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location (optional)</label>
              <select value={form.locationId} onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs">
                <option value="">All locations</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ticket type (optional)</label>
              <select value={form.ticketType} onChange={(e) => setForm((f) => ({ ...f, ticketType: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs">
                <option value="">All types</option>
                {TICKET_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addRule} disabled={submitting} className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50">Save</button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1 text-gray-500 text-xs hover:text-gray-800">Cancel</button>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <p className="text-xs text-gray-400">No direct rules. This user relies on their role and group memberships.</p>
      ) : (
        <div className="space-y-1.5">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded font-medium ${r.effect === 'ALLOW' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.effect}</span>
                <span className="text-gray-700">{ACTION_LABELS[r.action]}</span>
                {r.location && <span className="text-gray-400">@ {r.location.name}</span>}
                {r.ticketType && <span className="bg-gray-100 text-gray-600 px-1.5 rounded">{r.ticketType}</span>}
              </div>
              <button onClick={() => deleteMutation.mutate(r.id)} className="text-gray-300 hover:text-red-500 p-0.5 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
