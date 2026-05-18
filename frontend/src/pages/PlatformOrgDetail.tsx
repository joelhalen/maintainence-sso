import { useState } from 'react';
import type { ElementType } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  X,
  Shield,
  Edit2,
  Save,
  AlertCircle,
  Users,
  MapPin,
  Wrench,
  Ticket,
} from 'lucide-react';
import api from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  name: string;
  tier: string;
  monthlyPriceCents?: number | null;
  maxActiveUsers?: number | null;
  maxLocations?: number | null;
  maxAssets?: number | null;
  maxActiveTickets?: number | null;
  allowPush: boolean;
  allowSso: boolean;
  allowExports: boolean;
}

interface OrgUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  isPlatformAdmin: boolean;
  createdAt: string;
  role: { name: string } | null;
}

interface OrgRole {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
}

interface RecentTicket {
  id: string;
  ticketNumber: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
}

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  subscription?: {
    status: string;
    providerCustomerId?: string | null;
    paypalSubscriptionId?: string | null;
    plan: Plan;
  };
  users: OrgUser[];
  roles: OrgRole[];
  _count: { users: number; locations: number; assets: number; tickets: number };
  activeTicketCount: number;
  recentTickets: RecentTicket[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'];

const TIER_BADGE: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-600',
  STARTER: 'bg-blue-100 text-blue-700',
  PROFESSIONAL: 'bg-indigo-100 text-indigo-700',
  ENTERPRISE: 'bg-violet-100 text-violet-700',
};

const SUB_STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  TRIALING: 'bg-blue-100 text-blue-700',
  PAST_DUE: 'bg-amber-100 text-amber-700',
  CANCELED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
};

const TICKET_STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-500',
  ON_HOLD: 'bg-gray-100 text-gray-600',
  PENDING_PARTS: 'bg-orange-100 text-orange-700',
  PENDING_REVIEW: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const PRIORITY_BADGE: Record<string, string> = {
  LOW: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label.replace(/_/g, ' ')}
    </span>
  );
}

function formatPrice(cents?: number | null): string {
  if (cents == null) return 'Custom';
  return `$${(cents / 100).toFixed(2)}/mo`;
}

function formatLimit(val?: number | null, label?: string): string {
  if (val == null) return '∞ unlimited';
  return label ? `${val} ${label}` : String(val);
}

function permissionCategory(permission: string): string {
  const prefix = permission.split('_')[0];
  return prefix ?? 'OTHER';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FeatureFlag({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {enabled ? (
        <Check size={14} className="text-green-600 flex-shrink-0" />
      ) : (
        <X size={14} className="text-red-400 flex-shrink-0" />
      )}
      <span className={enabled ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
}: {
  label: string;
  value: number;
  icon: ElementType;
  iconBg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{value}</p>
        </div>
        <div className={`${iconBg} p-2.5 rounded-lg flex-shrink-0`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  org: OrgDetail;
  onClose: () => void;
  onSaved: () => void;
}

function EditModal({ org, onClose, onSaved }: EditModalProps) {
  const [name, setName] = useState(org.name);
  const [active, setActive] = useState(org.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await api.patch(`/platform/organizations/${org.id}`, { name, active });
      onSaved();
      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Edit Organization</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Organization Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded"
            />
            Active
          </label>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ org }: { org: OrgDetail }) {
  const plan = org.subscription?.plan;
  const subStatus = org.subscription?.status;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Users" value={org._count.users} icon={Users} iconBg="bg-blue-600" />
          <StatCard label="Locations" value={org._count.locations} icon={MapPin} iconBg="bg-green-600" />
          <StatCard label="Assets" value={org._count.assets} icon={Wrench} iconBg="bg-orange-500" />
          <StatCard label="Active Tickets" value={org.activeTicketCount} icon={Ticket} iconBg="bg-indigo-600" />
        </div>

        {/* Subscription card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Subscription</p>
              {plan ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      label={plan.tier}
                      className={TIER_BADGE[plan.tier] ?? 'bg-gray-100 text-gray-600'}
                    />
                    <span className="text-sm font-semibold text-gray-900">{plan.name}</span>
                  </div>
                </>
              ) : (
                <span className="text-sm text-gray-400">No plan</span>
              )}
            </div>
            {subStatus && (
              <Badge
                label={subStatus}
                className={SUB_STATUS_BADGE[subStatus] ?? 'bg-gray-100 text-gray-600'}
              />
            )}
          </div>

          {plan && (
            <>
              <div className="text-sm font-medium text-gray-700">{formatPrice(plan.monthlyPriceCents)}</div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Features</p>
                <FeatureFlag label="Push Notifications" enabled={plan.allowPush} />
                <FeatureFlag label="Single Sign-On" enabled={plan.allowSso} />
                <FeatureFlag label="Data Exports" enabled={plan.allowExports} />
              </div>

              <div className="space-y-1.5 pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Limits</p>
                {(
                  [
                    ['Max Users', plan.maxActiveUsers],
                    ['Max Locations', plan.maxLocations],
                    ['Max Assets', plan.maxAssets],
                    ['Max Active Tickets', plan.maxActiveTickets],
                  ] as [string, number | null | undefined][]
                ).map(([label, val]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium text-gray-700">{formatLimit(val)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent tickets */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Recent Tickets</h3>
        </div>
        {org.recentTickets.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">No tickets yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Ticket #', 'Title', 'Status', 'Priority', 'Created'].map((h) => (
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
              {org.recentTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{ticket.ticketNumber}</td>
                  <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{ticket.title}</td>
                  <td className="px-4 py-3">
                    <Badge
                      label={ticket.status}
                      className={TICKET_STATUS_BADGE[ticket.status] ?? 'bg-gray-100 text-gray-600'}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      label={ticket.priority}
                      className={PRIORITY_BADGE[ticket.priority] ?? 'bg-gray-100 text-gray-600'}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Users ───────────────────────────────────────────────────────────────

function UsersTab({ org }: { org: OrgDetail }) {
  const [search, setSearch] = useState('');

  const filtered = org.users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-500">{filtered.length} users</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">No users found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name / Email', 'Role', 'Status', 'Platform Admin', 'Joined'].map((h) => (
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
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{user.name}</div>
                    <div className="text-xs text-gray-400">{user.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{user.role?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge
                      label={user.active ? 'Active' : 'Inactive'}
                      className={
                        user.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {user.isPlatformAdmin && <Shield size={14} className="text-indigo-600 mx-auto" />}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Roles ───────────────────────────────────────────────────────────────

function RolesTab({ org }: { org: OrgDetail }) {
  if (org.roles.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-10 text-center text-sm text-gray-400">
        No roles configured
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {org.roles.map((role) => {
        const grouped = role.permissions.reduce<Record<string, string[]>>((acc, perm) => {
          const cat = permissionCategory(perm);
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(perm);
          return acc;
        }, {});

        return (
          <div key={role.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{role.name}</h3>
                {role.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {role.permissions.length} permissions
                </span>
                <Link
                  to={`/platform/organizations/${org.id}/roles`}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
                >
                  Edit permissions →
                </Link>
              </div>
            </div>

            {role.permissions.length > 0 && (
              <div className="space-y-2">
                {Object.entries(grouped).map(([cat, perms]) => (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{cat}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {perms.map((p) => (
                        <span
                          key={p}
                          className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Subscription ────────────────────────────────────────────────────────

interface SubscriptionTabProps {
  org: OrgDetail;
  plans: Plan[];
  onRefresh: () => void;
}

function SubscriptionTab({ org, plans, onRefresh }: SubscriptionTabProps) {
  const [planId, setPlanId] = useState(org.subscription?.plan.id ?? '');
  const [status, setStatus] = useState(org.subscription?.status ?? 'ACTIVE');
  const [providerCustomerId, setProviderCustomerId] = useState(
    org.subscription?.providerCustomerId ?? '',
  );
  const [paypalSubscriptionId, setPaypalSubscriptionId] = useState(
    org.subscription?.paypalSubscriptionId ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await api.patch(`/platform/organizations/${org.id}`, {
        planId: planId || undefined,
        status,
        providerCustomerId: providerCustomerId || null,
        paypalSubscriptionId: paypalSubscriptionId || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onRefresh();
    } catch {
      setError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm('Deactivate this organization? All users will be immediately prevented from logging in.')) return;
    setDeactivating(true);
    try {
      await api.patch(`/platform/organizations/${org.id}`, { active: false });
      onRefresh();
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Subscription Settings</h3>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Plan</label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— No plan —</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.tier})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Provider Customer ID</label>
            <input
              value={providerCustomerId}
              onChange={(e) => setProviderCustomerId(e.target.value)}
              placeholder="cus_…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">PayPal Subscription ID</label>
            <input
              value={paypalSubscriptionId}
              onChange={(e) => setPaypalSubscriptionId(e.target.value)}
              placeholder="I-…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <Check size={14} /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-red-700">Danger Zone</h3>
        <p className="text-xs text-red-600">
          This will immediately prevent all users from logging in.
        </p>
        <button
          onClick={handleDeactivate}
          disabled={deactivating || !org.active}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
        >
          {deactivating ? 'Deactivating…' : 'Deactivate Organization'}
        </button>
        {!org.active && (
          <p className="text-xs text-red-400">This organization is already inactive.</p>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'users' | 'roles' | 'subscription';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'roles', label: 'Roles' },
  { id: 'subscription', label: 'Subscription' },
];

export default function PlatformOrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: org, isLoading: orgLoading } = useQuery<OrgDetail>({
    queryKey: ['platform-org', id],
    queryFn: () => api.get(`/platform/organizations/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['platform-plans'],
    queryFn: () => api.get('/platform/plans').then((r) => r.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['platform-org', id] });
    qc.invalidateQueries({ queryKey: ['platform-organizations'] });
  };

  if (orgLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3" />
        <div className="h-10 bg-gray-100 rounded w-1/2" />
        <div className="h-64 bg-white rounded-xl border border-gray-200" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">
        <AlertCircle size={16} /> Organization not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <Link
          to="/platform/organizations"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-3 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Organizations
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
            <p className="text-sm text-gray-400 font-mono mt-0.5">{org.slug}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Badge
              label={org.active ? 'Active' : 'Inactive'}
              className={org.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}
            />
            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Edit2 size={13} /> Edit
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.id === 'users' && (
              <span className="ml-1.5 text-xs text-gray-400">({org._count.users})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab org={org} />}
      {activeTab === 'users' && <UsersTab org={org} />}
      {activeTab === 'roles' && <RolesTab org={org} />}
      {activeTab === 'subscription' && (
        <SubscriptionTab org={org} plans={plans} onRefresh={invalidate} />
      )}

      {/* Edit modal */}
      {showEditModal && (
        <EditModal org={org} onClose={() => setShowEditModal(false)} onSaved={invalidate} />
      )}
    </div>
  );
}
