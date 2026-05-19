import { Link } from 'react-router-dom';
import MegaMtxLogo from './MegaMtxLogo';

interface AuthPageLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function AuthPageLayout({ title, subtitle, children, footer }: AuthPageLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <MegaMtxLogo showTagline={false} />
          <Link to="/" className="text-sm text-slate-600 hover:text-blue-600">
            Home
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">{children}</div>
          {footer && <div className="mt-6">{footer}</div>}
        </div>
      </main>
      <footer className="py-6 text-center text-xs text-slate-400 space-x-4">
        <Link to="/privacy" className="hover:text-slate-600">
          Privacy
        </Link>
        <Link to="/terms" className="hover:text-slate-600">
          Terms
        </Link>
        <span>FDA 21 CFR Part 11 ready</span>
      </footer>
    </div>
  );
}
