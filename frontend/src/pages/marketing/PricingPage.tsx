import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import PageHero from '../../components/marketing/PageHero';
import PlanPricingCards from '../../components/marketing/PlanPricingCards';
import { FALLBACK_PLANS, PublicPlan } from '../../lib/subscriptionPlans';

export default function PricingPage() {
  const { data: plans = FALLBACK_PLANS, isLoading } = useQuery<PublicPlan[]>({
    queryKey: ['public-plans'],
    queryFn: () => api.get<PublicPlan[]>('/public/plans').then((r) => r.data),
    staleTime: 60_000,
  });

  return (
    <>
      <PageHero
        title="Simple, transparent pricing"
        subtitle="Every organization starts with entitlements tied to a subscription tier. Upgrade as you add sites, assets, and users."
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        {isLoading ? (
          <p className="text-center text-slate-500 text-sm">Loading plans…</p>
        ) : (
          <PlanPricingCards plans={plans} />
        )}
        <div className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-6 sm:p-8 text-sm text-slate-600 space-y-3">
          <p>
            <strong className="text-slate-900">Billing:</strong> PayPal checkout integration is scaffolded for a
            future release. Platform administrators can assign plans manually during pilot deployments.
          </p>
          <p>
            <strong className="text-slate-900">Self-hosted:</strong> Enterprise customers may deploy MegaMTX on their
            own infrastructure with unlimited usage caps.{' '}
            <Link to="/register" className="text-blue-600 hover:underline">
              Contact your administrator
            </Link>{' '}
            for an organization code to register.
          </p>
        </div>
      </div>
    </>
  );
}
