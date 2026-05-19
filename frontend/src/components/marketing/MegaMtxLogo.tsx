import { Link } from 'react-router-dom';
import clsx from 'clsx';

interface MegaMtxLogoProps {
  variant?: 'light' | 'dark';
  showTagline?: boolean;
  className?: string;
}

export default function MegaMtxLogo({ variant = 'dark', showTagline = true, className }: MegaMtxLogoProps) {
  const isLight = variant === 'light';
  return (
    <Link to="/" className={clsx('inline-flex items-center gap-3 group', className)}>
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/30 transition-shadow">
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" aria-hidden>
          <path
            d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div>
        <div className={clsx('font-bold text-lg leading-tight', isLight ? 'text-white' : 'text-slate-900')}>
          MegaMTX
        </div>
        {showTagline && (
          <div className={clsx('text-xs', isLight ? 'text-slate-400' : 'text-slate-500')}>
            Maintenance Management
          </div>
        )}
      </div>
    </Link>
  );
}
