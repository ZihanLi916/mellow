/**
 * The personal drinking model is *data*, not a plan artifact.
 *
 * A Free user keeps accumulating every input this structure is built from (sessions, drinks,
 * outcomes, context, food, pace, feedback). Only the depth of the insight that may be *read* is
 * gated. There is one profile for everyone: never a Free copy and a Premium copy.
 */
export const PERSONAL_PROFILE_VERSION = 'mellow-personal-drinking-profile-v1' as const;

export const RESPONSE_CATEGORIES = [
  'LOWER_SENSITIVITY',
  'MODERATE_SENSITIVITY',
  'HIGHER_SENSITIVITY',
] as const;
export type ResponseCategory = (typeof RESPONSE_CATEGORIES)[number] | 'UNKNOWN';

/**
 * `NOT_IMPLEMENTED` means the evidence gate was met but no mature category algorithm exists yet.
 * It is never rendered as a sensitivity claim.
 */
export type ResponseCategoryStatus = 'AVAILABLE' | 'INSUFFICIENT_DATA' | 'NOT_IMPLEMENTED';

export type ModelMaturity = 'NEW' | 'LEARNING' | 'FAMILIAR' | 'ESTABLISHED';
export type MaturitySource = 'PERSONAL_MODEL' | 'FAMILIARITY_PROXY';

/** Minimum independent completed nights before any response category may be claimed. */
export const MIN_RESPONSE_EVIDENCE_NIGHTS = 3;

export type DrinkingArchetype = {
  archetypeId: string;
  archetypeLabel: string;
  /** 0..1. Evidence support for the label, never statistical confidence. */
  evidenceSupport: number;
  evidenceCount: number;
  updatedAt: string;
};

export type PersonalBaseline = {
  typicalBuzzOnset: string | null;
  typicalIntakeAtBuzz: number | null;
  typicalPace: number | null;
  typicalSubjectiveResponse: number | null;
  /** 0..1. Evidence support, never statistical confidence. */
  evidenceSupport: number;
};

/** Reserved cross-session effect slots. Schema today, algorithm later. */
export type ContextEffect = {
  kind: 'PACE' | 'FOOD' | 'CONTEXT' | 'SUBJECTIVE';
  status: 'SCHEMA_ONLY';
  direction: number | null;
  /** 0..1. Evidence support, never statistical confidence. */
  evidenceSupport: number | null;
  evidenceCount: number;
  updatedAt: string | null;
};

/**
 * Reserved Premium slot. Confidence in one specific personal-model conclusion is a different
 * concept from familiarity/maturity, and no validated algorithm produces it yet, so `value` is
 * always null. Nothing may fabricate a number here.
 */
export type PersonalModelConfidence = {
  status: 'SCHEMA_ONLY';
  conclusionId: string | null;
  value: null;
  evidenceCount: number;
  updatedAt: string | null;
};

export type PersonalDrinkingProfile = {
  version: typeof PERSONAL_PROFILE_VERSION;
  userId: string | null;
  sessionCount: number;
  completedSessionCount: number;
  drinkCount: number;
  /** How much evidence Mellow has about this person. 0..1. Never a plan indicator. */
  familiarity: number;
  familiarityUpdatedAt: string | null;
  modelMaturity: ModelMaturity;
  modelMaturitySource: MaturitySource;
  responseCategory: {
    value: ResponseCategory;
    status: ResponseCategoryStatus;
    evidenceCount: number;
    updatedAt: string | null;
  };
  archetype: DrinkingArchetype | null;
  baseline: PersonalBaseline | null;
  paceEffect: ContextEffect | null;
  foodEffect: ContextEffect | null;
  contextEffect: ContextEffect | null;
  subjectiveResponsePattern: ContextEffect | null;
  /** Premium reserved, schema only. Never populated with an invented value. */
  personalModelConfidence: PersonalModelConfidence;
  /** Longest observed span between recorded nights, in days. Free users accumulate this too. */
  spanDays: number;
  sessionEvidenceIds: string[];
  lastUpdated: string | null;
};

export type PersonalProfileSession = {
  id: string;
  endedAt: string | null;
  drinkCount: number;
  /** Quarantined or otherwise excluded nights stay out of the evidence count. */
  evidenceEligible?: boolean;
};

export type ResponseCategoryInput = { completedSessions: number; familiarity: number };
export type ResponseCategoryDeriver = (input: ResponseCategoryInput) => {
  value: ResponseCategory;
  status: ResponseCategoryStatus;
  evidenceCount: number;
};

/**
 * Default deriver. No mature algorithm exists yet, so it is deliberately conservative: below the
 * evidence gate it reports INSUFFICIENT_DATA, above it NOT_IMPLEMENTED with no category claim.
 * Replace this single function once a validated category model exists.
 */
export const unevaluatedResponseCategory: ResponseCategoryDeriver = ({ completedSessions }) => ({
  value: 'UNKNOWN',
  status: completedSessions < MIN_RESPONSE_EVIDENCE_NIGHTS ? 'INSUFFICIENT_DATA' : 'NOT_IMPLEMENTED',
  evidenceCount: completedSessions,
});

/** Coarse evidence maturity when the integrated personal model does not report its own. */
export function familiarityMaturity(familiarity: number): ModelMaturity {
  const value = Number.isFinite(familiarity) ? Math.max(0, Math.min(1, familiarity)) : 0;
  if (value >= 0.75) return 'ESTABLISHED';
  if (value >= 0.5) return 'FAMILIAR';
  if (value > 0) return 'LEARNING';
  return 'NEW';
}

export type PersonalDrinkingProfileInput = {
  userId?: string | null;
  sessions: readonly PersonalProfileSession[];
  familiarity: number;
  asOf: string;
  /** Maturity reported by the integrated personal model, when it is available at all. */
  modelMaturity?: ModelMaturity | null;
  archetype?: DrinkingArchetype | null;
  baseline?: PersonalBaseline | null;
  paceEffect?: ContextEffect | null;
  foodEffect?: ContextEffect | null;
  contextEffect?: ContextEffect | null;
  subjectiveResponsePattern?: ContextEffect | null;
  deriveResponseCategory?: ResponseCategoryDeriver;
};

/** Builds the reserved confidence slot. It never invents a value; there is no algorithm yet. */
export function unevaluatedPersonalModelConfidence(
  evidenceCount: number,
  updatedAt: string | null,
): PersonalModelConfidence {
  return { status: 'SCHEMA_ONLY', conclusionId: null, value: null, evidenceCount, updatedAt };
}

/** Plan-free by construction: no argument and no field of this builder mentions an entitlement. */
export function buildPersonalDrinkingProfile(
  input: PersonalDrinkingProfileInput,
): PersonalDrinkingProfile {
  const sessions = [...input.sessions];
  const eligible = sessions.filter((session) => session.evidenceEligible !== false);
  const completed = eligible.filter((session) => session.endedAt !== null);
  const times = completed
    .map((session) => Date.parse(session.endedAt as string))
    .filter((value) => Number.isFinite(value));
  const spanDays = times.length > 1 ? (Math.max(...times) - Math.min(...times)) / 86400000 : 0;
  const familiarity = Number.isFinite(input.familiarity) ? Math.max(0, Math.min(1, input.familiarity)) : 0;
  const category = (input.deriveResponseCategory ?? unevaluatedResponseCategory)({
    completedSessions: completed.length,
    familiarity,
  });
  return {
    version: PERSONAL_PROFILE_VERSION,
    userId: input.userId ?? null,
    sessionCount: sessions.length,
    completedSessionCount: completed.length,
    drinkCount: sessions.reduce((total, session) => total + Math.max(0, session.drinkCount), 0),
    familiarity,
    familiarityUpdatedAt: input.asOf,
    modelMaturity: input.modelMaturity ?? familiarityMaturity(familiarity),
    modelMaturitySource: input.modelMaturity ? 'PERSONAL_MODEL' : 'FAMILIARITY_PROXY',
    responseCategory: { ...category, updatedAt: input.asOf },
    archetype: input.archetype ?? null,
    baseline: input.baseline ?? null,
    paceEffect: input.paceEffect ?? null,
    foodEffect: input.foodEffect ?? null,
    contextEffect: input.contextEffect ?? null,
    subjectiveResponsePattern: input.subjectiveResponsePattern ?? null,
    personalModelConfidence: unevaluatedPersonalModelConfidence(completed.length, input.asOf),
    spanDays,
    sessionEvidenceIds: completed.map((session) => session.id),
    lastUpdated: input.asOf,
  };
}

