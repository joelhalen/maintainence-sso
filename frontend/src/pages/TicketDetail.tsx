import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, MapPin, Wrench, Lock, MessageSquare, RefreshCw, User, Clock, Tag, FileText } from 'lucide-react';
import api from '../api/client';
import { Ticket, TicketStatus, TicketComment, TicketStatusHistory } from '../types';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../contexts/AuthContext';

const NEXT_STATUSES: Partial<Record<TicketStatus, TicketStatus[]>> = {
  OPEN:           ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS:    ['ON_HOLD', 'PENDING_PARTS', 'PENDING_REVIEW', 'COMPLETED'],
  ON_HOLD:        ['IN_PROGRESS', 'CANCELLED'],
  PENDING_PARTS:  ['IN_PROGRESS', 'ON_HOLD'],
  PENDING_REVIEW: ['COMPLETED', 'IN_PROGRESS'],
  COMPLETED:      ['CLOSED'],
};

type TimelineEvent =
  | { kind: 'comment'; date: string; entry: TicketComment }
  | { kind: 'status';  date: string; entry: TicketStatusHistory };

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [activeTab, setActiveTab] = useState<'activity' | 'details'>('activity');

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

  const timeline: TimelineEvent[] = [
    ...(ticket.comments ?? []).map((c): TimelineEvent => ({ kind: 'comment', date: c.createdAt, entry: c })),
    ...(ticket.statusHistory ?? []).map((h): TimelineEvent => ({ kind: 'status', date: h.createdAt, entry: h })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <button onClick={() => navigate('/tickets')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft size={16} /> Back to Tickets
      </button>

      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-xs font-mono text-gray-400">{ticket.ticketNumber}</span>
                <StatusBadge type="status" value={ticket.status} />
                <StatusBadge type="priority" value={ticket.priority} />
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">
                  {ticket.type.replace(/_/g, ' ')}
                </span>
              </div>
              <h1 className="text-lg font-semibold text-gray-900">{ticket.title}</h1>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                <span className="flex items-center gap-1"><MapPin size={12} />{ticket.location.name}</span>
                {ticket.asset && <span className="flex items-center gap-1"><Wrench size={12} />{ticket.asset.name}{ticket.asset.assetTag ? ` (${ticket.asset.assetTag})` : ''}</span>}
                <span className="flex items-center gap-1"><User size={12} />Created by {ticket.createdBy.name}</span>
                <span className="flex items-center gap-1"><Clock size={12} />{format(new Date(ticket.createdAt), 'MMM d, yyyy')}</span>
              </div>
            </div>
            {hasPermission('TICKET_UPDATE') && nextStatuses.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {nextStatuses.map((s) => (
                  <button
                    key={s}
                    onClick={() => statusMutation.mutate(s)}
                    disabled={statusMutation.isPending}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    → {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Metadata strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 bg-gray-50 text-xs">
          <div className="px-4 py-3">
            <div className="text-gray-400 mb-0.5">Assigned to</div>
            <div className="font-medium text-gray-700">{ticket.assignedTo?.name ?? <span className="text-gray-400 font-normal">Unassigned</span>}</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-gray-400 mb-0.5">Due date</div>
            <div className={`font-medium ${ticket.dueDate && new Date(ticket.dueDate) < new Date() && ticket.status !== 'CLOSED' && ticket.status !== 'COMPLETED' ? 'text-red-600' : 'text-gray-700'}`}>
              {ticket.dueDate ? format(new Date(ticket.dueDate), 'MMM d, yyyy') : <span className="text-gray-400 font-normal">None</span>}
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="text-gray-400 mb-0.5">Est. / Actual hours</div>
            <div className="font-medium text-gray-700">
              {ticket.estimatedHours ?? '—'} / {ticket.actualHours ?? '—'}
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="text-gray-400 mb-0.5">Tags</div>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {ticket.tags.length ? ticket.tags.map((t) => (
                <span key={t} className="flex items-center gap-0.5 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-xs">
                  <Tag size={10} />{t}
                </span>
              )) : <span className="text-gray-400 font-normal">None</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-gray-100 rounded-lg p-1 w-fit">
        {(['activity', 'details'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors capitalize ${
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'activity' ? `Activity (${timeline.length})` : 'Details'}
          </button>
        ))}
      </div>

      {/* Activity tab */}
      {activeTab === 'activity' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          {timeline.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No activity yet.</p>
          )}
          <div className="space-y-4">
            {timeline.map((event, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0 mt-0.5 ${
                  event.kind === 'comment' ? 'bg-blue-500' : 'bg-gray-400'
                }`}>
                  {event.kind === 'comment' ? <MessageSquare size={13} /> : <RefreshCw size={13} />}
                </div>
                <div className="flex-1 min-w-0">
                  {event.kind === 'comment' ? (
                    <div className={`rounded-lg p-3 text-sm ${event.entry.isInternal ? 'bg-yellow-50 border border-yellow-100' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-medium text-gray-800">{event.entry.author.name}</span>
                        {event.entry.isInternal && (
                          <span className="flex items-center gap-0.5 text-xs bg-yellow-200 text-yellow-800 px-1.5 rounded">
                            <Lock size={10} /> Internal
                          </span>
                        )}
                        <span className="text-xs text-gray-400 ml-auto">{format(new Date(event.entry.createdAt), 'MMM d, h:mm a')}</span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{event.entry.content}</p>
                    </div>
                  ) : (
                    <div className="text-sm py-1">
                      <span className="text-gray-500">
                        <span className="font-medium text-gray-700">{event.entry.changedBy.name}</span>
                        {' '}changed status to{' '}
                        <span className="font-medium text-gray-900">{event.entry.toStatus.replace(/_/g, ' ')}</span>
                        {event.entry.fromStatus && <span className="text-gray-400"> (from {event.entry.fromStatus.replace(/_/g, ' ')})</span>}
                      </span>
                      {event.entry.reason && <div className="text-gray-500 mt-0.5 text-xs">{event.entry.reason}</div>}
                      <div className="text-xs text-gray-400 mt-0.5">{format(new Date(event.entry.createdAt), 'MMM d, h:mm a')}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasPermission('TICKET_UPDATE') && (
            <div className="pt-3 border-t border-gray-100">
              <textarea
                rows={3}
                placeholder="Add a comment or note..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                  <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="rounded" />
                  <Lock size={13} className="text-yellow-600" />
                  Internal note
                </label>
                <button
                  disabled={!comment.trim() || commentMutation.isPending}
                  onClick={() => commentMutation.mutate()}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
                >
                  {commentMutation.isPending ? 'Posting…' : 'Post'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Details tab */}
      {activeTab === 'details' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 text-sm">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <FileText size={12} /> Description
            </div>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
          </div>
          {ticket.resolutionNotes && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Resolution Notes</div>
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{ticket.resolutionNotes}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            {ticket.startedAt && <Detail label="Started" value={format(new Date(ticket.startedAt), 'MMM d, yyyy h:mm a')} />}
            {ticket.completedAt && <Detail label="Completed" value={format(new Date(ticket.completedAt), 'MMM d, yyyy h:mm a')} />}
            {ticket.closedAt && <Detail label="Closed" value={format(new Date(ticket.closedAt), 'MMM d, yyyy h:mm a')} />}
            {ticket.completedBy && <Detail label="Completed by" value={ticket.completedBy.name} />}
            <Detail label="Last updated" value={format(new Date(ticket.updatedAt), 'MMM d, yyyy h:mm a')} />
            <Detail label="Attachments" value={String(ticket._count?.attachments ?? 0)} />
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-sm text-gray-700">{value}</div>
    </div>
  );
}
