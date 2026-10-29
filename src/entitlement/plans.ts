import { z } from 'zod';

/**
 * Mellow product plans.
 *
 * Free = population-level understanding. Premium = personal-level understanding.
 *
 * These constants are deliberately confined to `src/entitlement/**`. Business code must never
 * compare plan strings; it asks the feature gate (`./featureGate`) for a capability instead, so a
 * future store adapter can change what a user owns without touching product logic.
 */
export const USER_PLANS = ['FREE', 'PREMIUM'] as const;
export type UserPlan = (typeof USER_PLANS)[number];

/** Store-facing vocabulary, reserved for a future RevenueCat / App Store adapter. Nothing writes it yet. */
export const SUBSCRIPTION_TIERS = ['FREE', 'PREMIUM'] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

/** Where an entitlement came from. Only `STORE` will ever represent a real purchase. */
export const ENTITLEMENT_SOURCES = [
  'DEFAULT',
  'DEVELOPMENT_OVERRIDE',
  'STORE',
  'PROMOTION',
  /** Server-derived grant for allowlisted internal testers. Never a purchase; never client-set. */
  'INTERNAL_TESTER',
] as const;
export type EntitlementSource = (typeof ENTITLEMENT_SOURCES)[number];

export type Entitlement = {
  userId: string | null;
  plan: UserPlan;
  source: EntitlementSource;
  /** True only for an explicit, non-persisted development simulation. Never a purchase. */
  simulated: boolean;
  subscriptionTier: SubscriptionTier;
  updatedAt: string | null;
  /** Reserved for a future store adapter. Null means "no expiry information". */
  expiresAt: string | null;
  /**
   * Server-derived flag: true only for allowlisted internal testers. It is set exclusively by the
   * internal-tester entitlement provider (server-side), never from a client signal, so the UI can
   * gate experimental surfaces (e.g. the personal-drinking-model beta) without inventing a plan.
   */
  internalTester: boolean;
};

export const entitlementSchema = z
  .object({
    userId: z.string().min(1).max(200).nullable(),
    plan: z.enum(USER_PLANS),
    source: z.enum(ENTITLEMENT_SOURCES),
    simulated: z.boolean(),
    subscriptionTier: z.enum(SUBSCRIPTION_TIERS),
    updatedAt: z.string().datetime().nullable(),
    expiresAt: z.string().datetime().nullable(),
    internalTester: z.boolean(),
  })
  .strict();

const PLAN_RANK: Record<UserPlan, number> = { FREE: 0, PREMIUM: 1 };

/** Ordering helper for the entitlement layer only. Never use this as an access decision. */
export function planRank(plan: UserPlan): number {
  return PLAN_RANK[plan];
}

export function planLabel(plan: UserPlan): string {
  return plan === 'FREE' ? 'Free' : 'Premium';
}

/**
 * Every real user starts here. This is the only entitlement that exists in production until a
 * store adapter is registered.
 */
export function defaultEntitlement(userId: string | null = null): Entitlement {
  return {
    userId,
    plan: 'FREE',
    source: 'DEFAULT',
    simulated: false,
    subscriptionTier: 'FREE',
    updatedAt: null,
    expiresAt: null,
    internalTester: false,
  };
}

/**
 * Development / QA simulation of a plan. It is never persisted, never billed and never treated as
 * an owned subscription; `source` keeps it distinguishable from a future store entitlement.
 */
export function developmentEntitlement(
  plan: UserPlan,
  userId: string | null = null,
  now: string | null = null,
): Entitlement {
  return {
    userId,
    plan,
    source: 'DEVELOPMENT_OVERRIDE',
    simulated: true,
    subscriptionTier: plan,
    updatedAt: now,
    expiresAt: null,
    internalTester: false,
  };
}

/**
 * Server-derived Premium grant for an allowlisted internal tester.
 *
 * It is only ever produced by `internalTesterEntitlementProvider`, which receives the allowlist from
 * a server-side environment variable. It is NOT simulated, NOT a purchase and must never be reachable
 * from any client signal (query param, browser storage, header). `internalTester: true` lets the UI
 * gate experimental surfaces without inventing a new plan.
 */
export function internalTesterEntitlement(userId: string, now: string | null = null): Entitlement {
  return {
    userId,
    plan: 'PREMIUM',
    source: 'INTERNAL_TESTER',
    simulated: false,
    subscriptionTier: 'PREMIUM',
    updatedAt: now,
    expiresAt: null,
    internalTester: true,
  };
}

export function isSimulatedEntitlement(entitlement: Entitlement): boolean {
  return entitlement.simulated || entitlement.source === 'DEVELOPMENT_OVERRIDE';
}
