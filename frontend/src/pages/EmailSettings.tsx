import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Mail, RefreshCw, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';

interface ConfigStatus {
  smtp: Record<string, boolean | string | number>;
  imap: Record<string, boolean | string | number>;
}

interface EmailLog {
  id: string;
  to: string[];
  subject: string;
  status: string;
  errorMessage?: string;
  messageId?: string;
  sentAt?: string;
  createdAt: string;
  ticket?: { id: string; ticketNumber: string; title: string };
}

interface EmailMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  from: string;
  to: string[];
  subject: string;
  status: string;
  receivedAt?: string;
  sentAt?: string;
  createdAt: string;
  ticket?: { id: string; ticketNumber: string; title: string };
  _count?: { attachments: number };
}

interface PageResult<T> {
  data: T[];
  total: number;
}

export default function EmailSettingsPage() {
  const { hasPermission, user } = useAuth();
  const qc = useQueryClient();
  const [testTo, setTestTo] = useState(user?.email || '');
  const [testMessage, setTestMessage] = useState('This is a MegaMTX test email.');
  const [error, setError] = useState('');

  const config = useQuery<ConfigStatus>({
    queryKey: ['email-config-status'],
    queryFn: () => api.get('/admin/email/config-status').then((r) => r.data),
    enabled: hasPermission('EMAIL_SETTINGS'),
  });

  const logs = useQuery<PageResult<EmailLog>>({
    queryKey: ['email-logs'],
    queryFn: () => api.get('/admin/email/logs').then((r) => r.data),
    enabled: hasPermission('EMAIL_SETTINGS'),
  });

  const messages = useQuery<PageResult<EmailMessage>>({
    queryKey: ['email-messages'],
    queryFn: () => api.get('/admin/email/messages').then((r) => r.data),
    enabled: hasPermission('EMAIL_SETTINGS'),
  });

  const testSend = useMutation({
    mutationFn: () => api.post('/admin/email/test', { to: testTo, body: testMessage }).then((r) => r.data),
    onSuccess: () => {
      setError('');
      qc.invalidateQueries({ queryKey: ['email-logs'] });
      qc.invalidateQueries({ queryKey: ['email-messages'] });
    },
    onError: (err: unknown) => setError(getApiError(err, 'Failed to send test email')),
  });

  const smtpVerify = useMutation({
    mutationFn: () => api.post('/admin/email/smtp/verify').then((r) => r.data),
    onError: (err: unknown) => setError(getApiError(err, 'SMTP verification failed')),
    onSuccess: () => setError(''),
  });

  const imapVerify = useMutation({
    mutationFn: () => api.post('/admin/email/imap/verify').then((r) => r.data),
    onError: (err: unknown) => setError(getApiError(err, 'IMAP verification failed')),
    onSuccess: () => setError(''),
  });

  const pollNow = useMutation({
    mutationFn: () => api.post('/admin/email/poll-now').then((r) => r.data),
    onSuccess: () => {
      setError('');
      qc.invalidateQueries({ queryKey: ['email-messages'] });
    },
    onError: (err: unknown) => setError(getApiError(err, 'Inbox poll failed')),
  });

  if (!hasPermission('EMAIL_SETTINGS')) {
    return <div className="text-center py-12 text-gray-400">You don't have permission to manage email settings.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Mail size={22} className="text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">Email Management</h1>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <StatusCard title="SMTP Egress" status={config.data?.smtp} onVerify={() => smtpVerify.mutate()} pending={smtpVerify.isPending} />
        <StatusCard title="IMAP Ingress" status={config.data?.imap} onVerify={() => imapVerify.mutate()} pending={imapVerify.isPending} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Send Test Email</h2>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_auto] gap-3">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="recipient@example.com"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => testSend.mutate()}
            disabled={testSend.isPending}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
          >
            <Send size={16} />
            Send
          </button>
        </div>
      </div>

      <EmailLogsTable logs={logs.data?.data || []} loading={logs.isLoading} />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Mailbox Messages</h2>
            <p className="text-xs text-gray-400 mt-0.5">Stored inbound and outbound email messages</p>
          </div>
          <button
            onClick={() => pollNow.mutate()}
            disabled={pollNow.isPending}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 disabled:opacity-60"
          >
            <RefreshCw size={14} />
            Poll now
          </button>
        </div>
        <EmailMessagesTable messages={messages.data?.data || []} loading={messages.isLoading} />
      </div>
    </div>
  );
}

function StatusCard({ title, status, onVerify, pending }: { title: string; status?: Record<string, boolean | string | number>; onVerify: () => void; pending: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        <button onClick={onVerify} disabled={pending} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 disabled:opacity-60">
          Verify
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(status || {}).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs">
            <span className="text-gray-500">{humanize(key)}</span>
            <span className={value ? 'text-green-700 font-medium' : 'text-gray-400'}>{String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmailLogsTable({ logs, loading }: { logs: EmailLog[]; loading: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">Outbound Send Attempts</h2>
      </div>
      {loading ? <EmptyState text="Loading email logs..." /> : (
        <Table columns={['Time', 'To', 'Subject', 'Status', 'Ticket']}>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-gray-50">
              <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(log.sentAt || log.createdAt)}</td>
              <td className="px-4 py-2.5 text-gray-600">{log.to.join(', ')}</td>
              <td className="px-4 py-2.5 text-gray-700">{log.subject}</td>
              <td className="px-4 py-2.5"><StatusBadge value={log.status} /></td>
              <td className="px-4 py-2.5 text-xs text-gray-500">{log.ticket?.ticketNumber || '-'}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

function EmailMessagesTable({ messages, loading }: { messages: EmailMessage[]; loading: boolean }) {
  if (loading) return <EmptyState text="Loading mailbox messages..." />;
  return (
    <Table columns={['Time', 'Direction', 'From', 'Subject', 'Status', 'Ticket', 'Files']}>
      {messages.map((message) => (
        <tr key={message.id} className="border-b border-gray-50">
          <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(message.receivedAt || message.sentAt || message.createdAt)}</td>
          <td className="px-4 py-2.5 text-xs text-gray-500">{message.direction}</td>
          <td className="px-4 py-2.5 text-gray-600">{message.from}</td>
          <td className="px-4 py-2.5 text-gray-700">{message.subject}</td>
          <td className="px-4 py-2.5"><StatusBadge value={message.status} /></td>
          <td className="px-4 py-2.5 text-xs text-gray-500">{message.ticket?.ticketNumber || '-'}</td>
          <td className="px-4 py-2.5 text-xs text-gray-500">{message._count?.attachments || 0}</td>
        </tr>
      ))}
    </Table>
  );
}

function Table({ columns, children }: { columns: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>{columns.map((column) => <th key={column} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{column}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const ok = ['SENT', 'PROCESSED', 'DELIVERED'].includes(value);
  const bad = ['FAILED', 'IGNORED'].includes(value);
  return <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${ok ? 'bg-green-100 text-green-700' : bad ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{value}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="h-32 flex items-center justify-center text-gray-400 text-sm">{text}</div>;
}

function humanize(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function formatDate(value: string): string {
  return format(new Date(value), 'MMM d, yyyy HH:mm');
}

function getApiError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
}
