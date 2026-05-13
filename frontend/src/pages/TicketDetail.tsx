import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, MessageSquare, Clock, MapPin, Wrench } from 'lucide-react';
import api from '../api/client';
import { Ticket, TicketStatus } from '../types';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../contexts/AuthContext';

const NEXT_STATUSES: Partial<Record<TicketStatus, TicketStatus[]>> = {
  OPEN: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['ON_HOLD', 'PENDING_PARTS', 'PENDING_REVIEW', 'COMPLETED'],
  ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
  PENDING_PARTS: ['IN_PROGRESS', 'ON_HOLD'],
  PENDING_REVIEW: ['COMPLETED', 'IN_PROGRESS'],
  COMPLETED: ['CLOSED'],
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const { data: ticket, isLoading } = useQuery<Ticket>({
    queryKey: ['tickets', id],
    queryFn: () => api.get(`/tickets/${id}`).then((r) => r.data),
  });

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) => api.patch(`/tickets/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', id] }),
  });

  const commentMutation = useMutation({
    mutationFn: () => api.post(`/tickets/${id}/comments`, { content: comment, isInternal }),
    onSuccess: () => { setComment(''); qc.invalidateQueries({ queryKey: ['tickets', id] }); },
  });

  if (isLoading) return <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>;
  if (!ticket) return <div className="text-center py-12 text-gray-400">Ticket not found</div>;

  const nextStatuses = NEXT_STATUSES[ticket.status] || [];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <button onClick={() => navigate('/tickets')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft size={16} /> Back to Tickets
      </button>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-gray-400">{ticket.ticketNumber}</span>
                <StatusBadge type="priority" value={ticket.priority} />
                <StatusBadge type="status" value={ticket.status} />
              </div>
              <h1 className="text-lg font-semibold text-gray-900">{ticket.title}</h1>
            </div>
            {hasPermission('TICKET_UPDATE') && nextStatuses.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {nextStatuses.map((s) => (
                  <button
                    key={s}
                    onClick={() => statusMutation.mutate(s)}
                    disabled={statusMutation.isPending}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
          <div className="p-5 space-y-3 text-sm col-span-2">
            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Description</div>
              <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
            </div>
            {ticket.resolutionNotes && (
              <div>
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Resolution Notes</div>
                <p className="text-gray-700">{ticket.resolutionNotes}</p>
              </div>
            )}
          </div>
          <div className="p-5 space-y-3 text-sm">
            <Detail label="Location" icon={<MapPin size={14}/>} value={ticket.location.name} />
            {ticket.asset && <Detail label="Asset" icon={<Wrench size={14}/>} value={`${ticket.asset.name}${ticket.asset.assetTag ? ` (${ticket.asset.assetTag})` : ''}`} />}
            <Detail label="Type" value={ticket.type.replace(/_/g, ' ')} />
            <Detail label="Created By" value={ticket.createdBy.name} />
            <Detail label="Assigned To" value={ticket.assignedTo?.name ?? '—'} />
            {ticket.dueDate && <Detail label="Due Date" icon={<Clock size={14}/>} value={format(new Date(ticket.dueDate), 'MMM d, yyyy')} />}
            {ticket.estimatedHours && <Detail label="Est. Hours" value={`${ticket.estimatedHours}h`} />}
            {ticket.actualHours && <Detail label="Actual Hours" value={`${ticket.actualHours}h`} />}
            <Detail label="Created" value={format(new Date(ticket.createdAt), 'MMM d, yyyy h:mm a')} />
          </div>
        </div>
      </div>

      {/* Timeline */}
      {ticket.statusHistory && ticket.statusHistory.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Status History</h3>
          <div className="space-y-3">
            {ticket.statusHistory.map((h) => (
              <div key={h.id} className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">{h.toStatus.replace(/_/g, ' ')}</span>
                  {h.fromStatus && <span className="text-gray-400"> (from {h.fromStatus.replace(/_/g, ' ')})</span>}
                  <span className="text-gray-400"> · {h.changedBy.name} · {format(new Date(h.createdAt), 'MMM d h:mm a')}</span>
                  {h.reason && <div className="text-gray-500 mt-0.5">{h.reason}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <MessageSquare size={16} />
          Comments ({ticket.comments?.length ?? 0})
        </h3>
        <div className="space-y-4 mb-5">
          {ticket.comments?.map((c) => (
            <div key={c.id} className={`rounded-lg p-3 text-sm ${c.isInternal ? 'bg-yellow-50 border border-yellow-100' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{c.author.name}</span>
                {c.isInternal && <span className="text-xs bg-yellow-200 text-yellow-800 px-1.5 rounded">Internal</span>}
                <span className="text-xs text-gray-400">{format(new Date(c.createdAt), 'MMM d, h:mm a')}</span>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}
        </div>
        {hasPermission('TICKET_READ') && (
          <div>
            <textarea
              rows={3}
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="rounded" />
                Internal note
              </label>
              <button
                disabled={!comment.trim() || commentMutation.isPending}
                onClick={() => commentMutation.mutate()}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
              >
                Post
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-gray-700 flex items-center gap-1">{icon}{value}</div>
    </div>
  );
}
