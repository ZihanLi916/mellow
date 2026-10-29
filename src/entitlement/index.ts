/**
 * Mellow entitlement layer.
 *
 * Free = population-level understanding. Premium = personal-level understanding.
 *
 * Everything about plans, capabilities and access decisions lives here. Product code asks this
 * module (`canUserAccess`, `capabilityAllowed`) and never inspects a plan itself, so connecting a
 * real store subscription later replaces one provider and nothing else.
 */
export {
  USER_PLANS,
  SUBSCRIPTION_TIERS,
  ENTITLEMENT_SOURCES,
  entitlementSchema,
  defaultEntitlement,
  developmentEntitlement,
  internalTesterEntitlement,
  isSimulatedEntitlement,
  planLabel,
  planRank,
  type Entitlement,
  type EntitlementSource,
  type SubscriptionTier,
  type UserPlan,
} from './plans';
export {
  CAPABILITIES,
  CAPABILITY_DEFINITIONS,
  CORE_CAPABILITIES,
  PERSONAL_CAPABILITIES,
  RESERVED_CAPABILITIES,
  SAFETY_CAPABILITIES,
  capabilitiesForMinimumPlan,
  capabilityDefinition,
  isCapabilityShipped,
  isSafetyCapability,
  minimumPlanFor,
  type Capability,
  type CapabilityDefinition,
  type CapabilityKind,
  type CapabilityPhase,
} from './capabilities';
export {
  DEVELOPMENT_PLAN_PARAM,
  createInternalTesterProvider,
  defaultEntitlementProvider,
  developmentOverrideAvailable,
  parseDevelopmentPlan,
  parseInternalTesterAccounts,
  resolveEntitlement,
  type EntitlementProvider,
  type EntitlementResolutionOptions,
} from './providers';
export {
  CapabilityDeniedError,
  canAccessCapability,
  canUserAccess,
  capabilityAllowed,
  createFeatureGateService,
  describeAccess,
  entitlementFromSummary,
  featureGate,
  getAvailableCapabilities,
  requireCapability,
  summarizeEntitlement,
  type EntitlementSummary,
  type FeatureGateService,
  type GateDecision,
  type GateReason,
} from './featureGate';
export {
  MIN_RESPONSE_EVIDENCE_NIGHTS,
  PERSONAL_PROFILE_VERSION,
  RESPONSE_CATEGORIES,
  buildPersonalDrinkingProfile,
  familiarityMaturity,
  unevaluatedPersonalModelConfidence,
  unevaluatedResponseCategory,
  type ContextEffect,
  type DrinkingArchetype,
  type MaturitySource,
  type ModelMaturity,
  type PersonalBaseline,
  type PersonalDrinkingProfile,
  type PersonalDrinkingProfileInput,
  type PersonalModelConfidence,
  type PersonalProfileSession,
  type ResponseCategory,
  type ResponseCategoryDeriver,
  type ResponseCategoryStatus,
} from './personalDrinkingProfile';
export {
  PERSONAL_INSIGHT_IDS,
  insightsForEntitlement,
  personalInsights,
  responseCategoryLabel,
  type GatedPersonalInsight,
  type PersonalInsight,
  type PersonalInsightId,
  type PersonalInsightStatus,
} from './personalInsights';
export {
  ESTIMATE_SOURCES,
  PERSONALIZATION_LEVELS,
  estimateAttribution,
  type EstimateAttribution,
  type EstimateAttributionInput,
  type EstimateSource,
  type PersonalizationLevel,
} from './estimateSource';
export {
  DEFAULT_PRODUCT_PRICING,
  PRODUCT_PRICING_ENV_NAMES,
  PRODUCT_PRICING_VERSION,
  annualMonthlyEquivalent,
  annualSavingPercent,
  resolveProductPricing,
  type ProductPricing,
  type ResolvedProductPricing,
} from './pricing';
export {
  COST_ALLOWANCE_KEYS,
  COST_AUDIENCES,
  COST_AUDIENCE_ALLOWANCE_KEYS,
  costAllowanceKeyFor,
  costAudienceFor,
  isExpiredCostEntitlement,
  type CostAllowanceKey,
  type CostAudience,
  type CostAudienceInput,
} from './costAudience';
export {
  PERSONAL_MODEL_STATES,
  PERSONALITY_SOURCES,
  PREMIUM_ENTITLEMENT_STATES,
  TONIGHT_MODELS,
  catchUpPlan,
  freezeFirstRead,
  freezeOnExpiry,
  personalModelAllowed,
  productBoundary,
  visiblePersonality,
  type BoundaryInput,
  type CatchUpPlan,
  type FrozenPersonality,
  type PersonalModelState,
  type PersonalitySource,
  type PremiumEntitlementState,
  type ProductBoundary,
  type SnapshotVersions,
  type TonightModel,
  type VisiblePersonality,
} from './productBoundary';

