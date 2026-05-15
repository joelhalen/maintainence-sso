import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus, Eye } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { PaginatedResult, Ticket } from '../types';
import CreateTicketModal from '../components/CreateTicketModal';

export default function LandingPage() {
  const { user, hasPermission } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: openTickets } = useQuery<PaginatedResult<Ticket>>({
    queryKey: ['my-tickets', user?.id, 'OPEN'],
    queryFn: () =>
      api.get('/tickets', { params: { assignedToId: user?.id, status: 'OPEN', limit: 1 } }).then((r) => r.data),
    enabled: !!user?.id && hasPermission('TICKET_READ'),
  });

  const { data: inProgressTickets } = useQuery<PaginatedResult<Ticket>>({
    queryKey: ['my-tickets', user?.id, 'IN_PROGRESS'],
    queryFn: () =>
      api.get('/tickets', { params: { assignedToId: user?.id, status: 'IN_PROGRESS', limit: 1 } }).then((r) => r.data),
    enabled: !!user?.id && hasPermission('TICKET_READ'),
  });

  const openCount = openTickets?.total ?? 0;
  const inProgressCount = inProgressTickets?.total ?? 0;
  const activeCount = openCount + inProgressCount;

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.name}</h1>
        <p className="text-gray-500 mt-1">{user?.role?.name}</p>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* View Tickets */}
        {hasPermission('TICKET_READ') && (
          <Link
            to="/tickets"
            className="group bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-sm transition-all block"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="bg-blue-50 p-3 rounded-xl">
                <ClipboardList size={22} className="text-blue-600" />
              </div>
              {activeCount > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                  {activeCount} active
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
              View My Tickets
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {activeCount > 0
                ? `${openCount} open · ${inProgressCount} in progress`
                : 'No active tickets assigned to you'}
            </p>
          </Link>
        )}

        {/* Create Ticket */}
        {hasPermission('TICKET_CREATE') && (
          <button
            onClick={() => setShowCreate(true)}
            className="group text-left bg-white border border-gray-200 rounded-xl p-6 hover:border-green-300 hover:shadow-sm transition-all"
          >
            <div className="bg-green-50 p-3 rounded-xl w-fit mb-4">
              <Plus size={22} className="text-green-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
              Create a Ticket
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Report a new maintenance issue or request
            </p>
          </button>
        )}

        {/* Viewer-only: read access but no create */}
        {hasPermission('TICKET_READ') && !hasPermission('TICKET_CREATE') && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="bg-gray-100 p-3 rounded-xl w-fit mb-4">
              <Eye size={22} className="text-gray-500" />
            </div>
            <h2 className="text-base font-semibold text-gray-700">Read-Only Access</h2>
            <p className="text-sm text-gray-500 mt-1">
              You can view tickets but cannot create or modify them.
            </p>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateTicketModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ['my-tickets'] });
            qc.invalidateQueries({ queryKey: ['tickets'] });
          }}
        />
      )}
    </div>
  );
}
