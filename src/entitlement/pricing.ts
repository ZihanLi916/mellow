import { z } from 'zod';

/**
 * Mellow product pricing.
 *
 * The only place a price is written down. Surfaces read it from here and nothing else, so a price
 * change is one edit, and a plan's value is never re-derived from a number typed into a component.
 *
 * This is deliberately not a checkout: no payment, no receipt and no entitlement is produced here.
 * Money never grants access in this codebase — the entitlement layer does.
 */

export const PRODUCT_PRICING_VERSION = 'mellow-pricing-v0.3';

export type ProductPricing = {
  currency: 'USD';
  /** Monthly subscription price, in USD. */
  monthlyPriceUsd: number;
  /** Annual subscription price, in USD. */
  annualPriceUsd: number;
};

/**
 * Planned launch prices. The TestFlight preview does not charge. Product defaults, not permanent business constants.
 * The annual price is presented as a per-year total; the monthly equivalent is derived, never stored.
 */
export const DEFAULT_PRODUCT_PRICING: ProductPricing = {
  currency: 'USD',
  monthlyPriceUsd: 9.99,
  annualPriceUsd: 99.99,
};

export const PRODUCT_PRICING_ENV_NAMES = {
  monthlyPriceUsd: 'MELLOW_MONTHLY_PRICE_USD',
  annualPriceUsd: 'MELLOW_ANNUAL_PRICE_USD',
} as const;

const priceSchema = z.number().min(0).max(100000);

export type ResolvedProductPricing = {
  pricing: ProductPricing;
  problems: string[];
  pricingVersion: string;
};

/** Environment overrides, validated. An invalid price falls back rather than showing a wrong number. */
export function resolveProductPricing(env: Record<string, unknown> = {}): ResolvedProductPricing {
  const problems: string[] = [];
  const read = (name: string, fallback: number): number => {
    if (!(name in env)) return fallback;
    const raw = env[name];
    const value = typeof raw === 'string' ? Number(raw.trim()) : raw;
    const parsed = priceSchema.safeParse(value);
    if (!parsed.success) {
      problems.push(name);
      return fallback;
    }
    return parsed.data;
  };
  return {
    pricing: {
      currency: 'USD',
      monthlyPriceUsd: read(PRODUCT_PRICING_ENV_NAMES.monthlyPriceUsd, DEFAULT_PRODUCT_PRICING.monthlyPriceUsd),
      annualPriceUsd: read(PRODUCT_PRICING_ENV_NAMES.annualPriceUsd, DEFAULT_PRODUCT_PRICING.annualPriceUsd),
    },
    problems,
    pricingVersion: PRODUCT_PRICING_VERSION,
  };
}

/** Monthly-equivalent price of the annual plan. Presentation only; never an entitlement decision. */
export function annualMonthlyEquivalent(pricing: ProductPricing): number | null {
  if (pricing.annualPriceUsd <= 0) return null;
  return Math.round((pricing.annualPriceUsd / 12) * 100) / 100;
}

/** How much the annual plan saves against twelve monthly payments, as a whole percent. */
export function annualSavingPercent(pricing: ProductPricing): number | null {
  const twelveMonths = pricing.monthlyPriceUsd * 12;
  if (twelveMonths <= 0) return null;
  return Math.round(((twelveMonths - pricing.annualPriceUsd) / twelveMonths) * 100);
}

/** Business candidates only. Inactive presentation values only. */
export const PLANNED_INTRO = {monthlyTrialDays: 7, requiresActiveSubscription: true,
  annualFirstYearCandidateUsd: 69.99, annualRenewalUsd: 99.99, active: false} as const;
