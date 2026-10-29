import type { UserPlan } from './plans';

/**
 * Business capabilities, not pages.
 *
 * The product asks "can this user do/say this?" and never "is this user premium?". Safety
 * capabilities are deliberately part of the same vocabulary so a test can prove that no plan ever
 * removes them.
 */
export const CAPABILITIES = [
  // Free · population-level understanding.
  'DRINK_RECOGNITION',
  'DRINK_INTAKE_LOGGING',
  'CURRENT_SESSION',
  'BASIC_SESSION_ESTIMATE',
  'POPULATION_RESPONSE_ESTIMATE',
  'BASIC_RESPONSE_CATEGORY',
  'BASIC_SESSION_RECAP',
  'RAW_SESSION_HISTORY',
  // Maturity, not confidence: how much usable evidence Mellow has accumulated about this person.
  // It is not a statistical statement about any personal-model conclusion.
  'MODEL_FAMILIARITY',
  // Data collection is not an entitlement. A Free user keeps building the evidence that a future
  // personal model will read, so an upgrade never starts from zero.
  'PERSONAL_MODEL_DATA_COLLECTION',
  // Safety · never gated, never reduced, identical on every plan.
  'SAFETY_INTOXICATION_RISK_WARNING',
  'SAFETY_STOP_SLOW_SIGNAL',
  'SAFETY_DRIVING_WARNING',
  'SAFETY_HYDRATION_REMINDER',
  'SAFETY_EMERGENCY_GUIDANCE',
  // Premium · personal-level understanding.
  'PERSONAL_DRINKING_MODEL',
  'DRINKING_ARCHETYPE',
  'PERSONAL_BASELINE',
  'CROSS_SESSION_PATTERN_ANALYSIS',
  'PERSONALIZED_INTOXICATION_ESTIMATE',
  'FOOD_EFFECT_MODEL',
  'PACE_EFFECT_MODEL',
  'LONGITUDINAL_INSIGHTS',
  'HISTORICAL_CONTEXT_FOR_CAT',
  // Confidence in a specific personal-model conclusion. Reserved: no validated algorithm exists,
  // so nothing may report a number for it yet. Kept separate from MODEL_FAMILIARITY (maturity).
  'PERSONAL_MODEL_CONFIDENCE',
  // v0.3 product boundary. Free owns a complete product plus one published personality reading; Premium
  // owns the personal model that keeps learning. The reveal is deliberately not the personal model.
  'BASIC_PERSONALITY_REVEAL',
  'PERSONALITY_DIMENSIONS',
  'PERSONALITY_EVIDENCE',
  'PERSONALITY_EVOLUTION',
  'PREMIUM_CARD_CUSTOMIZATION',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export type CapabilityKind = 'CORE' | 'SAFETY' | 'PERSONAL';

/** `SCHEMA_ONLY` marks a reserved capability whose algorithm does not exist yet. */
export type CapabilityPhase = 'AVAILABLE' | 'SCHEMA_ONLY';

export type CapabilityDefinition = {
  capability: Capability;
  kind: CapabilityKind;
  minimumPlan: UserPlan;
  phase: CapabilityPhase;
  summary: string;
};

export const CAPABILITY_DEFINITIONS: Record<Capability, CapabilityDefinition> = {
  DRINK_RECOGNITION: { capability: 'DRINK_RECOGNITION', kind: 'CORE', minimumPlan: 'FREE', phase: 'AVAILABLE', summary: 'Identify a drink from a photo the user chose to send.' },
  DRINK_INTAKE_LOGGING: { capability: 'DRINK_INTAKE_LOGGING', kind: 'CORE', minimumPlan: 'FREE', phase: 'AVAILABLE', summary: 'Record a confirmed drink into the current session.' },
  CURRENT_SESSION: { capability: 'CURRENT_SESSION', kind: 'CORE', minimumPlan: 'FREE', phase: 'AVAILABLE', summary: 'Use the drinks logged tonight.' },
  BASIC_SESSION_ESTIMATE: { capability: 'BASIC_SESSION_ESTIMATE', kind: 'CORE', minimumPlan: 'FREE', phase: 'AVAILABLE', summary: 'Tonight-level estimate built from this session.' },
  POPULATION_RESPONSE_ESTIMATE: { capability: 'POPULATION_RESPONSE_ESTIMATE', kind: 'CORE', minimumPlan: 'FREE', phase: 'AVAILABLE', summary: 'Population-informed BAC / response estimation.' },
  BASIC_RESPONSE_CATEGORY: { capability: 'BASIC_RESPONSE_CATEGORY', kind: 'CORE', minimumPlan: 'FREE', phase: 'AVAILABLE', summary: 'Coarse alcohol response category; may stay UNKNOWN while evidence is thin.' },
  BASIC_SESSION_RECAP: { capability: 'BASIC_SESSION_RECAP', kind: 'CORE', minimumPlan: 'FREE', phase: 'AVAILABLE', summary: 'Plain recap of a finished night.' },
  RAW_SESSION_HISTORY: { capability: 'RAW_SESSION_HISTORY', kind: 'CORE', minimumPlan: 'FREE', phase: 'AVAILABLE', summary: 'The recorded history that belongs to the user, always readable and exportable.' },
  MODEL_FAMILIARITY: { capability: 'MODEL_FAMILIARITY', kind: 'CORE', minimumPlan: 'FREE', phase: 'AVAILABLE', summary: 'Coarse "how much evidence Mellow has about you" scalar. Maturity, never confidence.' },
  PERSONAL_MODEL_DATA_COLLECTION: { capability: 'PERSONAL_MODEL_DATA_COLLECTION', kind: 'CORE', minimumPlan: 'FREE', phase: 'AVAILABLE', summary: 'Keep collecting sessions, outcomes, context, food, pace and feedback for future personalization.' },
  SAFETY_INTOXICATION_RISK_WARNING: { capability: 'SAFETY_INTOXICATION_RISK_WARNING', kind: 'SAFETY', minimumPlan: 'FREE', phase: 'AVAILABLE', summary: 'Current intoxication risk information the system can honestly provide.' },
  SAFETY_STOP_SLOW_SIGNAL: { capability: 'SAFETY_STOP_SLOW_SIGNAL', kind: 'SAFETY', minimumPlan: 'FREE', phase: 'AVAILABLE', summary: 'Stop / slow down signals.' },
  SAFETY_DRIVING_WARNING: { capability: 'SAFETY_DRIVING_WARNING', kind: 'SAFETY', minimumPlan: 'FREE', phase: 'AVAILABLE', summary: 'Driving and emergency safety guidance.' },
  SAFETY_HYDRATION_REMINDER: { capability: 'SAFETY_HYDRATION_REMINDER', kind: 'SAFETY', minimumPlan: 'FREE', phase: 'AVAILABLE', summary: 'Hydration and contextual care reminders.' },
  SAFETY_EMERGENCY_GUIDANCE: { capability: 'SAFETY_EMERGENCY_GUIDANCE', kind: 'SAFETY', minimumPlan: 'FREE', phase: 'AVAILABLE', summary: 'Emergency guidance.' },
  PERSONAL_DRINKING_MODEL: { capability: 'PERSONAL_DRINKING_MODEL', kind: 'PERSONAL', minimumPlan: 'PREMIUM', phase: 'SCHEMA_ONLY', summary: 'Umbrella capability for reading the full personal drinking model.' },
  DRINKING_ARCHETYPE: { capability: 'DRINKING_ARCHETYPE', kind: 'PERSONAL', minimumPlan: 'PREMIUM', phase: 'SCHEMA_ONLY', summary: 'Drinking personality / response archetype formed from repeated nights.' },
  PERSONAL_BASELINE: { capability: 'PERSONAL_BASELINE', kind: 'PERSONAL', minimumPlan: 'PREMIUM', phase: 'SCHEMA_ONLY', summary: 'The typical response of this person instead of the population average.' },
  CROSS_SESSION_PATTERN_ANALYSIS: { capability: 'CROSS_SESSION_PATTERN_ANALYSIS', kind: 'PERSONAL', minimumPlan: 'PREMIUM', phase: 'SCHEMA_ONLY', summary: 'Learning from several historical sessions at once.' },
  PERSONALIZED_INTOXICATION_ESTIMATE: { capability: 'PERSONALIZED_INTOXICATION_ESTIMATE', kind: 'PERSONAL', minimumPlan: 'PREMIUM', phase: 'SCHEMA_ONLY', summary: 'The estimate for tonight informed by the personal model.' },
  FOOD_EFFECT_MODEL: { capability: 'FOOD_EFFECT_MODEL', kind: 'PERSONAL', minimumPlan: 'PREMIUM', phase: 'SCHEMA_ONLY', summary: 'How food tends to change the night for this person.' },
  PACE_EFFECT_MODEL: { capability: 'PACE_EFFECT_MODEL', kind: 'PERSONAL', minimumPlan: 'PREMIUM', phase: 'SCHEMA_ONLY', summary: 'How pace tends to change the night for this person.' },
  LONGITUDINAL_INSIGHTS: { capability: 'LONGITUDINAL_INSIGHTS', kind: 'PERSONAL', minimumPlan: 'PREMIUM', phase: 'SCHEMA_ONLY', summary: 'Change over months rather than a single night.' },
  HISTORICAL_CONTEXT_FOR_CAT: { capability: 'HISTORICAL_CONTEXT_FOR_CAT', kind: 'PERSONAL', minimumPlan: 'PREMIUM', phase: 'SCHEMA_ONLY', summary: 'Let the cat speak from the recorded history of this person.' },
  PERSONAL_MODEL_CONFIDENCE: { capability: 'PERSONAL_MODEL_CONFIDENCE', kind: 'PERSONAL', minimumPlan: 'PREMIUM', phase: 'SCHEMA_ONLY', summary: 'Confidence in one specific personal-model conclusion. Reserved schema; no algorithm and no value exist yet.' },
  BASIC_PERSONALITY_REVEAL: { capability: 'BASIC_PERSONALITY_REVEAL', kind: 'CORE', minimumPlan: 'FREE', phase: 'AVAILABLE', summary: 'One published personality label with one short description and a basic share card, after five valid independent nights. A first-read snapshot, not a personal model.' },
  PERSONALITY_DIMENSIONS: { capability: 'PERSONALITY_DIMENSIONS', kind: 'PERSONAL', minimumPlan: 'PREMIUM', phase: 'AVAILABLE', summary: 'The longitudinal seven-dimension behaviour profile, its values and its interpretation.' },
  PERSONALITY_EVIDENCE: { capability: 'PERSONALITY_EVIDENCE', kind: 'PERSONAL', minimumPlan: 'PREMIUM', phase: 'AVAILABLE', summary: 'Why a reading exists: supporting metrics, traits, coverage, missing reasons and prototype detail.' },
  PERSONALITY_EVOLUTION: { capability: 'PERSONALITY_EVOLUTION', kind: 'PERSONAL', minimumPlan: 'PREMIUM', phase: 'AVAILABLE', summary: 'A personality that keeps learning: challenger state, switching and personality history.' },
  PREMIUM_CARD_CUSTOMIZATION: { capability: 'PREMIUM_CARD_CUSTOMIZATION', kind: 'PERSONAL', minimumPlan: 'PREMIUM', phase: 'SCHEMA_ONLY', summary: 'Premium card skins and customization. Deferred: nothing is implemented or sold in this beta.' },
};

/** Capabilities whose algorithm is reserved and has no value yet. */
export const RESERVED_CAPABILITIES: readonly Capability[] = CAPABILITIES.filter(
  (capability) => CAPABILITY_DEFINITIONS[capability].phase === 'SCHEMA_ONLY',
);

export const SAFETY_CAPABILITIES: readonly Capability[] = CAPABILITIES.filter(
  (capability) => CAPABILITY_DEFINITIONS[capability].kind === 'SAFETY',
);

export const CORE_CAPABILITIES: readonly Capability[] = CAPABILITIES.filter(
  (capability) => CAPABILITY_DEFINITIONS[capability].kind === 'CORE',
);

export const PERSONAL_CAPABILITIES: readonly Capability[] = CAPABILITIES.filter(
  (capability) => CAPABILITY_DEFINITIONS[capability].kind === 'PERSONAL',
);




export function capabilityDefinition(capability: Capability): CapabilityDefinition {
  return CAPABILITY_DEFINITIONS[capability];
}

export function isSafetyCapability(capability: Capability): boolean {
  return CAPABILITY_DEFINITIONS[capability].kind === 'SAFETY';
}

export function minimumPlanFor(capability: Capability): UserPlan {
  return CAPABILITY_DEFINITIONS[capability].minimumPlan;
}

export function capabilitiesForMinimumPlan(minimumPlan: UserPlan): Capability[] {
  return CAPABILITIES.filter((capability) => CAPABILITY_DEFINITIONS[capability].minimumPlan === minimumPlan);
}

/**
 * Whether a capability has a real implementation behind it yet.
 *
 * Access is not the same as existence: a reserved capability may be reachable for a plan while no value can
 * be produced for it, so a presentation layer must ask both questions before it shows anything.
 */
export function isCapabilityShipped(capability: Capability): boolean {
  return CAPABILITY_DEFINITIONS[capability].phase === 'AVAILABLE';
}
