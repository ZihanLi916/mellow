import {
  defaultEntitlement,
  developmentEntitlement,
  internalTesterEntitlement,
  isSimulatedEntitlement,
  planRank,
  USER_PLANS,
  type Entitlement,
  type UserPlan,
} from './plans';

/**
 * The one seam a real store adapter will replace.
 *
 * Today the only registered provider returns Free for every user. When RevenueCat / App Store
 * subscription validation arrives it becomes another `EntitlementProvider`; no business code,
 * capability or screen changes.
 */
export interface EntitlementProvider {
  readonly id: string;
  getEntitlement(userId: string | null): Entitlement;
}

export const defaultEntitlementProvider: EntitlementProvider = {
  id: 'default-free',
  getEntitlement: (userId) => defaultEntitlement(userId),
};

/**
 * Parses the server-side allowlist of internal-tester account ids. The value comes from an
 * environment variable (e.g. `MELLOW_INTERNAL_TESTER_ACCOUNTS`) and is read ONLY on the server,
 * where the session identity is established. Empty or unset input yields an empty set, in which case
 * the provider degrades to the Free default for everyone — no client signal can add an id.
 */
export function parseInternalTesterAccounts(...values: Array<string | null | undefined>): string[] {
  const value=values.filter(Boolean).join(',');
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );
}

/**
 * Internal-tester provider. For an allowlisted user it returns a real (non-simulated) Premium
 * entitlement with `internalTester: true`. Everyone else falls back to the Free default.
 *
 * This is the ONLY server-side path that produces Premium outside a future store adapter. It must be
 * constructed with the allowlist resolved from `process.env` / the Worker `env` binding, never from a
 * request, cookie, header or browser-storage value.
 */
export function createInternalTesterProvider(allowlist: readonly string[]): EntitlementProvider {
  const allowed = new Set(allowlist);
  return {
    id: 'internal-tester',
    getEntitlement: (userId) => {
      if (userId && allowed.has(userId)) return internalTesterEntitlement(userId);
      return defaultEntitlement(userId);
    },
  };
}

/**
 * Development-only query flag used to simulate a plan for QA. It is never persisted, never billed,
 * never exported and never treated as ownership. Real users keep the default Free entitlement.
 */
export const DEVELOPMENT_PLAN_PARAM = 'plan';

export function parseDevelopmentPlan(value: string | null | undefined): UserPlan | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return (USER_PLANS as readonly string[]).includes(normalized) ? (normalized as UserPlan) : null;
}

export type EntitlementResolutionOptions = {
  /** Server development mode. Without it no simulation is possible at all. */
  development?: boolean;
  /** Plan requested through the explicit development-only signal. */
  developmentPlan?: UserPlan | null;
  /** Registered entitlement source. Defaults to the Free provider. */
  provider?: EntitlementProvider;
};

export function resolveEntitlement(
  userId: string | null,
  options: EntitlementResolutionOptions = {},
): Entitlement {
  const provider = options.provider ?? defaultEntitlementProvider;
  const owned = provider.getEntitlement(userId);
  const requested = options.development ? (options.developmentPlan ?? null) : null;
  // A simulation may only add access, never silently remove something a real source granted.
  if (!requested || planRank(requested) <= planRank(owned.plan)) return owned;
  return developmentEntitlement(requested, userId);
}

/** True only when this runtime may offer a developer entitlement override at all. */
export function developmentOverrideAvailable(options: EntitlementResolutionOptions = {}): boolean {
  return options.development === true;
}

export { isSimulatedEntitlement };
