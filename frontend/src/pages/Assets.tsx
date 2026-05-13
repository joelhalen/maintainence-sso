import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Pencil } from 'lucide-react';
import api from '../api/client';
import { Asset, AssetCategory, Location } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface AssetFormData {
  name: string;
  assetTag: string;
  serialNumber: string;
  model: string;
  manufacturer: string;
  categoryId: string;
  locationId: string;
  description: string;
  installDate: string;
  warrantyExp: string;
}

export default function AssetsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<null | { mode: 'create' | 'edit'; asset?: Asset }>(null);

  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: ['assets', search],
    queryFn: () => api.get('/assets', { params: { search: search || undefined } }).then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Assets &amp; Equipment</h1>
        {hasPermission('ASSET_CREATE') && (
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add Asset
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-2">
        <Search size={16} className="text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, tag, or serial number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-sm outline-none"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading assets...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Tag', 'Category', 'Location', 'Manufacturer / Model', 'Warranty Exp.', 'Tickets', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets?.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.assetTag ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{a.category.name}</td>
                  <td className="px-4 py-3 text-gray-600">{a.location.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {a.manufacturer && a.model ? `${a.manufacturer} / ${a.model}` : a.manufacturer || a.model || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {a.warrantyExp ? (
                      <span className={new Date(a.warrantyExp) < new Date() ? 'text-red-600' : 'text-gray-500'}>
                        {new Date(a.warrantyExp).toLocaleDateString()}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a._count?.tickets ?? 0}</td>
                  <td className="px-4 py-3">
                    {hasPermission('ASSET_UPDATE') && (
                      <button onClick={() => setModal({ mode: 'edit', asset: a })} className="text-gray-400 hover:text-blue-600 p-1">
                        <Pencil size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {assets?.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">No assets found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <AssetModal
          mode={modal.mode}
          asset={modal.asset}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); qc.invalidateQueries({ queryKey: ['assets'] }); }}
        />
      )}
    </div>
  );
}

function AssetModal({ mode, asset, onClose, onSuccess }: { mode: 'create' | 'edit'; asset?: Asset; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<AssetFormData>({
    name: asset?.name ?? '',
    assetTag: asset?.assetTag ?? '',
    serialNumber: asset?.serialNumber ?? '',
    model: asset?.model ?? '',
    manufacturer: asset?.manufacturer ?? '',
    categoryId: asset?.category.id ?? '',
    locationId: asset?.location.id ?? '',
    description: asset?.description ?? '',
    installDate: asset?.installDate ? asset.installDate.slice(0, 10) : '',
    warrantyExp: asset?.warrantyExp ? asset.warrantyExp.slice(0, 10) : '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: categories } = useQuery<AssetCategory[]>({
    queryKey: ['asset-categories'],
    queryFn: () => api.get('/assets/categories').then((r) => r.data),
  });
  const { data: locations } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => api.get('/locations').then((r) => r.data),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        assetTag: form.assetTag || undefined,
        serialNumber: form.serialNumber || undefined,
        model: form.model || undefined,
        manufacturer: form.manufacturer || undefined,
        description: form.description || undefined,
        installDate: form.installDate || undefined,
        warrantyExp: form.warrantyExp || undefined,
      };
      if (mode === 'create') {
        await api.post('/assets', payload);
      } else {
        await api.patch(`/assets/${asset!.id}`, payload);
      }
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to save asset');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold">{mode === 'create' ? 'Add Asset' : 'Edit Asset'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Asset Tag</label>
              <input value={form.assetTag} onChange={(e) => setForm((f) => ({ ...f, assetTag: e.target.value }))} placeholder="e.g. EQ-0042" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Serial Number</label>
              <input value={form.serialNumber} onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
              <select required value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Select category</option>
                {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Location *</label>
              <select required value={form.locationId} onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Select location</option>
                {locations?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Manufacturer</label>
              <input value={form.manufacturer} onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Model</label>
              <input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Install Date</label>
              <input type="date" value={form.installDate} onChange={(e) => setForm((f) => ({ ...f, installDate: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Warranty Expires</label>
              <input type="date" value={form.warrantyExp} onChange={(e) => setForm((f) => ({ ...f, warrantyExp: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
              {submitting ? 'Saving...' : mode === 'create' ? 'Add Asset' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
