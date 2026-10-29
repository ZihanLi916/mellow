import {
  CONTENT_DATASET_VERSION,
  CONTENT_ENGINE_VERSION,
  CONTENT_OUTPUT_CONTRACT_VERSION,
  CONTENT_SCHEMA_VERSION,
  END_NIGHT_INTEGRATION_VERSION,
  EVIDENCE_LANGUAGE_VERSION,
  FAMILIARITY_GRAMMAR_VERSION,
  FOLLOWUP_SIGNAL_CONTRACT_VERSION,
  SPEECH_PRIORITY_VERSION,
  VOICE_RULES_VERSION,
} from './contracts';

/**
 * Mellow Content Engine v0.1 — the public entry point.
 *
 * Nothing in the product has to import the pieces separately: this module is the whole interface
 * between stored facts and the cat's one line. It never renders a sentence itself and it never
 * inspects a plan.
 */

export * from './contracts';
export {
  UNREADABLE_CAPABILITIES,
  capabilityDecision,
  capabilityPortFromEntitlement,
  capabilityPortFromSummary,
} from './capability';
export {
  BAND_GRAMMAR,
  bandOf,
  evidenceLevelForNights,
  familiarityBand,
} from './familiarity';
export {
  REPEATED_MARKERS,
  STABLE_MARKERS,
  WEAK_MARKERS,
  auditEvidenceLanguage,
  claimStrength,
  evidenceFromNights,
  evidenceLanguageAllowed,
  evidenceSummary,
} from './evidence';
export { FACT_KIND_SPEC, GENERALIZING_KINDS, factKindOrder, generalizes, importanceOf } from './taxonomy';
export { buildInsight } from './insight';
export { assessSafety, maxDrinksWithin, safetyInsights } from './safety';
export { endNightInsights, endNightMetadata, recapInsights } from './recap';
export { tonightInsights } from './tonight';
export { followupInsights, followupSignals, parseOutcome, patternOf } from './followup';
export { modelSignal, signalCodes, sortSignals } from './signals';
export { compareInsights, evaluate, observe, shouldSpeak } from './shouldSpeak';
export type { SpeakDecision } from './shouldSpeak';
export {
  baselineFrom,
  foodFromProduct,
  historicalSummaries,
  historicalSummary,
  localHour,
  median,
  MIN_PATTERN_NIGHTS,
  morningSeverity,
  patternsFrom,
} from './history';
export {
  contentContextFromSnapshot,
  historyFromSnapshot,
  outcomeFromReports,
  personalContextFromProfile,
  projectEndNightRecap,
  reportsForSession,
  sessionContextFromSnapshot,
  sessionContextFromTonightSession,
  subjectiveStateForLevel,
  waterFacts,
} from './adapt';
export type { SessionExtras, SnapshotContextInput, StateReportSource, WaterFacts } from './adapt';
export {
  PRODUCTION_CANDIDATE_MINIMUM,
  HARD_FAIL_RULES,
  SCORING_DIMENSIONS,
  scoreContent,
  templateForDecision,
} from './scoring';
export type { ContentScore, HardFailRule, ScoreDimension, ScoreInput } from './scoring';
export {
  VOICE_TEMPLATES,
  VOICE_TEMPLATE_IDS,
  auditCatalog,
  isTemplateAllowed,
  renderFor,
  renderInsight,
  selectTemplate,
  templateAllowedAtEvidence,
  templateById,
  templatesFor,
} from './voice';
export {
  VOICE_RULES,
  allowedTones,
  auditVoice,
  brevityBudget,
  hardViolations,
  sentenceCount,
  toneAllowed,
  wordCount,
} from './voice/rules';
export { templateClaim } from './voice/template';
export type { RenderedReaction, TemplateSelectionOptions } from './voice';
export type { VoiceViolation, VoiceViolationCode } from './voice/rules';
export type { VoiceTemplate } from './voice/template';

/** Everything a freeze manifest has to record about this version. */
export const CONTENT_ENGINE_VERSIONS = {
  engine: CONTENT_ENGINE_VERSION,
  schema: CONTENT_SCHEMA_VERSION,
  output_contract: CONTENT_OUTPUT_CONTRACT_VERSION,
  speech_priority: SPEECH_PRIORITY_VERSION,
  voice_rules: VOICE_RULES_VERSION,
  familiarity_grammar: FAMILIARITY_GRAMMAR_VERSION,
  evidence_language: EVIDENCE_LANGUAGE_VERSION,
  followup_signal_contract: FOLLOWUP_SIGNAL_CONTRACT_VERSION,
  end_night_integration: END_NIGHT_INTEGRATION_VERSION,
  dataset: CONTENT_DATASET_VERSION,
} as const;

export type ContentEngineVersions = typeof CONTENT_ENGINE_VERSIONS;
