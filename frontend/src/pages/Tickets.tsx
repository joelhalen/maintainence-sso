import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import api from '../api/client';
import { Ticket, TicketStatus, TicketPriority, PaginatedResult } from '../types';
import StatusBadge from '../components/StatusBadge';
import CreateTicketModal from '../components/CreateTicketModal';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';

const STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'PENDING_PARTS', 'PENDING_REVIEW', 'COMPLETED', 'CLOSED', 'CANCELLED'];
const PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function TicketsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<PaginatedResult<Ticket>>({
    queryKey: ['tickets', { search, status, priority, page }],
    queryFn: () => api.get('/tickets', { params: { search, status, priority, page, limit: 25 } }).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Tickets</h1>
        {hasPermission('TICKET_CREATE') && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            New Ticket
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 text-sm outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select
          value={priority}
          onChange={(e) => { setPriority(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading tickets...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ticket</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned To</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Due</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/tickets/${ticket.id}`} className="hover:text-blue-600">
                          <div className="font-medium text-gray-900">{ticket.title}</div>
                          <div className="text-xs text-gray-400">{ticket.ticketNumber}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-3"><StatusBadge type="priority" value={ticket.priority} /></td>
                      <td className="px-4 py-3"><StatusBadge type="status" value={ticket.status} /></td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{ticket.location.name}</td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{ticket.assignedTo?.name ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-gray-600 text-sm">
                        {ticket.dueDate ? (
                          <span className={new Date(ticket.dueDate) < new Date() && !['COMPLETED','CLOSED'].includes(ticket.status) ? 'text-red-600 font-medium' : ''}>
                            {format(new Date(ticket.dueDate), 'MMM d, yyyy')}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{format(new Date(ticket.createdAt), 'MMM d, yyyy')}</td>
                    </tr>
                  ))}
                  {data?.data.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">No tickets found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
                <span>Showing {((page - 1) * 25) + 1}–{Math.min(page * 25, data.total)} of {data.total}</span>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-40">Prev</button>
                  <button disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && (
        <CreateTicketModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['tickets'] }); }}
        />
      )}
    </div>
  );
}
