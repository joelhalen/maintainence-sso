import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, Shield, Pencil, Trash2, X, ChevronRight, UserPlus, ShieldPlus } from 'lucide-react';
import api from '../api/client';
import { Group, GroupMember, PermissionRule, RuleAction, RuleEffect, TicketTypeValue, Location } from '../types';

const ACTION_LABELS: Record<RuleAction, string> = {
  VIEW: 'View tickets',
  COMMENT: 'Leave comments',
  UPDATE_STATUS: 'Update status',
  CLOSE: 'Close / complete',
  ASSIGN: 'Assign tickets',
  CREATE: 'Create tickets',
  EXPORT: 'Export tickets',
};

const EFFECT_STYLE: Record<RuleEffect, string> = {
  ALLOW: 'bg-green-100 text-green-700',
  DENY:  'bg-red-100 text-red-700',
};

const TICKET_TYPES: TicketTypeValue[] = ['CORRECTIVE', 'PREVENTIVE', 'INSPECTION', 'SAFETY', 'PROJECT'];

// ─── Colour swatch ────────────────────────────────────────────────────────────
const SWATCHES = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#f97316', '#14b8a6'];

export default function GroupsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: groups = [], isLoading } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then((r) => r.data),
  });

  const { data: group } = useQuery<Group>({
    queryKey: ['groups', selected],
    queryFn: () => api.get(`/groups/${selected}`).then((r) => r.data),
    enabled: !!selected,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/groups/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      setSelected(null);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">User Groups</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} /> New Group
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Group list */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
          ) : groups.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">No groups yet</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {groups.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => setSelected(g.id === selected ? null : g.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${g.id === selected ? 'bg-blue-50' : ''}`}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: g.color ?? '#6366f1' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{g.name}</div>
                      {g.description && <div className="text-xs text-gray-400 truncate">{g.description}</div>}
                    </div>
                    <div className="flex gap-2 text-xs text-gray-400 flex-shrink-0">
                      <span className="flex items-center gap-1"><Users size={12} />{g._count?.members ?? 0}</span>
                      <span className="flex items-center gap-1"><Shield size={12} />{g._count?.rules ?? 0}</span>
                    </div>
                    <ChevronRight size={14} className={`text-gray-300 transition-transform ${g.id === selected ? 'rotate-90' : ''}`} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Group detail */}
        {selected && group ? (
          <div className="lg:col-span-2 space-y-4">
            <GroupDetail
              group={group}
              onDelete={() => {
                if (window.confirm(`Delete group "${group.name}"?`)) deleteMutation.mutate(group.id);
              }}
              onRefresh={() => qc.invalidateQueries({ queryKey: ['groups', selected] })}
            />
          </div>
        ) : (
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl h-40 flex items-center justify-center text-gray-400 text-sm">
            Select a group to manage it
          </div>
        )}
      </div>

      {showCreate && (
        <CreateGroupModal
          onClose={() => setShowCreate(false)}
          onSuccess={(id) => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['groups'] }); setSelected(id); }}
        />
      )}
    </div>
  );
}

// ─── Group detail panel ───────────────────────────────────────────────────────

function GroupDetail({ group, onDelete, onRefresh }: { group: Group; onDelete: () => void; onRefresh: () => void }) {
  const qc = useQueryClient();
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/groups/${group.id}/members/${userId}`),
    onSuccess: onRefresh,
  });

  const removeRuleMutation = useMutation({
    mutationFn: (ruleId: string) => api.delete(`/groups/${group.id}/rules/${ruleId}`),
    onSuccess: onRefresh,
  });

  return (
    <>
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full" style={{ background: group.color ?? '#6366f1' }} />
            <div>
              <h2 className="text-base font-semibold text-gray-900">{group.name}</h2>
              {group.description && <p className="text-sm text-gray-500">{group.description}</p>}
            </div>
          </div>
          <button onClick={onDelete} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Members */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Users size={15} /> Members ({group.members?.length ?? 0})
          </h3>
          <button
            onClick={() => setShowAddMember(true)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <UserPlus size={13} /> Add member
          </button>
        </div>
        {group.members?.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-gray-400">No members yet</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {group.members?.map((m: GroupMember) => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {m.user.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{m.user.name}</div>
                  <div className="text-xs text-gray-400">{m.user.email} · {m.user.role.name}</div>
                </div>
                <button
                  onClick={() => removeMemberMutation.mutate(m.user.id)}
                  disabled={removeMemberMutation.isPending}
                  className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Permission rules */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Shield size={15} /> Permission Rules ({group.rules?.length ?? 0})
          </h3>
          <button
            onClick={() => setShowAddRule(true)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <ShieldPlus size={13} /> Add rule
          </button>
        </div>
        {group.rules?.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-gray-400">
            No rules — members inherit permissions from their role only
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Effect', 'Action', 'Location', 'Ticket Type', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.rules?.map((r: PermissionRule) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${EFFECT_STYLE[r.effect]}`}>{r.effect}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{ACTION_LABELS[r.action]}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{r.location?.name ?? <span className="text-gray-300">All locations</span>}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{r.ticketType ?? <span className="text-gray-300">All types</span>}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => removeRuleMutation.mutate(r.id)}
                      disabled={removeRuleMutation.isPending}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddMember && (
        <AddMemberModal
          groupId={group.id}
          existingMemberIds={(group.members ?? []).map((m: GroupMember) => m.user.id)}
          onClose={() => setShowAddMember(false)}
          onSuccess={() => { setShowAddMember(false); onRefresh(); qc.invalidateQueries({ queryKey: ['groups'] }); }}
        />
      )}

      {showAddRule && (
        <AddRuleModal
          groupId={group.id}
          onClose={() => setShowAddRule(false)}
          onSuccess={() => { setShowAddRule(false); onRefresh(); qc.invalidateQueries({ queryKey: ['groups'] }); }}
        />
      )}
    </>
  );
}

// ─── Create group modal ───────────────────────────────────────────────────────

function CreateGroupModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (id: string) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(SWATCHES[0]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      const { data } = await api.post('/groups', { name, description, color });
      onSuccess(data.id);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to create group');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold">New Group</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Colour</label>
            <div className="flex gap-2">
              {SWATCHES.map((s) => (
                <button key={s} type="button" onClick={() => setColor(s)}
                  className={`w-6 h-6 rounded-full transition-transform ${color === s ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                  style={{ background: s }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
              {submitting ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add member modal ─────────────────────────────────────────────────────────

function AddMemberModal({ groupId, existingMemberIds, onClose, onSuccess }: {
  groupId: string; existingMemberIds: string[]; onClose: () => void; onSuccess: () => void;
}) {
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<string | null>(null);

  const { data: users = [] } = useQuery<{ id: string; name: string; email: string; role: { name: string } }[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const filtered = users.filter((u) =>
    !existingMemberIds.includes(u.id) &&
    (u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
  );

  const add = async (userId: string) => {
    setAdding(userId);
    try { await api.post(`/groups/${groupId}/members`, { userId }); onSuccess(); }
    catch { setAdding(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold">Add Member</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="p-4 border-b border-gray-100 flex-shrink-0">
          <input placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <ul className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filtered.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-5 py-3">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                {u.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{u.name}</div>
                <div className="text-xs text-gray-400">{u.email} · {u.role.name}</div>
              </div>
              <button onClick={() => add(u.id)} disabled={adding === u.id}
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium disabled:opacity-50 hover:bg-blue-700">
                {adding === u.id ? '…' : 'Add'}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-gray-400">No users to add</li>
          )}
        </ul>
        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Done</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add rule modal ───────────────────────────────────────────────────────────

function AddRuleModal({ groupId, onClose, onSuccess }: { groupId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ action: 'VIEW' as RuleAction, effect: 'ALLOW' as RuleEffect, locationId: '', ticketType: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => api.get('/locations').then((r) => r.data),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      await api.post(`/groups/${groupId}/rules`, {
        action: form.action,
        effect: form.effect,
        locationId: form.locationId || null,
        ticketType: form.ticketType || null,
      });
      onSuccess();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to add rule');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold">Add Permission Rule</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
            Rules refine what this group can do beyond their assigned role. DENY overrides ALLOW.
            Leave location/type blank to apply the rule everywhere.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Effect</label>
              <select value={form.effect} onChange={(e) => setForm((f) => ({ ...f, effect: e.target.value as RuleEffect }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="ALLOW">ALLOW</option>
                <option value="DENY">DENY</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Action</label>
              <select value={form.action} onChange={(e) => setForm((f) => ({ ...f, action: e.target.value as RuleAction }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {(Object.entries(ACTION_LABELS) as [RuleAction, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Location (optional — blank = all)</label>
            <select value={form.locationId} onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">All locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ticket Type (optional — blank = all)</label>
            <select value={form.ticketType} onChange={(e) => setForm((f) => ({ ...f, ticketType: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">All types</option>
              {TICKET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
              {submitting ? 'Adding…' : 'Add Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
