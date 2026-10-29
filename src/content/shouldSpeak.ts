import {
  CONTENT_OUTPUT_CONTRACT_VERSION,
  isSessionEndEvent,
  priorityRank,
  safetyRank,
  strongerSafety,
  type ContentContext,
  type ContentDecision,
  type ContentEvaluation,
  type ContentInsight,
  type SafetyLevel,
  type SilenceReason,
} from './contracts';
import { familiarityBand } from './familiarity';
import { followupInsights, followupSignals, parseOutcome } from './followup';
import { factKindOrder, importanceOf } from './taxonomy';
import { endNightInsights } from './recap';
import { assessSafety, safetyInsights } from './safety';
import { tonightInsights } from './tonight';
import { renderFor } from './voice';

/**
 * The decision layer (spec §6, §7) and the pipeline that drives it.
 *
 * `shouldSpeak` is deliberately its own step with its own return type, because the most common
 * correct answer is silence. It never renders anything: it receives candidates, removes the ones
 * the reader is not allowed to hear, and picks at most one.
 */

export type SpeakDecision = {
  speak: ContentInsight | null;
  reason: SilenceReason | null;
  /** Candidates that existed but were withheld because the reader lacks the capability. */
  locked: ContentInsight[];
};

/**
 * Arbitration order, in full:
 *   1. priority tier — a lower tier can never displace a higher one,
 *   2. safety severity inside the tier — the worse risk wins,
 *   3. importance inside the tier,
 *   4. declaration order of the fact kind,
 *   5. the insight key, so the outcome is fully deterministic.
 */
export function compareInsights(a: ContentInsight, b: ContentInsight): number {
  return (
    priorityRank(a.priority) - priorityRank(b.priority) ||
    safetyRank(b.safety_level) - safetyRank(a.safety_level) ||
    importanceOf(b.fact_kind) - importanceOf(a.fact_kind) ||
    factKindOrder(a.fact_kind) - factKindOrder(b.fact_kind) ||
    a.key.localeCompare(b.key)
  );
}

export function shouldSpeak(insights: readonly ContentInsight[], context: ContentContext): SpeakDecision {
  const readable: ContentInsight[] = [];
  const locked: ContentInsight[] = [];
  for (const insight of insights) {
    if (insight.capability === null || context.capability.canRead(insight.capability)) readable.push(insight);
    else locked.push(insight);
  }
  if (readable.length === 0) {
    return {
      speak: null,
      reason: locked.length > 0 ? 'CAPABILITY_NOT_READABLE' : 'NO_MEANINGFUL_NEW_INFORMATION',
      locked,
    };
  }
  const ranked = [...readable].sort(compareInsights);
  return { speak: ranked[0], reason: null, locked };
}

/** Every candidate for this event, plus any evidence worth handing to the personal model. */
export function evaluate(context: ContentContext): ContentEvaluation {
  const assessment = assessSafety(context.session);
  const eventInsights =
    context.event === 'NEXT_DAY_FOLLOWUP'
      ? followupInsights(context)
      : isSessionEndEvent(context.event)
        ? endNightInsights(context)
        : tonightInsights(context);
  const insights = [...safetyInsights(context.session, assessment), ...eventInsights];
  const signals =
    context.event === 'NEXT_DAY_FOLLOWUP'
      ? followupSignals(context, parseOutcome(context.followup?.outcome ?? null, context.followup?.prediction ?? null))
      : [];
  const safetyLevel = insights.reduce<SafetyLevel>(
    (level, insight) => strongerSafety(level, insight.safety_level),
    assessment.level,
  );
  return { insights, model_signals: signals, safety_level: safetyLevel };
}

function silence(reason: SilenceReason, evaluation: ContentEvaluation, context: ContentContext): ContentDecision {
  return {
    version: CONTENT_OUTPUT_CONTRACT_VERSION,
    should_speak: false,
    reason,
    priority: null,
    speech_act: null,
    speech_reason: null,
    message: null,
    tone: null,
    template_id: null,
    evidence_level: 'NONE',
    personalized: false,
    safety_level: evaluation.safety_level,
    model_signals: evaluation.model_signals,
    current_fact: {},
    personal_comparison: null,
    historical_evidence: null,
    followup_context: context.followup ?? null,
    followup_reaction: null,
    insight_key: null,
    capability: null,
  };
}

/**
 * The pipeline: event → context → insight → should Mellow speak → voice render → one line.
 *
 * Raw data may never jump straight to a sentence. An event that carries no new information produces
 * no candidate, no candidate produces no line, and every line comes from the frozen voice layer.
 */
export function observe(context: ContentContext): ContentDecision {
  const evaluation = evaluate(context);
  const decision = shouldSpeak(evaluation.insights, context);
  if (!decision.speak) return silence(decision.reason ?? 'NO_MEANINGFUL_NEW_INFORMATION', evaluation, context);
  const insight = decision.speak;

  // An automatic ending is metadata, not a user action. A night with nothing to report stays quiet
  // instead of receiving a personality line for having closed itself.
  if (context.event === 'SESSION_ENDED_AUTO_INACTIVITY' && insight.priority === 'P6') {
    return silence('NO_MEANINGFUL_NEW_INFORMATION', evaluation, context);
  }

  const reaction = renderFor(insight, {
    band: familiarityBand(context.personal),
    safety: evaluation.safety_level,
    seed: context.variant_seed ?? 0,
  });
  if (!reaction) return silence('EVIDENCE_INSUFFICIENT', evaluation, context);
  if (reaction.blocked) return silence('VOICE_POLICY_BLOCKED', evaluation, context);

  return {
    version: CONTENT_OUTPUT_CONTRACT_VERSION,
    should_speak: true,
    reason: null,
    priority: insight.priority,
    speech_act: insight.speech_act,
    speech_reason: insight.speech_reason,
    message: reaction.message,
    tone: reaction.tone,
    template_id: reaction.templateId,
    evidence_level: insight.historical_evidence.level,
    personalized: insight.personalized,
    safety_level: evaluation.safety_level,
    model_signals: evaluation.model_signals,
    current_fact: insight.current_fact,
    personal_comparison: insight.personal_comparison,
    historical_evidence: insight.historical_evidence,
    followup_context: context.followup ?? null,
    followup_reaction: context.event === 'NEXT_DAY_FOLLOWUP' ? reaction.message : null,
    insight_key: insight.key,
    capability: insight.capability,
  };
}
