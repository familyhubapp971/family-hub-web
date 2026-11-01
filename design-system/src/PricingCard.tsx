import { Check, X } from 'lucide-react';
import { Button } from './Button';

export interface PricingFeature {
  label: string;
  /** Whether this tier includes the feature. Off → grey + X icon. */
  included: boolean;
}

interface PricingCardProps {
  /** Tier name: Household, Family, Family Pro etc. */
  name: string;
  /** Display price: "Free", "$7.99", "£12.99". */
  price: string;
  /** Optional suffix like "/mo" or "/yr" rendered next to the price. */
  priceSuffix?: string;
  /** CTA button label. */
  ctaLabel: string;
  /** CTA Button variant from design-system Button. */
  ctaVariant?: 'primary' | 'secondary';
  /** Fires when the CTA is clicked. */
  onCta: () => void;
  /** Ordered feature list. Included rows render bold + green check; excluded render grey + X. */
  features: PricingFeature[];
  /**
   * When true, the card highlights with a 4px yellow border + the
   * "Most popular" floating badge. Use sparingly, exactly one tier
   * should be featured per page.
   */
  featured?: boolean;
  /** Badge label shown when featured=true. Defaults to "Most popular". */
  featuredLabel?: string;
  className?: string;
  testId?: string;
}

/**
 * Pricing tier card used on the Pricing page (FHS-222). A featured
 * tier renders with a 4px yellow border + the "Most popular" badge
 * sitting on the top edge. The tier name + big price + CTA button +
 * feature list compose top-to-bottom.
 *
 * Reuses the design-system Button (with size="sm" + fullWidth) so the
 * CTA stays in lockstep with the rest of the design system.
 */
export function PricingCard({
  name,
  price,
  priceSuffix,
  ctaLabel,
  ctaVariant = 'secondary',
  onCta,
  features,
  featured = false,
  featuredLabel = 'Most popular',
  className = '',
  testId,
}: PricingCardProps) {
  const cardClass = [
    'flex h-full flex-col rounded-xl border-2 bg-white p-4 text-black shadow-neo-lg',
    featured ? 'border-4 border-yellow-400' : 'border-black',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div data-testid={testId} className="relative pt-2">
      {featured && (
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
          <span className="inline-block rounded-full border-2 border-black bg-yellow-300 px-3 py-0.5 text-[10px] font-black text-black shadow-neo-sm">
            {featuredLabel}
          </span>
        </div>
      )}
      <div className={cardClass}>
        <h2 className="mb-0.5 font-heading text-lg">{name}</h2>
        <div className="mb-3 font-heading text-2xl text-pink-600">
          {price === 'Free' ? (
            <span className="text-black">Free</span>
          ) : (
            <>
              {price}
              {priceSuffix && <span className="text-sm text-black">{priceSuffix}</span>}
            </>
          )}
        </div>
        <Button onClick={onCta} variant={ctaVariant} size="sm" fullWidth className="mb-3">
          {ctaLabel}
        </Button>
        <ul className="flex-1 space-y-1.5">
          {features.map((row) => (
            <li
              key={row.label}
              className={[
                'flex items-center gap-2 text-xs md:text-sm',
                row.included ? '' : 'text-gray-400',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {row.included ? (
                <Check className="text-green-600 shrink-0" size={16} aria-hidden="true" />
              ) : (
                <X size={16} className="shrink-0" aria-hidden="true" />
              )}
              <span className={row.included ? 'font-bold' : ''}>{row.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
