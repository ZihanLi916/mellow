/**
 * Mellow Composite Drinking Style v0.2 — contracts.
 *
 * The Drinking Style describes *how this person tends to drink, based on what they logged*. It is not a
 * diagnosis, a tolerance measure, a BAC safety grade, a psychological profile, a motivation or addiction
 * judgement, a social-skill judgement or a health-risk score.
 */
export const DRINKING_STYLE_ALGORITHM_VERSION = 'mellow-drinking-style-2.4.0' as const;
export const BEHAVIOR_PROFILE_VERSION = 'mellow-behavior-profile-v0.4' as const;
export const PROTOTYPE_VERSION = 'mellow-composite-prototypes-v0.5' as const;
export const DRINKING_STYLE_THRESHOLD_VERSION = 'mellow-drinking-style-thresholds-v0.6' as const;
export const SWITCHING_VERSION = 'mellow-archetype-switching-v0.3' as const;
export const DRINKING_STYLE_CARD_VERSION = 'mellow-drinking-style-card-v2' as const;

/* -------------------------------------------------------------------------------------------------
 * Dimensions: seven continuous behavioural axes. A dimension is not a personality and never decides an
 * archetype on its own. Values are bounded to -1..+1 and carry their own confidence and coverage.
 * ----------------------------------------------------------------------------------------------- */

export const DIMENSION_IDS = [
  'PACE',
  'RHYTHM',
  'REPERTOIRE',
  'CONTEXT_RESPONSE',
  'SESSION_CURVE',
  'ROUTINE',
  'SESSION_SPAN',
] as const;
export type DimensionId = (typeof DIMENSION_IDS)[number];

export const DIMENSION_MEANINGS: Record<DimensionId, { low: string; high: string; plain: string }> = {
  PACE: { low: 'slower', high: 'quicker', plain: 'How quickly the logged drinks tend to go down.' },
  RHYTHM: { low: 'steady', high: 'variable', plain: 'How even the gaps between logged drinks are.' },
  REPERTOIRE: { low: 'loyal / repetitive', high: 'exploratory / varied', plain: 'How much the logged choices repeat.' },
  CONTEXT_RESPONSE: {
    low: 'stable across contexts',
    high: 'changes with the context',
    plain: 'Whether explicit contexts explain a real behavioural difference.',
  },
  SESSION_CURVE: { low: 'tapers off', high: 'builds later', plain: 'Where the weight of the night sits.' },
  ROUTINE: {
    low: 'ritualised / concentrated',
    high: 'spontaneous / distributed',
    plain: 'How concentrated the logged timing and choices are.',
  },
  SESSION_SPAN: { low: 'compact', high: 'extended', plain: 'How long the logged nights run.' },
};

/** One source number behind a dimension, so the reading can be checked. */
export type SupportingMetric = {
  metric_id: string;
  value: number | null;
  unit: string;
  nights: number;
  explanation: string;
};

export type DimensionReading = {
  dimension_id: DimensionId;
  /** -1..+1, or null when the dimension cannot be read from the available evidence. */
  value: number | null;
  /** Evidence quality and coverage, never the probability that a person "really is" something. */
  confidence: number;
  coverage: number;
  supporting_nights: number;
  source_metrics: SupportingMetric[];
  missing_reasons: DataQualityFlag[];
  quality_flags: DataQualityFlag[];
};

export type BehaviorProfile = {
  profile_version: typeof BEHAVIOR_PROFILE_VERSION;
  threshold_version: typeof DRINKING_STYLE_THRESHOLD_VERSION;
  window_days: number;
  nights: number;
  independent_days: number;
  dimensions: Record<DimensionId, DimensionReading>;
};

/* -------------------------------------------------------------------------------------------------
 * Data quality vocabulary.
 * ----------------------------------------------------------------------------------------------- */

export const DATA_QUALITY_FLAGS = [
  'NO_LOGGED_NIGHTS',
  'TOO_FEW_INDEPENDENT_DAYS',
  'TOO_FEW_INTERVALS',
  'RECORDED_TIME_ONLY',
  'BULK_ENTRY_SUSPECTED',
  'UNKNOWN_IDENTITY_SHARE',
  'UNKNOWN_QUANTITY',
  'WIDE_QUANTITY_RANGE',
  'MISSING_CONTEXT',
  'MISSING_FOOD',
  'WATER_NOT_TRACKED',
  'SAME_DAY_SESSIONS',
  'CONFLICTING_READING',
  'STABILITY_NOT_TESTABLE',
  'AUTOMATIC_END_EXCLUDED',
] as const;
export type DataQualityFlag = (typeof DATA_QUALITY_FLAGS)[number];


export type PreviousStyleRecord = {
  algorithm_version: string;
  main_archetype: ArchetypeId | null;
};

/* -------------------------------------------------------------------------------------------------
 * Composite archetypes: eight product prototypes, plus Still Mixing and Learning as states.
 * ----------------------------------------------------------------------------------------------- */

export const ARCHETYPE_IDS = [
  'THE_RITUALIST',
  'THE_EXPLORER',
  'THE_CRUISER',
  'THE_RISER',
  'THE_SOCIAL_SHIFTER',
  'THE_FREEFORM',
  'THE_TAPER',
  'THE_METRONOME',
] as const;
export type ArchetypeId = (typeof ARCHETYPE_IDS)[number];

/** Internal name → user-facing Mellow name. Locked for v1 unless real-user evidence says otherwise. */
export const ARCHETYPE_NAMES: Record<ArchetypeId, string> = {
  THE_RITUALIST: 'The Usual',
  THE_EXPLORER: 'Menu Roamer',
  THE_CRUISER: 'Easy Does It',
  THE_RISER: 'Second Wind',
  THE_SOCIAL_SHIFTER: 'Room Reader',
  THE_FREEFORM: 'Off Script',
  THE_TAPER: 'Soft Landing',
  THE_METRONOME: 'Steady Hand',
};

export const STILL_MIXING_NAME = 'Still Mixing' as const;

export const EVIDENCE_STATUSES = ['INSUFFICIENT', 'EARLY_READ', 'SUPPORTED_PATTERN'] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

/** What the app is allowed to show: nothing yet, a mature ambiguity, or a named reading. */
export type StyleReadingKind = 'LEARNING' | 'STILL_MIXING' | 'ARCHETYPE';

export type StyleReading = {
  kind: StyleReadingKind;
  archetype_id: ArchetypeId | null;
  status: EvidenceStatus;
  /** Why this reading, in plain words, for the evidence panel. */
  reasons: string[];
};

export type DimensionContribution = {
  dimension_id: DimensionId;
  value: number | null;
  target: number;
  alignment: number;
  weight: number;
  confidence: number;
  role: 'CORE' | 'SUPPORT';
};

export type PrototypeCandidate = {
  prototype_id: ArchetypeId;
  score: number;
  core_dimension_support: DimensionContribution[];
  derived_core_support?: Array<{feature_id:'CONTEXT_RESIDUAL';value:number;target:number;alignment:number;weight:number;confidence:number;coverage:number}>;
  support_dimension_support: DimensionContribution[];
  /** Which dimension supplied the conditional second core evidence, when the prototype needs one. */
  second_core_dimension: DimensionId | null;
  coverage: number;
  stability: number;
  eligible: boolean;
  ineligible_reasons: string[];
};

export type TraitId =
  | 'FAMILIAR_CHOICES'
  | 'WIDE_CHOICES'
  | 'SLOW_RECORDED_PACE'
  | 'QUICK_RECORDED_PACE'
  | 'EVEN_RHYTHM'
  | 'VARIABLE_RHYTHM'
  | 'TAPERING_NIGHTS'
  | 'RISING_NIGHTS'
  | 'LONG_NIGHTS'
  | 'SHORT_NIGHTS'
  | 'CONTEXT_SHIFTS'
  | 'CONSISTENT_TIMING'
  | 'WEEKEND_TIMING'
  | 'DINNER_CONTEXT';

export type Trait = {
  trait_id: TraitId;
  title: string;
  line: string;
  /** The dimension or raw observation behind the trait, so it is never a bare badge. */
  evidence: { dimension_id: DimensionId | null; value: number | null; nights: number; source_metric: string };
};

/* -------------------------------------------------------------------------------------------------
 * Switching: a reading is dynamic but sticky, and only moves on reviewed nights.
 * ----------------------------------------------------------------------------------------------- */

export const ARCHETYPE_STATES = ['CURRENT', 'CHALLENGER', 'SWITCHED', 'WITHDRAWN'] as const;
export type ArchetypeState = (typeof ARCHETYPE_STATES)[number];

/** The minimal per-account state the switch needs, and nothing else. */
export type StyleSwitchRecord = {
  /** Fingerprints of independently revalidated publication evidence, never raw nights. */
  publication_basis?: string[];
  algorithm_version: string;
  current_archetype: ArchetypeId | null;
  challenger_archetype: ArchetypeId | null;
  challenger_streak: number;
  last_reviewed_revision: number | null;
  /** What the last evaluation published, so "nothing yet" is not confused with "Still Mixing". */
  last_reading_kind: StyleReadingKind;
  saved_at: string;
};

export type SwitchOutcome = {
  state: ArchetypeState;
  current: ArchetypeId | null;
  challenger: ArchetypeId | null;
  challenger_streak: number;
  margin_needed: number;
  score_gap: number | null;
  reasons: string[];
};

/* -------------------------------------------------------------------------------------------------
 * The published result.
 * ----------------------------------------------------------------------------------------------- */

export type FirstReadGate = {
  required_nights: number;
  valid_nights: number;
  met: boolean;
};

export type WithdrawnReading = {
  archetype_id: ArchetypeId;
  reason: 'BELOW_NIGHT_GATE' | 'EVIDENCE_WITHDRAWN' | 'BELOW_STABILITY';
};

export type DrinkingStyle = {
  algorithm_version: typeof DRINKING_STYLE_ALGORITHM_VERSION;
  profile_version: typeof BEHAVIOR_PROFILE_VERSION;
  prototype_version: typeof PROTOTYPE_VERSION;
  threshold_version: typeof DRINKING_STYLE_THRESHOLD_VERSION;
  switching_version: typeof SWITCHING_VERSION;
  data_revision: number;
  generated_at: string;
  observation_window: { days: number; from: string; to: string };
  first_read: FirstReadGate;
  previous_algorithm_version: string | null;
  previous_main_archetype: ArchetypeId | null;
  withdrawn: WithdrawnReading | null;
  independent_days: number;
  completed_nights: number;
  profile: BehaviorProfile;
  candidates: PrototypeCandidate[];
  reading: StyleReading;
  switch: SwitchOutcome;
  /** The minimal state the next reviewed update needs. Nothing else is persisted. */
  switch_record: StyleSwitchRecord;
  evidence_summary: string[];
  data_quality: { flags: DataQualityFlag[]; notes: string[] };
  /**
   * Hidden nights-3-5 evaluation. Internal only: never rendered, never shared, never a personality.
   * Present from the third valid night so the first public read can use a settled direction.
   */
  shadow: ShadowEvaluation | null;
};

export type StyleCardStat = { label: string; value: string; detail: string };

/** What a card may show. Deliberately small, and deliberately not a score. */
export type StyleCard = {
  version: typeof DRINKING_STYLE_CARD_VERSION;
  display_name: string;
  relationship: { kind: 'FAMILIARITY' | 'BOND'; value: number; label: string };
  first_read: FirstReadGate;
  /** The user-facing name only. The internal prototype id is never shown by default. */
  archetype: { archetype_id: ArchetypeId; name: string; status: EvidenceStatus; line: string; one_line: string } | null;
  still_mixing: boolean;
  /** The one-line personality description; present for Still Mixing too. Free owns this and nothing more. */
  still_mixing_line: string;
  /**
   * How much the card is allowed to say. `BASIC` is the Free card: one label, one line, a basic share.
   * `FULL` is the premium reading, with traits, stats and the reader's comment.
   */
  scope: StyleCardScope;
  traits: Trait[];
  stats: StyleCardStat[];
  comment: string | null;
  basis: string;
  evidence_available: boolean;
  private_note: string | null;
};

export const STYLE_CARD_SCOPES = ['BASIC', 'FULL'] as const;
export type StyleCardScope = (typeof STYLE_CARD_SCOPES)[number];

/** Hidden nights-3-5 evaluations. Never rendered, never shared, never part of a card. */
export type ShadowNightEvaluation = {
  /** The night count the evaluation was computed from, e.g. 3 means "nights 1-3". */
  through_night: number;
  lead_archetype: ArchetypeId | null;
  lead_eligible: boolean;
  top_score: number | null;
  margin: number | null;
};

export type ShadowEvaluation = {
  version: string;
  /** Structurally false: nothing in the product may present a shadow result to the user. */
  user_visible: false;
  publishes_personality: false;
  influences_bond: false;
  from_night: number;
  evaluations: ShadowNightEvaluation[];
  /** Consecutive trailing nightly evaluations led by one eligible archetype. */
  lead_streak: { archetype_id: ArchetypeId | null; nights: number; through_night: number };
};

/** What leaves the device when the person chooses to share. Nothing else. */
export type StyleSharePayload = {
  version: typeof DRINKING_STYLE_CARD_VERSION;
  display_name: string;
  archetype_name: string | null;
  archetype_line: string | null;
  traits: string[];
};
