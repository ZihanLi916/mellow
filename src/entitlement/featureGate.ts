import {
  CAPABILITIES,
  PERSONAL_CAPABILITIES,
  SAFETY_CAPABILITIES,
  capabilityDefinition,
  isSafetyCapability,
  type Capability,
  type CapabilityPhase,
} from './capabilities';
import { planLabel, planRank, type Entitlement, type EntitlementSource, type UserPlan } from './plans';
import {
  defaultEntitlementProvider,
  developmentOverrideAvailable,
  resolveEntitlement,
  type EntitlementProvider,
  type EntitlementResolutionOptions,
} from './providers';

export type GateReason = 'ENTITLEMENT_REQUIRED' | 'INCLUDED_FOR_EVERYONE';

export type GateDecision = {
  capability: Capability;
  allowed: boolean;
  currentPlan: UserPlan;
  requiredPlan: UserPlan;
  phase: CapabilityPhase;
  reason: GateReason;
};

export class CapabilityDeniedError extends Error {
  readonly code = 'ENTITLEMENT_REQUIRED' as const;
  readonly capability: Capability;
  readonly requiredPlan: UserPlan;
  constructor(capability: Capability, requiredPlan: UserPlan) {
    super(`ENTITLEMENT_REQUIRED:${capability}`);
    this.name = 'CapabilityDeniedError';
    this.capability = capability;
    this.requiredPlan = requiredPlan;
  }
}

export type EntitlementSummary = {
  plan: UserPlan;
  planLabel: string;
  source: EntitlementSource;
  simulated: boolean;
  developmentAvailable: boolean;
  /** True only for server-allowlisted internal testers. Drives experimental (beta) surfaces. */
  internalTester: boolean;
  capabilities: Capability[];
  premiumCapabilities: Capability[];
  safetyCapabilities: Capability[];
};

/** Safety is a floor, not a tier: it stays identical on every plan, simulated or not. */
export function canAccessCapability(entitlement: Entitlement, capability: Capability): boolean {
  if (isSafetyCapability(capability)) return true;
  return planRank(entitlement.plan) >= planRank(capabilityDefinition(capability).minimumPlan);
}

export function describeAccess(entitlement: Entitlement, capability: Capability): GateDecision {
  const definition = capabilityDefinition(capability);
  const allowed = canAccessCapability(entitlement, capability);
  return {
    capability,
    allowed,
    currentPlan: entitlement.plan,
    requiredPlan: definition.minimumPlan,
    phase: definition.phase,
    reason: definition.kind === 'SAFETY' ? 'INCLUDED_FOR_EVERYONE' : allowed ? 'INCLUDED_FOR_EVERYONE' : 'ENTITLEMENT_REQUIRED',
  };
}

export function getAvailableCapabilities(entitlement: Entitlement): Capability[] {
  return CAPABILITIES.filter((capability) => canAccessCapability(entitlement, capability));
}

export function requireCapability(entitlement: Entitlement, capability: Capability): void {
  if (!canAccessCapability(entitlement, capability))
    throw new CapabilityDeniedError(capability, capabilityDefinition(capability).minimumPlan);
}


export type FeatureGateService = {
  readonly provider: EntitlementProvider;
  readonly development: boolean;
  getEntitlement(userId: string | null): Entitlement;
  getUserPlan(userId: string | null): UserPlan;
  canAccess(userId: string | null, capability: Capability): boolean;
  describe(userId: string | null, capability: Capability): GateDecision;
  require(userId: string | null, capability: Capability): void;
  getAvailableCapabilities(userId: string | null): Capability[];
  getSummary(userId: string | null, requested?: { developmentPlan?: UserPlan | null }): EntitlementSummary;
};

/**
 * The only place plan lookup happens. Feed it a different `provider` and every caller follows.
 * The production default resolves every real account to Free.
 */
export function createFeatureGateService(
  config: Partial<EntitlementResolutionOptions> = {},
): FeatureGateService {
  const options: EntitlementResolutionOptions = {
    provider: config.provider ?? defaultEntitlementProvider,
    development: config.development === true,
    developmentPlan: config.developmentPlan ?? null,
  };
  const entitlementFor = (userId: string | null, requested?: { developmentPlan?: UserPlan | null }) =>
    resolveEntitlement(userId, {
      ...options,
      developmentPlan: requested?.developmentPlan ?? options.developmentPlan ?? null,
    });
  return {
    provider: options.provider as EntitlementProvider,
    development: options.development === true,
    getEntitlement: (userId) => entitlementFor(userId),
    getUserPlan: (userId) => entitlementFor(userId).plan,
    canAccess: (userId, capability) => canAccessCapability(entitlementFor(userId), capability),
    describe: (userId, capability) => describeAccess(entitlementFor(userId), capability),
    require: (userId, capability) => requireCapability(entitlementFor(userId), capability),
    getAvailableCapabilities: (userId) => getAvailableCapabilities(entitlementFor(userId)),
    getSummary: (userId, requested) => summarizeEntitlement(entitlementFor(userId, requested), options),
  };
}

/** Production instance: every real user is Free until a store provider is registered. */
export const featureGate = createFeatureGateService();


/**
 * Capability check against an already-resolved summary. The client never re-derives plan rules;
 * it asks whether the server-resolved capability list contains the capability.
 */
export function capabilityAllowed(summary: EntitlementSummary, capability: Capability): boolean {
  return summary.capabilities.includes(capability) || isSafetyCapability(capability);
}

/**
 * Round-trips the wire summary back into the entitlement shape so projections can run on the
 * client without ever resolving a plan there.
 */
export function entitlementFromSummary(summary: EntitlementSummary): Entitlement {
  return {
    userId: null,
    plan: summary.plan,
    source: summary.source,
    simulated: summary.simulated,
    subscriptionTier: summary.plan,
    updatedAt: null,
    expiresAt: null,
    internalTester: summary.internalTester,
  };
}

/** The single question product code is allowed to ask. */
export function canUserAccess(userId: string | null, capability: Capability): boolean {
  return featureGate.canAccess(userId, capability);
}


export function summarizeEntitlement(
  entitlement: Entitlement,
  options: EntitlementResolutionOptions = {},
): EntitlementSummary {
  return {
    plan: entitlement.plan,
    planLabel: planLabel(entitlement.plan),
    source: entitlement.source,
    simulated: entitlement.simulated,
    developmentAvailable: developmentOverrideAvailable(options),
    internalTester: entitlement.internalTester,
    capabilities: getAvailableCapabilities(entitlement),
    premiumCapabilities: PERSONAL_CAPABILITIES.filter(
      (capability) => capabilityDefinition(capability).minimumPlan !== 'FREE',
    ),
    safetyCapabilities: [...SAFETY_CAPABILITIES],
  };
}
