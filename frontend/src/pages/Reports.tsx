import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  createdAt: string;
  user?: { id: string; name: string; email: string };
}

interface AuditPage {
  data: AuditLog[];
  total: number;
}

export default function ReportsPage() {
  const { hasPermission } = useAuth();

  const { data: auditLogs, isLoading } = useQuery<AuditPage>({
    queryKey: ['audit-logs'],
    queryFn: () => api.get('/reports/audit').then((r) => r.data),
    enabled: hasPermission('AUDIT_LOG_VIEW'),
  });

  if (!hasPermission('REPORT_VIEW')) {
    return <div className="text-center py-12 text-gray-400">You don't have permission to view reports.</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Reports &amp; Audit Log</h1>

      {hasPermission('AUDIT_LOG_VIEW') && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Audit Trail (21 CFR Part 11)</h2>
            <p className="text-xs text-gray-400 mt-0.5">All system actions are immutably logged for compliance</p>
          </div>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading audit logs...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Timestamp', 'User', 'Action', 'Resource', 'Resource ID', 'IP Address'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLogs?.data?.map((log) => (
                    <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                        {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{log.user?.name ?? <span className="text-gray-300">System</span>}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{log.action}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{log.resource}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-400">
                        {log.resourceId ? `${log.resourceId.slice(0, 8)}…` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{log.ipAddress ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
