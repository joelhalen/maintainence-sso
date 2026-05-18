import { useState } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Building2, CreditCard, ScrollText, Settings2,
  ShieldCheck, ArrowLeft, Menu, X, ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/platform',             label: 'Dashboard',          icon: LayoutDashboard, end: true },
  { to: '/platform/organizations', label: 'Organizations',    icon: Building2 },
  { to: '/platform/plans',       label: 'Subscription Plans', icon: CreditCard },
  { to: '/platform/audit',       label: 'Audit Log',          icon: ScrollText },
  { to: '/platform/system-config', label: 'System Config',   icon: Settings2 },
];

const BREADCRUMB_MAP: Record<string, string> = {
  '/platform':                          'Overview',
  '/platform/organizations':            'Organizations',
  '/platform/plans':                    'Subscription Plans',
  '/platform/audit':                    'Audit Log',
  '/platform/system-config':            'System Config',
};

function getPageLabel(pathname: string): string {
  // Exact match first
  if (BREADCRUMB_MAP[pathname]) return BREADCRUMB_MAP[pathname];

  // /platform/organizations/:id/roles
  if (/^\/platform\/organizations\/[^/]+\/roles$/.test(pathname)) return 'Role Permissions';

  // /platform/organizations/:id
  if (/^\/platform\/organizations\/[^/]+$/.test(pathname)) return 'Organization Detail';

  return 'Platform Administration';
}

export default function AdminLayout() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const pageLabel = getPageLabel(location.pathname);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-30 w-64 bg-slate-950 text-slate-100 flex flex-col transition-transform duration-200 lg:relative lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        {/* Sidebar header / branding */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={20} className="text-violet-400 flex-shrink-0" />
            <div>
              <div className="text-white font-bold text-sm leading-tight">Platform Admin</div>
              <div className="text-slate-500 text-xs leading-tight">MegaMTX Control Center</div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] uppercase tracking-widest text-slate-500">
            Navigation
          </div>
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              )}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-slate-800 p-4 flex-shrink-0">
          {/* User info */}
          <div className="mb-3 min-w-0">
            <div className="text-sm font-medium text-slate-200 truncate">{user?.name}</div>
            <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          </div>
          {/* Return to App */}
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={16} />
            Return to App
          </Link>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top header bar */}
        <header className="h-14 bg-slate-950 border-b border-slate-800 flex items-center px-4 gap-3 flex-shrink-0">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="lg:hidden text-slate-400 hover:text-white flex-shrink-0"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm min-w-0">
            <span className="text-slate-400 whitespace-nowrap">Platform Administration</span>
            <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
            <span className="text-slate-200 font-medium truncate">{pageLabel}</span>
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-3 flex-shrink-0">
            {/* SUPER ADMIN badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30">
              <ShieldCheck size={12} className="text-amber-400" />
              <span className="text-amber-400 text-[11px] font-bold tracking-widest uppercase">
                Super Admin
              </span>
            </div>
            {/* User name */}
            <span className="text-slate-300 text-sm hidden sm:block">{user?.name}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
