import { Outlet, NavLink, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Ticket, Wrench, MapPin, Users, BarChart3,
  LogOut, Menu, X, ChevronRight, Bell, CreditCard, Mail, ShieldCheck
} from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { Permission } from '../types';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
  permission: Permission;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',          label: 'Dashboard', icon: LayoutDashboard, end: true, permission: 'REPORT_VIEW'   },
  { to: '/tickets',   label: 'Tickets',   icon: Ticket,                     permission: 'TICKET_READ'   },
  { to: '/assets',    label: 'Assets',    icon: Wrench,                     permission: 'ASSET_READ'    },
  { to: '/locations', label: 'Locations', icon: MapPin,                     permission: 'LOCATION_READ' },
  { to: '/users',     label: 'Users',     icon: Users,                      permission: 'USER_READ'     },
  { to: '/reports',   label: 'Reports',   icon: BarChart3,                  permission: 'REPORT_VIEW'   },
  { to: '/groups',    label: 'Groups',    icon: ShieldCheck,                permission: 'GROUP_MANAGE'  },
];

export default function Layout() {
  const { user, logout, hasPermission, isPlatformAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleNavItems = NAV_ITEMS.filter((item) => hasPermission(item.permission));

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-30 w-64 bg-gray-900 text-white flex flex-col transition-transform duration-200 lg:relative lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700 flex-shrink-0">
          <div>
            <div className="text-sm font-bold text-white">MegaMTX</div>
            <div className="text-xs text-gray-400">Maintenance System</div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {user?.name[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white truncate">{user?.name}</div>
              <div className="text-xs text-gray-400 truncate">{user?.role?.name}</div>
            </div>
          </div>
          <NavLink
            to="/settings/notifications"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors mb-1 ${
                isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            <Bell size={16} />
            Notifications
          </NavLink>
          {hasPermission('ADMIN_PANEL') && (
            <NavLink
              to="/settings/organization"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors mb-1 ${
                  isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              <CreditCard size={16} />
              Subscription
            </NavLink>
          )}
          {hasPermission('EMAIL_SETTINGS') && (
            <>
              <NavLink
                to="/settings/email"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors mb-1 ${
                    isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`
                }
              >
                <Mail size={16} />
                Email
              </NavLink>
              <NavLink
                to="/settings/push"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors mb-1 ${
                    isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`
                }
              >
                <Bell size={16} />
                Push Notifications
              </NavLink>
            </>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden mr-3 text-gray-500 hover:text-gray-700">
            <Menu size={20} />
          </button>
          <div className="text-sm text-gray-500 flex items-center gap-1">
            <span>MegaMTX</span>
            <ChevronRight size={14} />
            <span className="text-gray-900 font-medium">Maintenance</span>
          </div>
          {isPlatformAdmin && (
            <Link
              to="/platform"
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors"
            >
              <ShieldCheck size={14} />
              Admin Portal
            </Link>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
