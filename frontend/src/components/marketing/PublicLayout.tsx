import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import clsx from 'clsx';
import MegaMtxLogo from './MegaMtxLogo';

const NAV = [
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
];

const FOOTER_LINKS = {
  Product: [
    { to: '/features', label: 'Features' },
    { to: '/pricing', label: 'Pricing' },
  ],
  Account: [
    { to: '/login', label: 'Sign in' },
    { to: '/register', label: 'Register' },
  ],
  Legal: [
    { to: '/privacy', label: 'Privacy Policy' },
    { to: '/terms', label: 'Terms of Service' },
  ],
};

export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <MegaMtxLogo showTagline={false} />

          <nav className="hidden md:flex items-center gap-8">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clsx(
                    'text-sm font-medium transition-colors',
                    isActive ? 'text-blue-600' : 'text-slate-600 hover:text-slate-900',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
            >
              Get started
            </Link>
          </div>

          <button
            type="button"
            className="md:hidden p-2 text-slate-600"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 py-4 space-y-1">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className="block py-2.5 text-sm font-medium text-slate-700"
              >
                {label}
              </NavLink>
            ))}
            <Link to="/login" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-medium text-slate-700">
              Sign in
            </Link>
            <Link
              to="/register"
              onClick={() => setMenuOpen(false)}
              className="block mt-2 text-center text-sm font-medium text-white bg-blue-600 py-2.5 rounded-lg"
            >
              Get started
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <MegaMtxLogo />
              <p className="mt-4 text-sm text-slate-500 leading-relaxed max-w-xs">
                Cloud-ready maintenance ticketing and asset tracking for operations, facilities, and manufacturing teams.
              </p>
            </div>
            {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
              <div key={heading}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">{heading}</h3>
                <ul className="space-y-2">
                  {links.map(({ to, label }) => (
                    <li key={to}>
                      <Link to={to} className="text-sm text-slate-600 hover:text-blue-600 transition-colors">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 pt-8 border-t border-slate-200 flex flex-col sm:flex-row justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} MegaMTX. All rights reserved.</p>
            <p>FDA 21 CFR Part 11 audit trail support · SAML SSO ready</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
