import type { SessionEndReason } from '../consumer/sessionLifecycle';
import type { Capability, ModelMaturity, PersonalModelConfidence } from '../entitlement';
import type { SubjectiveState } from '../lib/schemas';

/**
 * Mellow Content Engine v0.1 — the frozen contract surface.
 *
 * The engine turns a user event into at most one short reaction. It is deliberately split from the
 * surfaces that produce facts: business layers emit facts and insights, the voice layer owns
 * language, and this file owns the vocabulary both sides agree on.
 *
 * Nothing here knows what a user paid for. Access questions go to `ContentCapabilityPort`, which is
 * built by `./capability` on top of the canonical entitlement layer.
 */

export const CONTENT_ENGINE_VERSION = 'mellow-content-engine-0.1.0' as const;
export const CONTENT_SCHEMA_VERSION = 'mellow-content-schema-v0.1' as const;
export const CONTENT_OUTPUT_CONTRACT_VERSION = 'mellow-content-output-v0.1' as const;
export const SPEECH_PRIORITY_VERSION = 'mellow-speech-priority-v0.1' as const;
export const VOICE_RULES_VERSION = 'mellow-voice-rules-v0.1' as const;
export const FAMILIARITY_GRAMMAR_VERSION = 'mellow-familiarity-grammar-v0.1' as const;
export const EVIDENCE_LANGUAGE_VERSION = 'mellow-evidence-language-v0.1' as const;
export const FOLLOWUP_SIGNAL_CONTRACT_VERSION = 'mellow-followup-signal-v0.1' as const;
export const END_NIGHT_INTEGRATION_VERSION = 'mellow-end-night-integration-v0.1' as const;
export const CONTENT_DATASET_VERSION = 'mellow-content-dataset-v0.1' as const;

/* ------------------------------------------------------------------------------------------------
 * Speech priority (spec §7). Lower rank number wins. A lower priority can never displace a higher
 * one: arbitration sorts by rank first and only then by everything else.
 * ---------------------------------------------------------------------------------------------- */

export const PRIORITIES = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_DEFINITIONS: Record<Priority, string> = {
  P0: 'Safety. Clear risk, rapid high intake, driving risk.',
  P1: 'Personal anomaly. Tonight clearly differs from this person.',
  P2: 'Intention mismatch. Behaviour drifted from the night the user planned.',
  P3: 'Emerging personal pattern. The same shape repeating across sessions.',
  P4: 'Meaningful state transition.',
  P5: 'Care. Water, food, slowing down.',
  P6: 'Personality and delight.',
};

/** 0 for `P0`. Smaller is stronger. */
export function priorityRank(priority: Priority): number {
  return PRIORITIES.indexOf(priority);
}

/** True when `a` outranks `b`. `P0` has no superior. */
export function outranks(a: Priority, b: Priority): boolean {
  return priorityRank(a) < priorityRank(b);
}

/* ------------------------------------------------------------------------------------------------
 * Speech acts (spec §8). `ASK` deliberately does not exist: the cat reacts, it never opens a
 * conversation and never asks the user a question.
 * ---------------------------------------------------------------------------------------------- */

export const SPEECH_ACTS = ['NOTICE', 'COMPARE', 'REMEMBER', 'NUDGE', 'REFLECT', 'REVEAL', 'CARE'] as const;
export type SpeechAct = (typeof SPEECH_ACTS)[number];

/* ------------------------------------------------------------------------------------------------
 * Evidence strength (spec §11). Language strength may never exceed this.
 * ---------------------------------------------------------------------------------------------- */

export const EVIDENCE_LEVELS = ['NONE', 'WEAK', 'REPEATED', 'STABLE'] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

/** A generalization needs two independent nights before it may be stated as repeated. */
export const MIN_REPEATED_NIGHTS = 2;
/** A stable baseline claim needs five independent nights. Two nights are never a personality. */
export const MIN_STABLE_NIGHTS = 5;
/** The shortest history that may describe itself with the shortest, most familiar language. */
export const MIN_WELL_KNOWN_NIGHTS = 8;

export function evidenceRank(level: EvidenceLevel): number {
  return EVIDENCE_LEVELS.indexOf(level);
}

export function strongerEvidence(a: EvidenceLevel, b: EvidenceLevel): EvidenceLevel {
  return evidenceRank(a) >= evidenceRank(b) ? a : b;
}

/* ------------------------------------------------------------------------------------------------
 * Safety (spec §19). Safety is a floor: identical on every plan, and it always outranks voice.
 * ---------------------------------------------------------------------------------------------- */

export const SAFETY_LEVELS = ['NORMAL', 'ELEVATED', 'HIGH', 'CRITICAL'] as const;
export type SafetyLevel = (typeof SAFETY_LEVELS)[number];

export function safetyRank(level: SafetyLevel): number {
  return SAFETY_LEVELS.indexOf(level);
}

export function strongerSafety(a: SafetyLevel, b: SafetyLevel): SafetyLevel {
  return safetyRank(a) >= safetyRank(b) ? a : b;
}

/* ------------------------------------------------------------------------------------------------
 * Familiarity grammar (spec §25). Familiarity is maturity — how much evidence exists. It is never a
 * statistical confidence and never a plan indicator.
 * ---------------------------------------------------------------------------------------------- */

export const FAMILIARITY_BANDS = ['STRANGER', 'LEARNING', 'FAMILIAR', 'WELL_KNOWN'] as const;
export type FamiliarityBand = (typeof FAMILIARITY_BANDS)[number];

export function familiarityRank(band: FamiliarityBand): number {
  return FAMILIARITY_BANDS.indexOf(band);
}

/* ------------------------------------------------------------------------------------------------
 * Domain events.
 * ---------------------------------------------------------------------------------------------- */

export const CONTENT_EVENTS = [
  'SESSION_STARTED',
  'DRINK_LOGGED',
  'WATER_LOGGED',
  'FOOD_LOGGED',
  'STATE_REPORTED',
  'DRINK_CORRECTED',
  'SESSION_ENDED_MANUAL',
  'SESSION_ENDED_AUTO_INACTIVITY',
  'NEXT_DAY_FOLLOWUP',
] as const;
export type ContentEvent = (typeof CONTENT_EVENTS)[number];

/** Manual and automatic endings are two events with one pipeline. */
export function sessionEndEvent(reason: SessionEndReason): ContentEvent {
  return reason === 'MANUAL' ? 'SESSION_ENDED_MANUAL' : 'SESSION_ENDED_AUTO_INACTIVITY';
}

export const SESSION_END_EVENTS: readonly ContentEvent[] = ['SESSION_ENDED_MANUAL', 'SESSION_ENDED_AUTO_INACTIVITY'];

export function isSessionEndEvent(event: ContentEvent): boolean {
  return SESSION_END_EVENTS.includes(event);
}

/* ------------------------------------------------------------------------------------------------
 * Silence. `NO_COMMENT` is a normal, frequent and correct outcome.
 * ---------------------------------------------------------------------------------------------- */

export const SILENCE_REASONS = [
  'NO_MEANINGFUL_NEW_INFORMATION',
  'EVIDENCE_INSUFFICIENT',
  'CAPABILITY_NOT_READABLE',
  'VOICE_POLICY_BLOCKED',
] as const;
export type SilenceReason = (typeof SILENCE_REASONS)[number];

/* ------------------------------------------------------------------------------------------------
 * Session context (spec §5 `current_session_context`).
 * ---------------------------------------------------------------------------------------------- */

export const FOOD_CONTEXTS = ['ATE', 'LITTLE', 'NOT_YET', 'UNKNOWN'] as const;
export type FoodContext = (typeof FOOD_CONTEXTS)[number];

/** A drink logged twice inside this window is a fast drink. */
export const FAST_GAP_MINUTES = 20;
/** A gap at least this long is a deliberate deceleration. */
export const SLOW_GAP_MINUTES = 45;
/** At or above this ABV a drink is clearly a strong one. */
export const STRONG_ABV_PERCENT = 20;

/** Rapid-intake safety windows, expressed in actual confirmed drinks inside a real time window. */
export const RAPID_WINDOW = {
  /** Four drinks inside two hours stops being playful. */
  ELEVATED_DRINKS: 4,
  ELEVATED_MINUTES: 120,
  /** Five drinks inside two hours, or four inside one hour, is the direct line. */
  HIGH_DRINKS: 5,
  HIGH_MINUTES: 120,
  HIGH_DRINKS_FAST: 4,
  HIGH_MINUTES_FAST: 60,
} as const;

export type StateReport = {
  level: number;
  state: SubjectiveState;
  at: string;
  minutes_from_start: number;
};

export type DrinkFact = {
  id: string;
  label: string;
  category: string;
  abv_percent: number | null;
  confirmed_at: string;
  minutes_from_start: number;
  corrected: boolean;
  recognition_confidence: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  /** Logged within `FAST_GAP_MINUTES` of the previous drink. */
  fast: boolean;
};

/**
 * A night the user planned. Mellow does not collect an intention today, so this stays `null` on
 * production data and is only populated from a real user-provided plan.
 */
export type Intention = {
  planned_drinks: number | null;
  planned_pace_per_hour: number | null;
  source: 'USER_SET';
};

export type SessionContext = {
  session_id: string;
  started_at: string;
  ended_at: string | null;
  end_reason: SessionEndReason | null;
  /** Occasion label the user chose, when there is one. */
  context: string | null;
  intention: Intention | null;
  drink_count: number;
  drink_times: string[];
  last_gap_minutes: number | null;
  previous_gap_minutes: number | null;
  median_gap_minutes: number | null;
  session_minutes: number;
  minutes_to_reported_state: number | null;
  /** Fast drinks logged before the first water entry of the night. */
  fast_drinks_before_water: number;
  fast_drink_count: number;
  water_count: number;
  food: FoodContext;
  reported_state: StateReport | null;
  previous_state: StateReport | null;
  first_drink: DrinkFact | null;
  last_drink: DrinkFact | null;
  strongest_abv_percent: number | null;
  all_strengths_known: boolean;
  first_half_drinks: number;
  second_half_drinks: number;
  /** Only ever true from an explicit user declaration; never inferred. */
  driving_declared: boolean;
};

/* ------------------------------------------------------------------------------------------------
 * Personal model context (spec §5 `personal_baseline`, `historical_patterns`, `familiarity`,
 * `model_confidence`). This is evidence, not entitlement: producing it is always allowed, speaking
 * from it is gated by the capability carried on the insight.
 * ---------------------------------------------------------------------------------------------- */

export const PATTERN_KEYS = [
  'FAST_NIGHT',
  'EMPTY_STOMACH_FAST_PACE',
  'FOOD_BEFORE_DRINKS',
  'LATE_COCKTAILS',
  'SLOW_START_SHARP_LATER',
] as const;
export type PatternKey = (typeof PATTERN_KEYS)[number];

export type PatternOutcome = {
  nights_with_outcome: number;
  heavier_mornings: number;
  milder_mornings: number;
};

export type HistoricalPattern = {
  key: PatternKey;
  /** Independent nights in which the shape appeared. */
  nights: number;
  /** Nights considered while counting. */
  total_nights: number;
  evidence_ids: string[];
  last_at: string | null;
  outcome: PatternOutcome | null;
};

export type PersonalBaselineFacts = {
  typical_buzz_onset_minutes: number | null;
  typical_drink_count_at_buzz: number | null;
  typical_pace_per_hour: number | null;
  typical_night_drinks: number | null;
  evidence_nights: number;
  evidence_ids: string[];
};

export type HistoricalSessionSummary = {
  session_id: string;
  started_at: string;
  ended_at: string;
  end_reason: SessionEndReason | null;
  drink_count: number;
  pace_per_hour: number | null;
  median_gap_minutes: number | null;
  food: FoodContext;
  water_count: number;
  /** A cocktail was logged at a late local hour (22:00 or later, or before 05:00). */
  late: boolean;
  fast: boolean;
  /** The second half of the night carried at least two more drinks than the first. */
  second_half_heavier: boolean;
  /** Minutes from the night's start to the first report at level 2 or above, when one exists. */
  minutes_to_buzz: number | null;
  felt_level: number | null;
  morning: number | null;
  hangover: number | null;
  sleep_quality: number | null;
};

export type PersonalContext = {
  /** 0..1 maturity scalar. Readable on every plan; never a confidence statement. */
  familiarity: number;
  model_maturity: ModelMaturity | null;
  /** Reserved slot. The value is always `null`; no algorithm exists and none may be invented. */
  model_confidence: PersonalModelConfidence;
  /** Independent prior nights with usable evidence. */
  historical_nights: number;
  baseline: PersonalBaselineFacts | null;
  patterns: HistoricalPattern[];
  sessions: HistoricalSessionSummary[];
};

export function emptyPersonalContext(): PersonalContext {
  return {
    familiarity: 0,
    model_maturity: null,
    model_confidence: { status: 'SCHEMA_ONLY', conclusionId: null, value: null, evidenceCount: 0, updatedAt: null },
    historical_nights: 0,
    baseline: null,
    patterns: [],
    sessions: [],
  };
}

export function historicalPattern(context: PersonalContext, key: PatternKey): HistoricalPattern | null {
  return context.patterns.find((pattern) => pattern.key === key) ?? null;
}

/* ------------------------------------------------------------------------------------------------
 * Next-day outcome (spec §22). Every field is optional: the user never has to answer everything.
 * All six scales run the same way — higher means a stronger effect, never "better".
 * ---------------------------------------------------------------------------------------------- */

export type NextDayOutcome = {
  session_id: string;
  /** Felt intoxication at the end of the night, 0..4. The one field the product already records. */
  felt_intoxication: number | null;
  /** 0 none .. 4 severe. */
  hangover: number | null;
  /** 0 slept well .. 4 slept badly. */
  sleep_quality: number | null;
  /** 0 clear recall .. 4 large gaps. */
  memory_quality: number | null;
  /** 0 good .. 4 low. */
  mood: number | null;
  /** 0 great morning .. 4 rough morning. */
  overall_morning: number | null;
  source: 'USER_SELF_REPORT';
  recorded_at: string;
};

export type OutcomePrediction = {
  session_id: string;
  /** What the model expected the night to feel like, 0..4, when a prediction genuinely existed. */
  expected_level: number | null;
  expected_morning: number | null;
  basis: 'PERSONAL_MODEL' | 'POPULATION';
  support: { nights: number; evidence_ids: string[] };
  capability: Capability;
};

export type FollowUpContext = {
  outcome: NextDayOutcome | null;
  prediction: OutcomePrediction | null;
};

/* ------------------------------------------------------------------------------------------------
 * Model signals (spec §24). Structured evidence for the Personal Drinking Model. The content engine
 * never trains anything; it hands over clean signals.
 * ---------------------------------------------------------------------------------------------- */

export const MODEL_SIGNAL_CODES = [
  'prediction_underestimated',
  'prediction_overestimated',
  'pace_outcome_signal',
  'food_outcome_signal',
  'sleep_outcome_signal',
  'hangover_signal',
  'subjective_intoxication_signal',
  'pattern_support',
  'pattern_contradiction',
] as const;
export type ModelSignalCode = (typeof MODEL_SIGNAL_CODES)[number];

export type ModelSignal = {
  code: ModelSignalCode;
  session_id: string;
  /** Which way the evidence points. `SAME` means "recorded, no direction claimed". */
  direction: 'HIGHER' | 'LOWER' | 'SAME' | 'SUPPORTS' | 'CONTRADICTS';
  /** Ordinal delta or a support share. `null` when a number would overstate the evidence. */
  magnitude: number | null;
  evidence: { level: EvidenceLevel; nights: number; evidence_ids: string[] };
  at: string;
  contract: typeof FOLLOWUP_SIGNAL_CONTRACT_VERSION;
};

/* ------------------------------------------------------------------------------------------------
 * Insights. Facts plus the reason to speak. No language here: the voice layer renders.
 * ---------------------------------------------------------------------------------------------- */

export const FACT_KINDS = [
  'FIRST_DRINK_STRONG',
  'PACE_SECOND_FAST',
  'PACE_BURST_THIRD',
  'WATER_AFTER_FAST',
  'FOOD_TIMING',
  'PACE_DECELERATION',
  'STATE_TRANSITION',
  'STATE_EARLIER_THAN_USUAL',
  'HOLDING_STEADIER_THAN_USUAL',
  'PATTERN_SECOND_OCCURRENCE',
  'PATTERN_EMERGING',
  'PATTERN_ESTABLISHED',
  'CORRECTION_IDENTIFIED',
  'INTENTION_EXCEEDED_TONIGHT',
  'SAFETY_RAPID_WINDOW_ELEVATED',
  'SAFETY_RAPID_WINDOW_HIGH',
  'SAFETY_DRIVING',
  'SAFETY_SEVERE_STATE',
  'RECAP_STEADY',
  'RECAP_SLOWER_THAN_USUAL',
  'RECAP_OVER_PLAN',
  'RECAP_PERSONAL_PATTERN',
  'RECAP_NOTHING_NOTABLE',
  'RECAP_LOOKED_LIKE_LAST_FAST_NIGHT',
  'MORNING_COMFORTABLE_ZONE',
  'MORNING_ROUGHER_SAME_INTAKE',
  'MORNING_UNDERESTIMATED',
  'MORNING_OVERESTIMATED',
  'MORNING_SLEEP_DISAGREES',
  'MORNING_FAST_NIGHTS_UNKIND',
  'MORNING_FOOD_CASE',
  'MORNING_LATE_COCKTAILS',
  'MORNING_NO_EVIDENCE',
  'MORNING_HEAVY_FELT',
] as const;
export type FactKind = (typeof FACT_KINDS)[number];

export const VOICE_TONES = ['PLAIN', 'DRY', 'PLAYFUL', 'CARE', 'SAFETY'] as const;
export type VoiceTone = (typeof VOICE_TONES)[number];

export type FactValue = string | number | boolean | null;

export type PersonalComparison = {
  metric: 'BUZZ_ONSET' | 'PACE' | 'DRINK_COUNT' | 'MORNING' | 'SLEEP';
  tonight: number | null;
  baseline: number | null;
  direction: 'EARLIER' | 'LATER' | 'STEADIER' | 'HEAVIER' | 'MILDER' | 'SAME';
  evidence_nights: number;
};

export type HistoricalEvidence = { level: EvidenceLevel; nights: number; evidence_ids: string[] };

export type ContentInsight = {
  /** Stable identity for this candidate inside one evaluation. */
  key: string;
  speech_reason: FactKind;
  fact_kind: FactKind;
  priority: Priority;
  speech_act: SpeechAct;
  safety_level: SafetyLevel;
  /** True only when the reaction leans on this person's own history or baseline. */
  personalized: boolean;
  /** True when the wording makes a claim beyond tonight: a pattern, a habit, a baseline. */
  generalization: boolean;
  /** The capability a reader must hold for this reaction to be allowed at all. */
  capability: Capability | null;
  current_fact: Record<string, FactValue>;
  personal_comparison: PersonalComparison | null;
  historical_evidence: HistoricalEvidence;
};

/**
 * The output contract (spec §28). Silence carries `should_speak: false` and a reason; a reaction
 * carries everything. `message` is the cat reaction, rendered only by the voice layer.
 */
export type ContentDecision = {
  version: typeof CONTENT_OUTPUT_CONTRACT_VERSION;
  should_speak: boolean;
  reason: SilenceReason | null;
  priority: Priority | null;
  speech_act: SpeechAct | null;
  speech_reason: FactKind | null;
  message: string | null;
  tone: VoiceTone | null;
  /** The frozen line that produced `message`. Scoring and freeze tests read it back. */
  template_id: string | null;
  evidence_level: EvidenceLevel;
  personalized: boolean;
  safety_level: SafetyLevel;
  model_signals: ModelSignal[];
  current_fact: Record<string, FactValue>;
  personal_comparison: PersonalComparison | null;
  historical_evidence: HistoricalEvidence | null;
  followup_context: FollowUpContext | null;
  followup_reaction: string | null;
  insight_key: string | null;
  capability: Capability | null;
};

/** What an evaluation produces: candidates, plus any evidence worth handing to the model. */
export type ContentEvaluation = {
  insights: ContentInsight[];
  model_signals: ModelSignal[];
  safety_level: SafetyLevel;
};

/**
 * The only access question the engine is allowed to ask. Implemented by `./capability` on top of
 * the canonical entitlement layer; the engine never inspects a plan.
 */
export type ContentCapabilityPort = {
  canRead(capability: Capability): boolean;
};

export type ContentContext = {
  event: ContentEvent;
  now: string;
  session: SessionContext | null;
  personal: PersonalContext;
  capability: ContentCapabilityPort;
  followup: FollowUpContext | null;
  /**
   * Deterministic variant selector. `0` always yields the frozen primary wording, so the v0.1
   * baseline stays exactly reproducible while future versions add variants.
   */
  variant_seed?: number;
};
