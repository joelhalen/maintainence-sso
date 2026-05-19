import { Link } from 'react-router-dom';
import PageHero from '../../components/marketing/PageHero';
import {
  ClipboardList,
  Wrench,
  MapPin,
  Users,
  FileSignature,
  ScrollText,
  Download,
  KeyRound,
  Bell,
  Layers,
} from 'lucide-react';

const SECTIONS = [
  {
    title: 'Work management',
    items: [
      {
        icon: ClipboardList,
        name: 'Ticket lifecycle',
        detail:
          'OPEN → IN_PROGRESS → PENDING_PARTS / PENDING_REVIEW → COMPLETED → CLOSED with full status history, assignments, priorities, and file attachments.',
      },
      {
        icon: Wrench,
        name: 'Asset registry',
        detail:
          'Track serial numbers, warranty dates, categories, and maintenance history so every work order is tied to equipment context.',
      },
      {
        icon: MapPin,
        name: 'Location hierarchy',
        detail: 'Nested sites, buildings, and zones to mirror how your facilities are organized.',
      },
    ],
  },
  {
    title: 'Governance & compliance',
    items: [
      {
        icon: ScrollText,
        name: 'Audit trail',
        detail:
          'Append-only log of create, update, and delete actions across tickets, assets, users, and settings — suitable for FDA 21 CFR Part 11 programs.',
      },
      {
        icon: FileSignature,
        name: 'Electronic signatures',
        detail: 'Cryptographic sign-off on ticket completion with signer identity captured in the audit record.',
      },
      {
        icon: Users,
        name: 'Role-based access',
        detail:
          '26 granular permissions across six system roles, plus custom groups and permission rules for fine-grained control.',
      },
    ],
  },
  {
    title: 'Connectivity & scale',
    items: [
      {
        icon: Bell,
        name: 'Notifications',
        detail:
          'SMTP email with reply threading, inbound IMAP polling, Firebase push for mobile, and per-user notification preferences.',
      },
      {
        icon: KeyRound,
        name: 'SAML SSO',
        detail: 'Optional Azure AD, Okta, or other SAML identity providers on Professional and Enterprise plans.',
      },
      {
        icon: Download,
        name: 'Exports',
        detail: 'CSV and JSON ticket exports for reporting pipelines (plan-gated on paid tiers).',
      },
      {
        icon: Layers,
        name: 'Multi-tenant subscriptions',
        detail:
          'Organization-scoped data with plan entitlements for users, locations, assets, active tickets, push, SSO, and exports.',
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        title="Capabilities built for serious maintenance programs"
        subtitle="From the shop floor to the quality office — tickets, assets, compliance, and integrations in one cohesive system."
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 space-y-16">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-xl font-bold text-slate-900 mb-6">{section.title}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {section.items.map(({ icon: Icon, name, detail }) => (
                <article
                  key={name}
                  className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <Icon size={22} className="text-blue-600 mb-3" />
                  <h3 className="font-semibold text-slate-900">{name}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{detail}</p>
                </article>
              ))}
            </div>
          </section>
        ))}
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-6 py-8 text-center">
          <p className="text-slate-700 mb-4">Ready to see plans and limits for your team size?</p>
          <Link
            to="/pricing"
            className="inline-flex px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
          >
            View pricing
          </Link>
        </div>
      </div>
    </>
  );
}
