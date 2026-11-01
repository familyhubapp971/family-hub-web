import { useNavigate } from 'react-router-dom';
import { PricingCard, type PricingFeature } from '@familyhub/ui';
import { SiteHeader, SiteFooter, MAIN_CONTENT_ID } from '../SiteChrome';

// Pricing page: port of Magic Patterns design
// kudjspxd3xxroueg5jw11o pages/Pricing.tsx. Tier copy is the source of
// truth for marketing until Stripe wiring lands in Sprint 5
// (FHS-68/70/71). Layout sized to fit a 1080p viewport without scroll.
// Card composition lives in the design-system PricingCard primitive
// (FHS-245).

interface Tier {
  name: string;
  price: string;
  priceSuffix?: string;
  ctaLabel: string;
  ctaVariant: 'primary' | 'secondary';
  featured?: boolean;
  features: PricingFeature[];
}

const tiers: Tier[] = [
  {
    name: 'Household',
    price: 'Free',
    ctaLabel: 'Get started',
    ctaVariant: 'secondary',
    features: [
      { label: 'Up to 3 members', included: true },
      { label: 'Shared calendar', included: true },
      { label: 'Basic task lists', included: true },
      { label: 'Unlimited members', included: false },
      { label: 'Sticker economy', included: false },
    ],
  },
  {
    name: 'Family',
    price: '$7.99',
    priceSuffix: '/mo',
    ctaLabel: 'Start free trial',
    ctaVariant: 'primary',
    featured: true,
    features: [
      { label: 'Unlimited members', included: true },
      { label: 'All calendar features', included: true },
      { label: 'Chores + habits', included: true },
      { label: 'Sticker economy', included: true },
      { label: 'Ramadan / Hijri', included: true },
      { label: 'Custom subdomain', included: false },
    ],
  },
  {
    name: 'Family Pro',
    price: '$12.99',
    priceSuffix: '/mo',
    ctaLabel: 'Start free trial',
    ctaVariant: 'secondary',
    features: [
      { label: 'Everything in Family', included: true },
      { label: 'Custom subdomain', included: true },
      { label: 'World Flags module', included: true },
      { label: 'Logic games', included: true },
      { label: 'Priority support', included: true },
      { label: 'Annual = 2 months free', included: true },
    ],
  },
];

export function PricingPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-kingdom-bg font-body text-white">
      {/* FHS-546: shared chrome so Pricing matches the homepage + /legal
          (Legal link in the nav, full legal footer). */}
      <SiteHeader current="pricing" />

      <main
        id={MAIN_CONTENT_ID}
        className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center px-6 pb-6 pt-6 md:pt-10"
      >
        <div className="mb-6 text-center sm:mb-16 md:mb-20">
          <h1 className="mb-1 font-heading text-2xl md:text-3xl lg:text-4xl">
            Simple, honest pricing
          </h1>
          <p className="text-sm text-purple-200 md:text-base">
            One bill for the whole family: mums, dads, kids, the lot. No per-seat surprises, cancel
            any time, two months free on annual plans.
          </p>
        </div>

        <div className="grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {tiers.map((tier) => (
            <PricingCard
              key={tier.name}
              name={tier.name}
              price={tier.price}
              {...(tier.priceSuffix ? { priceSuffix: tier.priceSuffix } : {})}
              ctaLabel={tier.ctaLabel}
              ctaVariant={tier.ctaVariant}
              onCta={() => navigate('/signup')}
              features={tier.features}
              {...(tier.featured ? { featured: true } : {})}
            />
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
