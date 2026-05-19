import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import clsx from 'clsx';
import {
  PublicPlan,
  formatLimit,
  formatPlanPrice,
  TIER_STYLES,
} from '../../lib/subscriptionPlans';

interface PlanPricingCardsProps {
  plans: PublicPlan[];
  highlightTier?: string;
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <li className="flex items-center gap-2 text-sm text-slate-600">
      {enabled ? (
        <Check size={16} className="text-emerald-500 flex-shrink-0" />
      ) : (
        <X size={16} className="text-slate-300 flex-shrink-0" />
      )}
      {label}
    </li>
  );
}

export default function PlanPricingCards({ plans, highlightTier = 'PROFESSIONAL' }: PlanPricingCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {plans.map((plan) => {
        const styles = TIER_STYLES[plan.tier] ?? TIER_STYLES.FREE;
        const highlighted = plan.tier === highlightTier;
        const price = formatPlanPrice(plan.monthlyPriceCents);

        return (
          <div
            key={plan.tier}
            className={clsx(
              'relative flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1',
              styles.ring,
              highlighted && 'shadow-lg',
            )}
          >
            {highlighted && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold bg-indigo-600 text-white">
                Most popular
              </span>
            )}
            <span className={clsx('inline-flex w-fit px-2.5 py-0.5 rounded-md text-xs font-semibold mb-3', styles.badge)}>
              {plan.name}
            </span>
            <div className="mb-1">
              <span className={clsx('text-3xl font-bold', styles.accent)}>{price}</span>
              {plan.monthlyPriceCents != null && plan.monthlyPriceCents > 0 && (
                <span className="text-slate-500 text-sm">/mo</span>
              )}
            </div>
            {plan.description && (
              <p className="text-sm text-slate-500 mb-6 min-h-[2.5rem]">{plan.description}</p>
            )}
            <ul className="space-y-2 mb-6 flex-1 text-sm">
              <li className="text-slate-700">
                <span className="font-medium">{formatLimit(plan.maxActiveUsers)}</span> active users
              </li>
              <li className="text-slate-700">
                <span className="font-medium">{formatLimit(plan.maxLocations)}</span> locations
              </li>
              <li className="text-slate-700">
                <span className="font-medium">{formatLimit(plan.maxAssets)}</span> assets
              </li>
              <li className="text-slate-700">
                <span className="font-medium">{formatLimit(plan.maxActiveTickets)}</span> active tickets
              </li>
            </ul>
            <ul className="space-y-2 mb-6 border-t border-slate-100 pt-4">
              <FeatureRow label="Push notifications" enabled={plan.allowPush} />
              <FeatureRow label="SAML single sign-on" enabled={plan.allowSso} />
              <FeatureRow label="CSV / JSON exports" enabled={plan.allowExports} />
            </ul>
            <Link
              to="/register"
              className={clsx(
                'block text-center py-2.5 rounded-lg text-sm font-semibold transition-colors',
                highlighted
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-slate-900 text-white hover:bg-slate-800',
              )}
            >
              {plan.tier === 'ENTERPRISE' ? 'Contact sales' : 'Get started'}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
