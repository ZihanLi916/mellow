import type { Entitlement } from './plans';
import { personalModelAllowed } from './productBoundary';

/**
 * The cost audience of an account.
 *
 * This is the only place that turns an entitlement into a photo-assistance bucket, because it is the
 * only layer allowed to read plan vocabulary. Everything downstream — quotas, telemetry, reporting —
 * consumes an audience label or an allowance key and never a plan.
 *
 * Free's first qualifying nights are acquisition rather than the normal Free allowance, and an
 * account whose subscription ended is its own bucket while using the Free allowance again.
 */
export const COST_AUDIENCES = ['FREE_ONBOARDING', 'FREE_POST_ONBOARDING', 'PREMIUM', 'EXPIRED_PREMIUM'] as const;
export type CostAudience = (typeof COST_AUDIENCES)[number];

/**
 * Which configured allowance an audience spends.
 *
 * Deliberately decoupled from plan vocabulary: the guardrails map this key onto numbers, so a future
 * plan change becomes a change here and nowhere else. `EXPIRED_SUBSCRIBER` shares the Free numbers
 * on purpose while remaining a distinct reporting bucket.
 */
export const COST_ALLOWANCE_KEYS = ['ONBOARDING', 'FREE', 'SUBSCRIBER', 'EXPIRED_SUBSCRIBER'] as const;
export type CostAllowanceKey = (typeof COST_ALLOWANCE_KEYS)[number];

export const COST_AUDIENCE_ALLOWANCE_KEYS: Record<CostAudience, CostAllowanceKey> = {
  FREE_ONBOARDING: 'ONBOARDING',
  FREE_POST_ONBOARDING: 'FREE',
  PREMIUM: 'SUBSCRIBER',
  EXPIRED_PREMIUM: 'EXPIRED_SUBSCRIBER',
};

export type CostAudienceInput = {
  entitlement: Entitlement;
  /** Completed qualifying drinking nights, from the audited session semantics. */
  qualifyingNights: number;
  /** The configured length of the onboarding phase. */
  freeOnboardingNights: number;
  asOf: Date;
};

/**
 * True only for an account that owned the paid plan, no longer does, and is therefore back on the
 * Free photo allowance. A `DEFAULT` entitlement (never subscribed) can never be "expired".
 */
export function isExpiredCostEntitlement(entitlement: Entitlement, asOf: Date): boolean {
  if (personalModelAllowed(entitlement)) return false;
  if (entitlement.source !== 'STORE') return false;
  if (!entitlement.expiresAt) return false;
  const expiry = Date.parse(entitlement.expiresAt);
  return Number.isFinite(expiry) && expiry <= asOf.getTime();
}

/** The audience an account belongs to right now. */
export function costAudienceFor(input: CostAudienceInput): CostAudience {
  if (isExpiredCostEntitlement(input.entitlement, input.asOf)) return 'EXPIRED_PREMIUM';
  if (personalModelAllowed(input.entitlement)) return 'PREMIUM';
  return input.qualifyingNights < input.freeOnboardingNights ? 'FREE_ONBOARDING' : 'FREE_POST_ONBOARDING';
}

/** The configured allowance an account spends. */
export function costAllowanceKeyFor(input: CostAudienceInput): CostAllowanceKey {
  return COST_AUDIENCE_ALLOWANCE_KEYS[costAudienceFor(input)];
}
