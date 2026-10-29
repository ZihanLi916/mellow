import {
  MIN_REPEATED_NIGHTS,
  type ContentContext,
  type ContentInsight,
  type FactValue,
  type HistoricalPattern,
  type ModelSignal,
  type NextDayOutcome,
  type OutcomePrediction,
} from './contracts';
import { evidenceFromNights } from './evidence';
import { buildInsight } from './insight';
import { modelSignal } from './signals';

/**
 * Next-day follow-up (spec §21–§24).
 *
 * Flow: previous session → the user's own outcome answers → outcome parser → comparison with the
 * prediction that genuinely existed → one reaction → structured model signals.
 *
 * Two rules shape this file. Signals are evidence, not insight: the user's own history is always
 * theirs to record, so signals are emitted on every plan while the *reaction* respects the
 * capability gate. And nothing is claimed that the answers do not contain — a missing answer stays
 * missing and never becomes a zero.
 */

export type OutcomeParse = {
  answered: number;
  /** `null` when neither the morning nor the hangover answer exists. */
  morning_severity: number | null;
  prediction_delta: number | null;
  prediction_direction: 'UNDERESTIMATED' | 'OVERESTIMATED' | 'MATCHED' | null;
};

/** Reads only what the user actually answered. Absent answers stay absent. */
export function parseOutcome(outcome: NextDayOutcome | null, prediction: OutcomePrediction | null): OutcomeParse {
  if (!outcome) return { answered: 0, morning_severity: null, prediction_delta: null, prediction_direction: null };
  const answered = [
    outcome.felt_intoxication,
    outcome.hangover,
    outcome.sleep_quality,
    outcome.memory_quality,
    outcome.mood,
    outcome.overall_morning,
  ].filter((value) => value !== null && Number.isFinite(value)).length;
  const severityCandidates = [outcome.overall_morning, outcome.hangover].filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  const expected = prediction?.expected_level ?? null;
  const felt = outcome.felt_intoxication;
  const delta = expected !== null && felt !== null ? felt - expected : null;
  const direction = delta === null ? null : delta >= 1 ? 'UNDERESTIMATED' : delta <= -1 ? 'OVERESTIMATED' : 'MATCHED';
  return {
    answered,
    morning_severity: severityCandidates.length ? Math.max(...severityCandidates) : null,
    prediction_delta: delta,
    prediction_direction: direction,
  };
}

export function patternOf(context: ContentContext, key: HistoricalPattern['key']): HistoricalPattern | null {
  return context.personal.patterns.find((candidate) => candidate.key === key) ?? null;
}

/** Signals exist to teach the model, so they are emitted regardless of what may be said aloud. */
export function followupSignals(context: ContentContext, parsed: OutcomeParse): ModelSignal[] {
  const outcome = context.followup?.outcome ?? null;
  if (!outcome) return [];
  const session = context.session;
  const sessionId = outcome.session_id;
  const at = outcome.recorded_at;
  const base = { sessionId, at, nights: 1, evidenceIds: [sessionId] };
  const signals: ModelSignal[] = [];

  if (outcome.felt_intoxication !== null) {
    signals.push(
      modelSignal({
        ...base,
        code: 'subjective_intoxication_signal',
        direction: outcome.felt_intoxication >= 3 ? 'HIGHER' : outcome.felt_intoxication <= 1 ? 'LOWER' : 'SAME',
        magnitude: outcome.felt_intoxication,
      }),
    );
  }
  if (outcome.hangover !== null) {
    signals.push(
      modelSignal({ ...base, code: 'hangover_signal', direction: outcome.hangover >= 2 ? 'HIGHER' : 'SAME', magnitude: outcome.hangover }),
    );
  }
  if (outcome.sleep_quality !== null) {
    signals.push(
      modelSignal({
        ...base,
        code: 'sleep_outcome_signal',
        direction: outcome.sleep_quality >= 3 ? 'HIGHER' : 'SAME',
        magnitude: outcome.sleep_quality,
      }),
    );
  }
  if (parsed.prediction_direction === 'UNDERESTIMATED' || parsed.prediction_direction === 'OVERESTIMATED') {
    const underestimated = parsed.prediction_direction === 'UNDERESTIMATED';
    signals.push(
      modelSignal({
        ...base,
        code: underestimated ? 'prediction_underestimated' : 'prediction_overestimated',
        direction: underestimated ? 'HIGHER' : 'LOWER',
        magnitude: parsed.prediction_delta === null ? null : Math.abs(parsed.prediction_delta),
        nights: context.followup?.prediction?.support.nights ?? 1,
        evidenceIds: [...(context.followup?.prediction?.support.evidence_ids ?? []), sessionId],
      }),
    );
  }
  const severity = parsed.morning_severity;
  const fastNight = session ? session.fast_drink_count >= 2 : false;
  const ateFood = session ? session.food === 'ATE' || session.food === 'LITTLE' : false;
  if (severity !== null && fastNight) {
    signals.push(
      modelSignal({ ...base, code: 'pace_outcome_signal', direction: severity >= 2 ? 'HIGHER' : 'LOWER', magnitude: severity }),
    );
  }
  if (severity !== null && ateFood) {
    signals.push(
      modelSignal({ ...base, code: 'food_outcome_signal', direction: severity <= 1 ? 'LOWER' : 'HIGHER', magnitude: severity }),
    );
  }
  const fastPattern = patternOf(context, 'FAST_NIGHT');
  if (severity !== null && fastNight && fastPattern && fastPattern.nights >= MIN_REPEATED_NIGHTS) {
    signals.push(
      modelSignal({
        ...base,
        code: severity >= 2 ? 'pattern_support' : 'pattern_contradiction',
        direction: severity >= 2 ? 'SUPPORTS' : 'CONTRADICTS',
        magnitude: severity,
        nights: fastPattern.nights,
        evidenceIds: [...fastPattern.evidence_ids, sessionId],
      }),
    );
  }
  const foodPattern = patternOf(context, 'FOOD_BEFORE_DRINKS');
  if (severity !== null && ateFood && foodPattern && foodPattern.nights >= MIN_REPEATED_NIGHTS) {
    signals.push(
      modelSignal({
        ...base,
        code: severity <= 1 ? 'pattern_support' : 'pattern_contradiction',
        direction: severity <= 1 ? 'SUPPORTS' : 'CONTRADICTS',
        magnitude: severity,
        nights: foodPattern.nights,
        evidenceIds: [...foodPattern.evidence_ids, sessionId],
      }),
    );
  }
  return signals;
}

function outcomeFacts(context: ContentContext, parsed: OutcomeParse): Record<string, FactValue> {
  const outcome = context.followup?.outcome ?? null;
  const prediction = context.followup?.prediction ?? null;
  return {
    'followup.felt_intoxication': outcome?.felt_intoxication ?? null,
    'followup.hangover': outcome?.hangover ?? null,
    'followup.sleep_quality': outcome?.sleep_quality ?? null,
    'followup.memory_quality': outcome?.memory_quality ?? null,
    'followup.mood': outcome?.mood ?? null,
    'followup.overall_morning': outcome?.overall_morning ?? null,
    'followup.prediction_expected_level': prediction?.expected_level ?? null,
    'followup.prediction_delta': parsed.prediction_delta,
    'followup.prediction_basis': prediction?.basis ?? null,
    'followup.answered': parsed.answered,
    'session.drink_count': context.session?.drink_count ?? null,
    'session.fast_drink_count': context.session?.fast_drink_count ?? null,
    'session.food': context.session?.food ?? null,
  };
}

function patternFacts(pattern: HistoricalPattern | null, facts: Record<string, FactValue>): Record<string, FactValue> {
  return {
    ...facts,
    'pattern.nights': pattern?.nights ?? 0,
    'pattern.key': pattern?.key ?? null,
    'pattern.outcome.nights_with_outcome': pattern?.outcome?.nights_with_outcome ?? 0,
    'pattern.outcome.heavier_mornings': pattern?.outcome?.heavier_mornings ?? 0,
    'pattern.outcome.milder_mornings': pattern?.outcome?.milder_mornings ?? 0,
  };
}

/**
 * One reaction per follow-up. Cases are ordered by the frozen priority ladder and the dataset
 * asserts the resulting tier, so this list can never quietly re-rank itself.
 *
 * Follow-up priority rules (v0.1):
 * - P0 when the night itself was reported as a very heavy one.
 * - P1 when the outcome corrects the personal model: a genuine learning moment.
 * - P3 when the outcome speaks to a cross-session pattern that already has nights behind it.
 * - P4 when it reads as a meaningful but single-night picture.
 * - P6 when there is nothing yet to learn.
 */
export function followupInsights(context: ContentContext): ContentInsight[] {
  const outcome = context.followup?.outcome ?? null;
  if (!outcome) return [];
  const parsed = parseOutcome(outcome, context.followup?.prediction ?? null);
  const facts = outcomeFacts(context, parsed);
  const insights: ContentInsight[] = [];
  const felt = outcome.felt_intoxication;
  const severity = parsed.morning_severity;
  const delta = parsed.prediction_delta;

  if (felt !== null && felt >= 4) {
    insights.push(buildInsight({ factKind: 'MORNING_HEAVY_FELT', safetyLevel: 'HIGH', currentFact: facts }));
  }
  if (delta !== null && Math.abs(delta) >= 1) {
    const prediction = context.followup?.prediction ?? null;
    insights.push(
      buildInsight({
        factKind: delta > 0 ? 'MORNING_UNDERESTIMATED' : 'MORNING_OVERESTIMATED',
        personalized: true,
        capability: prediction?.capability,
        currentFact: facts,
        historicalEvidence: evidenceFromNights(prediction?.support.nights ?? 0, prediction?.support.evidence_ids ?? []),
      }),
    );
  }
  const fastPattern = patternOf(context, 'FAST_NIGHT');
  const fastOutcome = fastPattern?.outcome ?? null;
  if (
    fastPattern &&
    fastOutcome &&
    fastOutcome.nights_with_outcome >= MIN_REPEATED_NIGHTS &&
    fastOutcome.heavier_mornings >= MIN_REPEATED_NIGHTS &&
    severity !== null &&
    severity >= 2
  ) {
    insights.push(
      buildInsight({
        factKind: 'MORNING_FAST_NIGHTS_UNKIND',
        personalized: true,
        currentFact: patternFacts(fastPattern, facts),
        historicalEvidence: evidenceFromNights(fastPattern.nights, fastPattern.evidence_ids),
      }),
    );
  }
  const foodPattern = patternOf(context, 'FOOD_BEFORE_DRINKS');
  const foodOutcome = foodPattern?.outcome ?? null;
  if (
    foodPattern &&
    foodOutcome &&
    foodOutcome.nights_with_outcome >= MIN_REPEATED_NIGHTS &&
    foodOutcome.milder_mornings >= MIN_REPEATED_NIGHTS &&
    severity !== null &&
    severity <= 1
  ) {
    insights.push(
      buildInsight({
        factKind: 'MORNING_FOOD_CASE',
        personalized: true,
        currentFact: patternFacts(foodPattern, facts),
        historicalEvidence: evidenceFromNights(foodPattern.nights, foodPattern.evidence_ids),
      }),
    );
  }
  const latePattern = patternOf(context, 'LATE_COCKTAILS');
  if (latePattern && latePattern.nights >= MIN_REPEATED_NIGHTS && severity !== null && severity >= 2) {
    insights.push(
      buildInsight({
        factKind: 'MORNING_LATE_COCKTAILS',
        personalized: true,
        currentFact: patternFacts(latePattern, facts),
        historicalEvidence: evidenceFromNights(latePattern.nights, latePattern.evidence_ids),
      }),
    );
  }
  if (outcome.sleep_quality !== null && outcome.sleep_quality >= 3 && felt !== null && felt <= 2) {
    insights.push(buildInsight({ factKind: 'MORNING_SLEEP_DISAGREES', currentFact: facts }));
  }
  const baseline = context.personal.baseline;
  if (
    severity !== null &&
    severity >= 2 &&
    baseline?.typical_night_drinks != null &&
    context.session &&
    Math.abs(context.session.drink_count - baseline.typical_night_drinks) <= 1
  ) {
    insights.push(
      buildInsight({
        factKind: 'MORNING_ROUGHER_SAME_INTAKE',
        personalized: true,
        currentFact: facts,
        historicalEvidence: evidenceFromNights(baseline.evidence_nights, baseline.evidence_ids),
      }),
    );
  }
  // The model was right and the morning agreed. Only claimable when a prediction really existed.
  if (severity !== null && severity <= 1 && delta !== null && Math.abs(delta) < 1) {
    insights.push(
      buildInsight({
        factKind: 'MORNING_COMFORTABLE_ZONE',
        personalized: true,
        currentFact: facts,
        historicalEvidence: evidenceFromNights(
          context.followup?.prediction?.support.nights ?? 0,
          context.followup?.prediction?.support.evidence_ids ?? [],
        ),
      }),
    );
  }
  if (insights.length === 0 && parsed.answered >= 1) {
    insights.push(buildInsight({ factKind: 'MORNING_NO_EVIDENCE', currentFact: facts }));
  }
  return insights;
}

// __CONTINUE__
