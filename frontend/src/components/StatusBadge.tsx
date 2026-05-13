import clsx from 'clsx';
import { TicketStatus, TicketPriority } from '../types';

const STATUS_STYLES: Record<TicketStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  ON_HOLD: 'bg-gray-100 text-gray-700',
  PENDING_PARTS: 'bg-orange-100 text-orange-800',
  PENDING_REVIEW: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-red-100 text-red-700',
};

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  LOW: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

interface Props {
  type: 'status' | 'priority';
  value: TicketStatus | TicketPriority;
}

export default function StatusBadge({ type, value }: Props) {
  const style = type === 'status'
    ? STATUS_STYLES[value as TicketStatus]
    : PRIORITY_STYLES[value as TicketPriority];

  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', style)}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}
