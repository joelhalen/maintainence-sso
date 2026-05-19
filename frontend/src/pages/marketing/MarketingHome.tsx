import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ClipboardList,
  Shield,
  Smartphone,
  BarChart3,
  Mail,
  Building2,
} from 'lucide-react';

const HIGHLIGHTS = [
  {
    icon: ClipboardList,
    title: 'Full ticket lifecycle',
    description: 'From open through completion with status history, assignments, and attachments.',
  },
  {
    icon: Building2,
    title: 'Assets & locations',
    description: 'Track equipment, warranties, and nested sites so work is always tied to context.',
  },
  {
    icon: Shield,
    title: 'Audit-ready compliance',
    description: 'Append-only audit logs and electronic signatures designed for 21 CFR Part 11 workflows.',
  },
  {
    icon: BarChart3,
    title: 'Role-based dashboards',
    description: 'Granular permissions so technicians, supervisors, and admins each see what they need.',
  },
  {
    icon: Mail,
    title: 'Email & push',
    description: 'SMTP notifications, inbound reply threading, and Firebase push for mobile teams.',
  },
  {
    icon: Smartphone,
    title: 'Native mobile apps',
    description: 'Capacitor-built iOS and Android clients with automatic device token registration.',
  },
];

const TRUST = [
  'Multi-tenant organizations',
  'Subscription plan entitlements',
  'SAML SSO (Azure AD, Okta)',
  'Self-hosted or managed cloud',
];

export default function MarketingHome() {
  return (
    <>
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(37,99,235,0.45) 0%, transparent 60%), radial-gradient(circle at 90% 80%, rgba(79,70,229,0.25) 0%, transparent 40%)',
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-blue-200 border border-white/10 mb-6">
            Maintenance management for regulated teams
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl leading-[1.1]">
            Run maintenance operations with clarity and control
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl leading-relaxed">
            MegaMTX unifies tickets, assets, and locations in one platform — with audit trails,
            electronic sign-off, and subscription tiers that scale from pilot teams to enterprise sites.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
            >
              Start free
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/features"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-white/20 hover:bg-white/10 text-white font-semibold transition-colors"
            >
              Explore features
            </Link>
          </div>
          <ul className="mt-12 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
            {TRUST.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Everything your maintenance team needs
            </h2>
            <p className="mt-3 text-slate-600">
              Built for facilities, manufacturing, and lab environments where traceability matters.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                  <Icon size={22} className="text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
          <p className="text-center mt-10">
            <Link to="/features" className="text-blue-600 font-medium hover:text-blue-700 inline-flex items-center gap-1">
              View all capabilities <ArrowRight size={16} />
            </Link>
          </p>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 px-8 py-12 sm:px-12 sm:py-14 text-white flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold">Plans for every stage</h2>
              <p className="mt-3 text-slate-300 max-w-lg">
                Start on Free, grow into Starter or Professional, or talk to us about Enterprise
                with unlimited caps and self-hosted deployment.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
              <Link
                to="/pricing"
                className="px-6 py-3 rounded-lg bg-white text-slate-900 font-semibold text-center hover:bg-slate-100 transition-colors"
              >
                Compare plans
              </Link>
              <Link
                to="/login"
                className="px-6 py-3 rounded-lg border border-white/25 font-semibold text-center hover:bg-white/10 transition-colors"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
