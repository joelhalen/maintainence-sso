import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import api from '../api/client';
import { Location } from '../types';

export default function LocationsPage() {
  const { data: locations, isLoading } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => api.get('/locations').then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Locations</h1>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading locations...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Code', 'Parent', 'Sub-locations', 'Assets', 'Open Tickets'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {locations?.map((l) => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-gray-400" />
                      <span className="font-medium text-gray-900">{l.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{l.code ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{l.parent?.name ?? <span className="text-gray-300">Root</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{l._count?.children ?? 0}</td>
                  <td className="px-4 py-3 text-gray-600">{l._count?.assets ?? 0}</td>
                  <td className="px-4 py-3 text-gray-600">{l._count?.tickets ?? 0}</td>
                </tr>
              ))}
              {locations?.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No locations defined</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
