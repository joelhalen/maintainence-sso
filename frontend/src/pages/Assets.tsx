import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import api from '../api/client';
import { Asset } from '../types';

export default function AssetsPage() {
  const [search, setSearch] = useState('');
  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: ['assets', search],
    queryFn: () => api.get('/assets', { params: { search: search || undefined } }).then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Assets &amp; Equipment</h1>
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-2">
        <Search size={16} className="text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, tag, or serial..."
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
                {['Name', 'Tag', 'Category', 'Location', 'Manufacturer', 'Open Tickets'].map((h) => (
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
                  <td className="px-4 py-3 text-gray-500">{a.manufacturer ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{a._count?.tickets ?? 0}</td>
                </tr>
              ))}
              {assets?.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No assets found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
