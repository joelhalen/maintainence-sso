import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, ChevronRight, Pencil } from 'lucide-react';
import api from '../api/client';
import { Location } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface LocationFormData {
  name: string;
  code: string;
  description: string;
  address: string;
  parentId: string;
}

export default function LocationsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState<null | { mode: 'create' | 'edit'; location?: Location }>(null);

  const { data: locations, isLoading } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => api.get('/locations').then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Locations</h1>
        {hasPermission('LOCATION_CREATE') && (
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add Location
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading locations...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Code', 'Parent', 'Address', 'Sub-locations', 'Assets', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {locations?.map((l) => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="font-medium text-gray-900">{l.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{l.code ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {l.parent ? (
                      <span className="flex items-center gap-1 text-xs"><ChevronRight size={12} />{l.parent.name}</span>
                    ) : <span className="text-gray-300 text-xs">Root</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{l.address ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{l._count?.children ?? 0}</td>
                  <td className="px-4 py-3 text-gray-600">{l._count?.assets ?? 0}</td>
                  <td className="px-4 py-3">
                    {hasPermission('LOCATION_UPDATE') && (
                      <button
                        onClick={() => setModal({ mode: 'edit', location: l })}
                        className="text-gray-400 hover:text-blue-600 p-1"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {locations?.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">No locations defined yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <LocationModal
          mode={modal.mode}
          location={modal.location}
          allLocations={locations ?? []}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); qc.invalidateQueries({ queryKey: ['locations'] }); }}
        />
      )}
    </div>
  );
}

function LocationModal({
  mode, location, allLocations, onClose, onSuccess,
}: {
  mode: 'create' | 'edit';
  location?: Location;
  allLocations: Location[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<LocationFormData>({
    name: location?.name ?? '',
    code: location?.code ?? '',
    description: location?.description ?? '',
    address: location?.address ?? '',
    parentId: location?.parentId ?? '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'create') {
        await api.post('/locations', { ...form, parentId: form.parentId || null });
      } else {
        await api.patch(`/locations/${location!.id}`, { ...form, parentId: form.parentId || null });
      }
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to save location');
    } finally {
      setSubmitting(false);
    }
  };

  const availableParents = allLocations.filter((l) => l.id !== location?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold">{mode === 'create' ? 'Add Location' : 'Edit Location'}</h2>
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Code</label>
              <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. MAIN-B1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Parent Location</label>
              <select value={form.parentId} onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">None (Root)</option>
                {availableParents.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
            <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
              {submitting ? 'Saving...' : mode === 'create' ? 'Add Location' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
