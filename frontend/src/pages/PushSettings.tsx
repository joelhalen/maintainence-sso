import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Bell, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';

interface FcmStatus {
  configured: boolean;
  hasProjectId: boolean;
  hasPrivateKey: boolean;
  hasClientEmail: boolean;
  hasServiceAccountJson: boolean;
  projectId: string;
}

interface PushUser {
  id: string;
  name: string;
  email: string;
  deviceCount: number;
  pushCapable: boolean;
}

interface PushLog {
  id: string;
  title: string;
  body: string;
  status: string;
  errorMessage?: string;
  providerMessageId?: string;
  sentAt?: string;
  createdAt: string;
  user?: { id: string; name: string; email: string };
  ticket?: { id: string; ticketNumber: string; title: string };
}

interface PageResult<T> {
  data: T[];
  total: number;
}

export default function PushSettingsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [testTitle, setTestTitle] = useState('MegaMTX Test');
  const [testBody, setTestBody] = useState('This is a test push notification.');
  const [error, setError] = useState('');

  const status = useQuery<FcmStatus>({
    queryKey: ['push-config-status'],
    queryFn: () => api.get('/admin/push/config-status').then((r) => r.data),
    enabled: hasPermission('EMAIL_SETTINGS'),
  });

  const users = useQuery<PushUser[]>({
    queryKey: ['push-users'],
    queryFn: () => api.get('/admin/push/users').then((r) => r.data),
    enabled: hasPermission('EMAIL_SETTINGS'),
  });

  const logs = useQuery<PageResult<PushLog>>({
    queryKey: ['push-logs'],
    queryFn: () => api.get('/admin/push/logs').then((r) => r.data),
    enabled: hasPermission('EMAIL_SETTINGS'),
  });

  const testSend = useMutation({
    mutationFn: () =>
      api.post('/admin/push/test', { userId: selectedUserId, title: testTitle, body: testBody }).then((r) => r.data),
    onSuccess: () => {
      setError('');
      qc.invalidateQueries({ queryKey: ['push-logs'] });
    },
    onError: (err: unknown) => setError(getApiError(err, 'Failed to send test push notification')),
  });

  if (!hasPermission('EMAIL_SETTINGS')) {
    return <div className="text-center py-12 text-gray-400">You don't have permission to manage push notification settings.</div>;
  }

  const selectedUser = users.data?.find((u) => u.id === selectedUserId);
  const canSend = Boolean(selectedUserId && selectedUser?.pushCapable && status.data?.configured);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Bell size={22} className="text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">Push Notification Management</h1>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Firebase (FCM) Status</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {status.data && Object.entries(status.data).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs">
              <span className="text-gray-500">{humanize(key)}</span>
              <span className={value ? 'text-green-700 font-medium' : 'text-gray-400'}>{String(value)}</span>
            </div>
          ))}
        </div>
        {!status.data?.configured && (
          <p className="text-xs text-amber-600 mt-3">
            Set <code className="bg-amber-50 px-1 rounded">FIREBASE_PROJECT_ID</code>,{' '}
            <code className="bg-amber-50 px-1 rounded">FIREBASE_PRIVATE_KEY</code>, and{' '}
            <code className="bg-amber-50 px-1 rounded">FIREBASE_CLIENT_EMAIL</code> (or{' '}
            <code className="bg-amber-50 px-1 rounded">FIREBASE_SERVICE_ACCOUNT_JSON</code>) to enable push notifications.
          </p>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Send Test Push Notification</h2>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_1fr_auto] gap-3">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Select a user</option>
            {users.data?.map((user) => (
              <option key={user.id} value={user.id} disabled={!user.pushCapable}>
                {user.name} ({user.deviceCount} device{user.deviceCount !== 1 ? 's' : ''})
              </option>
            ))}
          </select>
          <input
            value={testTitle}
            maxLength={100}
            onChange={(e) => setTestTitle(e.target.value)}
            placeholder="Notification title"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={testBody}
            maxLength={500}
            onChange={(e) => setTestBody(e.target.value)}
            placeholder="Notification body"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => testSend.mutate()}
            disabled={!canSend || testSend.isPending}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
          >
            <Send size={16} />
            Send
          </button>
        </div>
        {!status.data?.configured && (
          <p className="text-xs text-amber-600 mt-2">FCM must be configured before test notifications can be sent.</p>
        )}
        {selectedUser && !selectedUser.pushCapable && (
          <p className="text-xs text-amber-600 mt-2">Selected user has no registered devices. They must install the mobile app or enable web push first.</p>
        )}
      </div>

      <PushLogsTable logs={logs.data?.data || []} loading={logs.isLoading} />
    </div>
  );
}

function PushLogsTable({ logs, loading }: { logs: PushLog[]; loading: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">Push Notification Log</h2>
      </div>
      {loading ? <EmptyState text="Loading logs..." /> : logs.length === 0 ? <EmptyState text="No push notifications sent yet." /> : (
        <Table columns={['Time', 'User', 'Title', 'Body', 'Status', 'Ticket']}>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-gray-50">
              <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(log.sentAt || log.createdAt)}</td>
              <td className="px-4 py-2.5 text-gray-600">{log.user?.name || '-'}</td>
              <td className="px-4 py-2.5 text-gray-700 max-w-xs truncate">{log.title}</td>
              <td className="px-4 py-2.5 text-gray-600 max-w-md truncate" title={log.errorMessage || log.body}>
                {log.errorMessage || log.body}
              </td>
              <td className="px-4 py-2.5"><StatusBadge value={log.status} /></td>
              <td className="px-4 py-2.5 text-xs text-gray-500">{log.ticket?.ticketNumber || '-'}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

function Table({ columns, children }: { columns: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>{columns.map((col) => <th key={col} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{col}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const ok = ['SENT', 'DELIVERED'].includes(value);
  const bad = ['FAILED'].includes(value);
  return (
    <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${ok ? 'bg-green-100 text-green-700' : bad ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
      {value}
    </span>
  );
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

function getApiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
}
