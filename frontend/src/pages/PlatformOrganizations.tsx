import { useState, useMemo, useCallback, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Search, X, ChevronRight } from 'lucide-react';
import api from '../api/client';

interface Plan {
  id: string;
  tier: string;
  name: string;
}

interface PlatformOrganization {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  activeTicketCount: number;
  subscription?: {
    status: string;
    plan: { id: string; tier: string; name: string };
  };
  _count: {
    users: number;
    locations: number;
    assets: number;
    tickets: number;
  };
}

interface CreateForm {
  name: string;
  slug: string;
  planId: string;
}

const STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'] as const;

const TIER_BADGE: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-600',
  STARTER: 'bg-blue-100 text-blue-700',
  PROFESSIONAL: 'bg-indigo-100 text-indigo-700',
  ENTERPRISE: 'bg-violet-100 text-violet-700',
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  TRIALING: 'bg-blue-100 text-blue-700',
  PAST_DUE: 'bg-amber-100 text-amber-700',
  CANCELED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 bg-gray-200 rounded w-48" />
        <div className="h-9 bg-gray-200 rounded w-40" />
      </div>
      <div className="h-10 bg-gray-200 rounded-lg" />
      <div className="bg-white rounded-xl border border-gray-200">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="px-4 py-4 border-b border-gray-50 flex gap-4">
            <div className="flex-1 h-4 bg-gray-100 rounded" />
            <div className="w-32 h-4 bg-gray-100 rounded" />
            <div className="w-24 h-4 bg-gray-100 rounded" />
            <div className="w-16 h-4 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface CreateOrgModalProps {
  plans: Plan[];
  onClose: () => void;
  onCreated: (orgId: string) => void;
}

function CreateOrgModal({ plans, onClose, onCreated }: CreateOrgModalProps) {
  const [form, setForm] = useState<CreateForm>({ name: '', slug: '', planId: plans[0]?.id ?? '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleNameChange = useCallback((name: string) => {
    setForm((prev) => ({ ...prev, name, slug: slugify(name) }));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) return;
    setCreating(true);
    setError('');
    try {
      const { data } = await api.post('/platform/organizations', {
        name: form.name.trim(),
        slug: form.slug.trim(),
        planId: form.planId || undefined,
      });
      onCreated(data.id);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create organization';
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">New Organization</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Organization Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Corp"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Slug</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
              placeholder="acme-corp"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">Used in URLs and API calls</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Plan</label>
            <select
              value={form.planId}
              onChange={(e) => setForm((prev) => ({ ...prev, planId: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">No plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.tier})
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !form.name.trim() || !form.slug.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? 'Creating...' : 'Create Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PlatformOrganizationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [savingId, setSavingId] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data: organizations, isLoading } = useQuery<PlatformOrganization[]>({
    queryKey: ['platform-organizations'],
    queryFn: () => api.get('/platform/organizations').then((r) => r.data),
  });

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['platform-plans'],
    queryFn: () => api.get('/platform/plans').then((r) => r.data),
  });

  const updateOrg = useCallback(
    async (id: string, payload: Record<string, unknown>) => {
      setSavingId(id);
      try {
        await api.patch(`/platform/organizations/${id}`, payload);
        qc.invalidateQueries({ queryKey: ['platform-organizations'] });
        qc.invalidateQueries({ queryKey: ['platform-dashboard'] });
      } finally {
        setSavingId('');
      }
    },
    [qc],
  );

  const handleCreated = useCallback(
    (orgId: string) => {
      qc.invalidateQueries({ queryKey: ['platform-organizations'] });
      qc.invalidateQueries({ queryKey: ['platform-dashboard'] });
      setShowCreate(false);
      navigate(`/platform/organizations/${orgId}`);
    },
    [qc, navigate],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return organizations ?? [];
    return (organizations ?? []).filter(
      (o) => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q),
    );
  }, [organizations, search]);

  if (isLoading) return <LoadingSkeleton />;

  return (
    <>
      {showCreate && (
        <CreateOrgModal
          plans={plans}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      <div className="space-y-4">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Organizations
              {organizations && (
                <span className="ml-2 text-sm font-normal text-gray-400">
                  {organizations.length} total
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage tenant status, assigned plan, and organization role permissions.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            New Organization
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or slug..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Organization', 'Usage', 'Plan', 'Status', 'Active', 'Actions'].map((h) => (
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
              {filtered.map((org) => (
                <tr
                  key={org.id}
                  className={`hover:bg-gray-50 transition-colors align-top ${savingId === org.id ? 'opacity-60' : ''}`}
                >
                  {/* Organization */}
                  <td className="px-4 py-3">
                    <Link
                      to={`/platform/organizations/${org.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {org.name}
                    </Link>
                    <div className="text-xs text-gray-400 mt-0.5 font-mono">{org.slug}</div>
                  </td>

                  {/* Usage */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {org._count.users}u
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {org._count.locations}loc
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {org._count.assets}ast
                      </span>
                      {org.activeTicketCount > 0 && (
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                          {org.activeTicketCount}tkts
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Plan */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {org.subscription ? (
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full self-start ${TIER_BADGE[org.subscription.plan.tier] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {org.subscription.plan.tier}
                        </span>
                      ) : null}
                      <select
                        value={org.subscription?.plan.id ?? ''}
                        disabled={savingId === org.id}
                        onChange={(e) => updateOrg(org.id, { planId: e.target.value })}
                        className="border border-gray-200 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                      >
                        <option value="">No plan</option>
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {org.subscription && (
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full self-start ${STATUS_BADGE[org.subscription.status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {org.subscription.status}
                        </span>
                      )}
                      <select
                        value={org.subscription?.status ?? ''}
                        disabled={savingId === org.id || !org.subscription}
                        onChange={(e) => updateOrg(org.id, { status: e.target.value })}
                        className="border border-gray-200 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                      >
                        {!org.subscription && <option value="">No subscription</option>}
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>

                  {/* Active toggle */}
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={org.active}
                      disabled={savingId === org.id}
                      onClick={() => updateOrg(org.id, { active: !org.active })}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${org.active ? 'bg-green-500' : 'bg-gray-200'}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${org.active ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/platform/organizations/${org.id}/roles`}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                      >
                        Edit Roles
                      </Link>
                      <Link
                        to={`/platform/organizations/${org.id}`}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-0.5"
                      >
                        View <ChevronRight size={12} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <Building2 size={32} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-sm font-medium text-gray-500">
                      {search ? 'No organizations match your search' : 'No organizations yet'}
                    </p>
                    {!search && (
                      <button
                        onClick={() => setShowCreate(true)}
                        className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Create your first organization
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {search && filtered.length > 0 && (
          <p className="text-xs text-gray-400 text-right">
            Showing {filtered.length} of {organizations?.length ?? 0} organizations
          </p>
        )}
      </div>
    </>
  );
}
