import {
  FAST_GAP_MINUTES,
  SLOW_GAP_MINUTES,
  STRONG_ABV_PERCENT,
  type ContentContext,
  type ContentInsight,
  type FactValue,
  type HistoricalPattern,
  type PersonalBaselineFacts,
  type SessionContext,
} from './contracts';
import { evidenceFromNights } from './evidence';
import { buildInsight } from './insight';

/**
 * Tonight evaluation (spec §13).
 *
 * Every candidate here is derived from facts that already exist: confirmed drink timestamps, an
 * explicit strong ABV, a logged water or food entry, a user-reported state. Nothing is inferred
 * that the session does not contain, and an ordinary night produces an empty list.
 *
 * Personal comparisons read `baseline` and `patterns` from the personal context. Reading them is
 * exactly what the capability on the insight gates, so the evaluator itself never asks about access.
 */

function baselineFactKeys(baseline: PersonalBaselineFacts | null): Record<string, FactValue> {
  return {
    'baseline.typical_buzz_onset_minutes': baseline?.typical_buzz_onset_minutes ?? null,
    'baseline.typical_pace_per_hour': baseline?.typical_pace_per_hour ?? null,
    'baseline.evidence_nights': baseline?.evidence_nights ?? 0,
  };
}

function sessionFactKeys(session: SessionContext): Record<string, FactValue> {
  return {
    'session.drink_count': session.drink_count,
    'session.last_gap_minutes': session.last_gap_minutes,
    'session.previous_gap_minutes': session.previous_gap_minutes,
    'session.median_gap_minutes': session.median_gap_minutes,
    'session.fast_drink_count': session.fast_drink_count,
    'session.fast_drinks_before_water': session.fast_drinks_before_water,
    'session.water_count': session.water_count,
    'session.food': session.food,
    'session.minutes_to_reported_state': session.minutes_to_reported_state,
    'session.reported_state_level': session.reported_state?.level ?? null,
    'session.previous_state_level': session.previous_state?.level ?? null,
    'session.first_drink_abv': session.first_drink?.abv_percent ?? null,
    'session.driving_declared': session.driving_declared,
    'session.first_half_drinks': session.first_half_drinks,
    'session.second_half_drinks': session.second_half_drinks,
  };
}

/** Tonight's own pace against the person's typical pace, when a baseline genuinely exists. */
function slowerThanUsual(session: SessionContext, baseline: PersonalBaselineFacts | null): boolean {
  if (!baseline || baseline.evidence_nights <= 0) return false;
  if (baseline.typical_pace_per_hour === null || baseline.typical_pace_per_hour <= 0) return false;
  if (session.drink_count < 2 || session.session_minutes <= 0) return false;
  const tonightPace = session.drink_count / (session.session_minutes / 60);
  return tonightPace <= baseline.typical_pace_per_hour * 0.75;
}

/**
 * Pattern candidates. The first occurrence of a shape is deliberately silent (spec §13-12): a
 * pattern is only announced from its second independent night onward.
 */
function patternInsights(context: ContentContext, session: SessionContext): ContentInsight[] {
  if (session.food !== 'NOT_YET' || session.fast_drink_count < 2) return [];
  const pattern: HistoricalPattern | null =
    context.personal.patterns.find((candidate) => candidate.key === 'EMPTY_STOMACH_FAST_PACE') ?? null;
  const priorNights = pattern?.nights ?? 0;
  const nights = priorNights + 1;
  if (nights < 2) return [];
  const evidence = evidenceFromNights(nights, [...(pattern?.evidence_ids ?? []), session.session_id]);
  const facts: Record<string, FactValue> = {
    ...sessionFactKeys(session),
    'pattern.nights': nights,
    'pattern.key': 'EMPTY_STOMACH_FAST_PACE',
    'pattern.prior_nights': priorNights,
  };
  if (evidence.level === 'STABLE') {
    return [buildInsight({ factKind: 'PATTERN_ESTABLISHED', personalized: true, currentFact: facts, historicalEvidence: evidence })];
  }
  if (nights >= 3) {
    return [buildInsight({ factKind: 'PATTERN_EMERGING', personalized: true, currentFact: facts, historicalEvidence: evidence })];
  }
  return [buildInsight({ factKind: 'PATTERN_SECOND_OCCURRENCE', personalized: true, currentFact: facts, historicalEvidence: evidence })];
}

function drinkInsights(context: ContentContext, session: SessionContext): ContentInsight[] {
  const insights: ContentInsight[] = [];
  const facts = sessionFactKeys(session);
  const lastGap = session.last_gap_minutes;
  const previousGap = session.previous_gap_minutes;
  const fastBurstTonight = session.fast_drink_count >= 2;

  if (session.drink_count === 1) {
    const abv = session.first_drink?.abv_percent ?? null;
    if (abv !== null && abv >= STRONG_ABV_PERCENT) {
      insights.push(buildInsight({ factKind: 'FIRST_DRINK_STRONG', currentFact: facts }));
    }
  }
  if (session.drink_count === 2 && lastGap !== null && lastGap <= FAST_GAP_MINUTES) {
    insights.push(buildInsight({ factKind: 'PACE_SECOND_FAST', currentFact: facts }));
  }
  if (
    session.drink_count >= 3 &&
    lastGap !== null &&
    previousGap !== null &&
    lastGap <= FAST_GAP_MINUTES &&
    previousGap <= FAST_GAP_MINUTES
  ) {
    insights.push(buildInsight({ factKind: 'PACE_BURST_THIRD', currentFact: facts }));
  }
  if (
    session.drink_count >= 3 &&
    lastGap !== null &&
    previousGap !== null &&
    lastGap >= SLOW_GAP_MINUTES &&
    previousGap <= FAST_GAP_MINUTES
  ) {
    insights.push(buildInsight({ factKind: 'PACE_DECELERATION', currentFact: facts }));
  }
  const planned = session.intention?.planned_drinks ?? null;
  if (planned !== null && session.drink_count >= planned + 2) {
    insights.push(
      buildInsight({
        factKind: 'INTENTION_EXCEEDED_TONIGHT',
        currentFact: { ...facts, 'intention.planned_drinks': planned },
      }),
    );
  }
  const baseline = context.personal.baseline;
  if (session.drink_count >= 3 && !fastBurstTonight && slowerThanUsual(session, baseline)) {
    insights.push(
      buildInsight({
        factKind: 'HOLDING_STEADIER_THAN_USUAL',
        personalized: true,
        currentFact: { ...facts, ...baselineFactKeys(baseline) },
        personalComparison: {
          metric: 'PACE',
          tonight: session.median_gap_minutes,
          baseline: baseline?.typical_pace_per_hour ?? null,
          direction: 'STEADIER',
          evidence_nights: baseline?.evidence_nights ?? 0,
        },
        historicalEvidence: evidenceFromNights(baseline?.evidence_nights ?? 0, baseline?.evidence_ids ?? []),
      }),
    );
  }
  insights.push(...patternInsights(context, session));
  return insights;
}

function stateInsights(context: ContentContext, session: SessionContext): ContentInsight[] {
  const reported = session.reported_state;
  const previous = session.previous_state;
  if (!reported) return [];
  const insights: ContentInsight[] = [];
  const facts = sessionFactKeys(session);
  if (previous && reported.level > previous.level && reported.level >= 2) {
    insights.push(buildInsight({ factKind: 'STATE_TRANSITION', currentFact: facts }));
  }
  const baseline = context.personal.baseline;
  if (
    reported.level >= 2 &&
    baseline?.typical_buzz_onset_minutes != null &&
    baseline.evidence_nights > 0 &&
    reported.minutes_from_start < baseline.typical_buzz_onset_minutes * 0.8
  ) {
    insights.push(
      buildInsight({
        factKind: 'STATE_EARLIER_THAN_USUAL',
        personalized: true,
        currentFact: { ...facts, ...baselineFactKeys(baseline) },
        personalComparison: {
          metric: 'BUZZ_ONSET',
          tonight: reported.minutes_from_start,
          baseline: baseline.typical_buzz_onset_minutes,
          direction: 'EARLIER',
          evidence_nights: baseline.evidence_nights,
        },
        historicalEvidence: evidenceFromNights(baseline.evidence_nights, baseline.evidence_ids),
      }),
    );
  }
  return insights;
}

/**
 * Every candidate a tonight event can produce. Ordinary, repeated and uninformative events return
 * an empty list, which is the normal case and not a failure.
 */
export function tonightInsights(context: ContentContext): ContentInsight[] {
  const session = context.session;
  if (!session) return [];
  switch (context.event) {
    case 'SESSION_STARTED':
      return [];
    case 'DRINK_LOGGED':
      return drinkInsights(context, session);
    case 'WATER_LOGGED':
      // Most water entries need no reaction. Water that follows a fast drink is worth one word.
      return session.fast_drinks_before_water >= 1 && session.drink_count >= 2
        ? [buildInsight({ factKind: 'WATER_AFTER_FAST', currentFact: sessionFactKeys(session) })]
        : [];
    case 'FOOD_LOGGED':
      return session.food !== 'NOT_YET' && session.drink_count >= 2 && session.fast_drink_count >= 1
        ? [buildInsight({ factKind: 'FOOD_TIMING', currentFact: sessionFactKeys(session) })]
        : [];
    case 'STATE_REPORTED':
      return stateInsights(context, session);
    case 'DRINK_CORRECTED':
      return session.last_drink?.corrected && session.last_drink.recognition_confidence === 'LOW'
        ? [
            buildInsight({
              factKind: 'CORRECTION_IDENTIFIED',
              currentFact: {
                ...sessionFactKeys(session),
                'drink.recognition_confidence': session.last_drink.recognition_confidence,
              },
            }),
          ]
        : [];
    default:
      return [];
  }
}
