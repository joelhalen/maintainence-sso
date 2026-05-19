import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { Ticket, AlertTriangle, CheckCircle, Wrench } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface SummaryData {
  statusCounts: { status: string; _count: number }[];
  priorityCounts: { priority: string; _count: number }[];
  overdueCount: number;
  avgActualHours: number | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#f97316', CRITICAL: '#ef4444',
};

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery<SummaryData>({
    queryKey: ['reports/summary'],
    queryFn: () => api.get('/reports/summary').then((r) => r.data),
  });

  const statusCounts = data?.statusCounts ?? [];
  const priorityCounts = data?.priorityCounts ?? [];

  const openCount = statusCounts.find((s) => s.status === 'OPEN')?._count ?? 0;
  const inProgressCount = statusCounts.find((s) => s.status === 'IN_PROGRESS')?._count ?? 0;
  const completedCount = statusCounts.find((s) => s.status === 'COMPLETED')?._count ?? 0;
  const overdueCount = data?.overdueCount ?? 0;

  const stats = [
    { label: 'Open', value: openCount, icon: Ticket, color: 'bg-blue-500' },
    { label: 'In Progress', value: inProgressCount, icon: Wrench, color: 'bg-yellow-500' },
    { label: 'Overdue', value: overdueCount, icon: AlertTriangle, color: 'bg-red-500' },
    { label: 'Completed', value: completedCount, icon: CheckCircle, color: 'bg-green-500' },
  ];

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  if (isError) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          Unable to load dashboard data. You may not have permission, or the server is unavailable.
        </div>
      </div>
    );
  }

  const statusChartData = statusCounts.map((s) => ({
    name: s.status.replace(/_/g, ' '),
    count: s._count,
  }));
  const priorityChartData = priorityCounts.map((p) => ({
    name: p.priority,
    value: p._count,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
              <div className={`${color} p-3 rounded-xl`}>
                <Icon size={20} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Tickets by Status</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Open Tickets by Priority</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={priorityChartData}
                cx="50%" cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={false}
              >
                {priorityCounts.map((p) => (
                  <Cell key={p.priority} fill={PRIORITY_COLORS[p.priority] || '#6b7280'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
