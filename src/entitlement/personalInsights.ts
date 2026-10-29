import { capabilityDefinition, type Capability } from './capabilities';
import { canAccessCapability } from './featureGate';
import type { Entitlement, UserPlan } from './plans';
import type { PersonalDrinkingProfile, ResponseCategory } from './personalDrinkingProfile';

/**
 * Insight identifiers. Deriving them is plan-free; only reading them is gated.
 */
export const PERSONAL_INSIGHT_IDS = [
  'RESPONSE_CATEGORY',
  'FAMILIARITY',
  'DRINKING_ARCHETYPE',
  'PERSONAL_BASELINE',
  'PACE_EFFECT',
  'FOOD_EFFECT',
  'CROSS_SESSION_PATTERN',
  'LONGITUDINAL_CHANGE',
  'HISTORICAL_CONTEXT',
  'PERSONAL_MODEL_CONFIDENCE',
] as const;
export type PersonalInsightId = (typeof PERSONAL_INSIGHT_IDS)[number];

export type PersonalInsightStatus = 'READY' | 'LEARNING' | 'NOT_IMPLEMENTED';

export type PersonalInsight = {
  id: PersonalInsightId;
  capability: Capability;
  /** Minimum plan that may read this insight. Derived from the capability table, never hard-coded. */
  minimumPlan: UserPlan;
  status: PersonalInsightStatus;
  /** Human-readable value when one exists honestly; null otherwise. */
  value: string | number | null;
  evidenceCount: number;
};

export type GatedPersonalInsight = PersonalInsight & { locked: boolean };

export function responseCategoryLabel(category: ResponseCategory): string {
  switch (category) {
    case 'LOWER_SENSITIVITY':
      return 'Lower sensitivity';
    case 'MODERATE_SENSITIVITY':
      return 'Moderate sensitivity';
    case 'HIGHER_SENSITIVITY':
      return 'Higher sensitivity';
    default:
      return 'Still learning';
  }
}

/**
 * One derivation for every plan. Free and Premium read the same array; only `locked` differs, so
 * there is never a second, thinner profile to keep in sync.
 */
export function personalInsights(profile: PersonalDrinkingProfile): PersonalInsight[] {
  const completed = profile.completedSessionCount;
  const category = profile.responseCategory;
  const item = (
    id: PersonalInsightId,
    capability: Capability,
    status: PersonalInsightStatus,
    value: string | number | null,
    evidenceCount = completed,
  ): PersonalInsight => ({
    id,
    capability,
    minimumPlan: capabilityDefinition(capability).minimumPlan,
    status,
    value,
    evidenceCount,
  });
  return [
    item(
      'RESPONSE_CATEGORY',
      'BASIC_RESPONSE_CATEGORY',
      category.status === 'AVAILABLE' ? 'READY' : category.status === 'INSUFFICIENT_DATA' ? 'LEARNING' : 'NOT_IMPLEMENTED',
      category.status === 'AVAILABLE' ? responseCategoryLabel(category.value) : null,
      category.evidenceCount,
    ),
    item(
      'FAMILIARITY',
      'MODEL_FAMILIARITY',
      profile.sessionCount > 0 ? 'READY' : 'LEARNING',
      Math.round(profile.familiarity * 100),
      profile.sessionCount,
    ),
    item('DRINKING_ARCHETYPE', 'DRINKING_ARCHETYPE', profile.archetype ? 'READY' : 'NOT_IMPLEMENTED', profile.archetype?.archetypeLabel ?? null),
    item('PERSONAL_BASELINE', 'PERSONAL_BASELINE', profile.baseline ? 'READY' : 'NOT_IMPLEMENTED', null),
    item('PACE_EFFECT', 'PACE_EFFECT_MODEL', profile.paceEffect ? 'READY' : 'NOT_IMPLEMENTED', null),
    item('FOOD_EFFECT', 'FOOD_EFFECT_MODEL', profile.foodEffect ? 'READY' : 'NOT_IMPLEMENTED', null),
    item('CROSS_SESSION_PATTERN', 'CROSS_SESSION_PATTERN_ANALYSIS', profile.contextEffect || profile.subjectiveResponsePattern ? 'READY' : 'NOT_IMPLEMENTED', null),
    item('LONGITUDINAL_CHANGE', 'LONGITUDINAL_INSIGHTS', completed > 0 ? 'LEARNING' : 'NOT_IMPLEMENTED', null),
    item('HISTORICAL_CONTEXT', 'HISTORICAL_CONTEXT_FOR_CAT', 'NOT_IMPLEMENTED', null),
    // Reserved Premium slot. It stays NOT_IMPLEMENTED with a null value until a validated
    // personal-model confidence algorithm exists; nothing here may invent a number.
    item(
      'PERSONAL_MODEL_CONFIDENCE',
      'PERSONAL_MODEL_CONFIDENCE',
      'NOT_IMPLEMENTED',
      profile.personalModelConfidence.value,
      profile.personalModelConfidence.evidenceCount,
    ),
  ];
}

/**
 * The only step that knows about a plan. Everything a Free user may not read is returned as
 * `locked: true` rather than removed, so the product can still show it as a teaser.
 */
export function insightsForEntitlement(
  profile: PersonalDrinkingProfile,
  entitlement: Entitlement,
): GatedPersonalInsight[] {
  return personalInsights(profile).map((insight) => ({
    ...insight,
    locked: !canAccessCapability(entitlement, insight.capability),
  }));
}
