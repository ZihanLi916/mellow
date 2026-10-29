import {
  MIN_STABLE_NIGHTS,
  isSessionEndEvent,
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
 * End Night reflection (spec §20).
 *
 * Manual ending and automatic inactivity expiry are two domain events with one pipeline: the same
 * function, the same facts, the same wording. The ending reason is *metadata*, never a reason to
 * speak and never a reason to invent a different story. It only decides one thing — whether a night
 * that has nothing to report is worth a personality line at all.
 */

function baselineFactKeys(baseline: PersonalBaselineFacts | null): Record<string, FactValue> {
  return {
    'baseline.typical_pace_per_hour': baseline?.typical_pace_per_hour ?? null,
    'baseline.typical_night_drinks': baseline?.typical_night_drinks ?? null,
  };
}

function facts(session: SessionContext, baseline: PersonalBaselineFacts | null): Record<string, FactValue> {
  return {
    'session.drink_count': session.drink_count,
    'session.session_minutes': session.session_minutes,
    'session.median_gap_minutes': session.median_gap_minutes,
    'session.fast_drink_count': session.fast_drink_count,
    'session.first_half_drinks': session.first_half_drinks,
    'session.second_half_drinks': session.second_half_drinks,
    'session.second_half_heavier': session.second_half_drinks >= session.first_half_drinks + 2,
    'session.water_count': session.water_count,
    'session.food': session.food,
    ...baselineFactKeys(baseline),
  };
}

function tonightPace(session: SessionContext): number | null {
  if (session.session_minutes <= 0 || session.drink_count < 2) return null;
  return session.drink_count / (session.session_minutes / 60);
}

/** A slope where the second half carried noticeably more than the first. */
function secondHalfPickedUp(session: SessionContext): boolean {
  if (session.drink_count < 3) return false;
  return session.second_half_drinks >= session.first_half_drinks + 2;
}

function patternOf(context: ContentContext, key: HistoricalPattern['key']): HistoricalPattern | null {
  return context.personal.patterns.find((candidate) => candidate.key === key) ?? null;
}

/**
 * The recap candidates, in evaluation order. The first match that is worth saying wins, so the
 * band-driven arbitration decides between them by priority, not by list order.
 */
export function recapInsights(context: ContentContext): ContentInsight[] {
  const session = context.session;
  if (!session) return [];
  const baseline = context.personal.baseline;
  const insightFacts = facts(session, baseline);
  const insights: ContentInsight[] = [];
  const planned = session.intention?.planned_drinks ?? null;

  if (planned !== null && session.drink_count > planned) {
    insights.push(
      buildInsight({
        factKind: 'RECAP_OVER_PLAN',
        currentFact: { ...insightFacts, 'intention.planned_drinks': planned },
      }),
    );
  }

  const pace = tonightPace(session);
  if (
    baseline &&
    baseline.evidence_nights > 0 &&
    baseline.typical_pace_per_hour !== null &&
    pace !== null &&
    pace <= baseline.typical_pace_per_hour * 0.75
  ) {
    insights.push(
      buildInsight({
        factKind: 'RECAP_SLOWER_THAN_USUAL',
        personalized: true,
        currentFact: insightFacts,
        personalComparison: {
          metric: 'PACE',
          tonight: pace,
          baseline: baseline.typical_pace_per_hour,
          direction: 'STEADIER',
          evidence_nights: baseline.evidence_nights,
        },
        historicalEvidence: evidenceFromNights(baseline.evidence_nights, baseline.evidence_ids),
      }),
    );
  }

  const fastPattern = patternOf(context, 'FAST_NIGHT');
  if (fastPattern && fastPattern.nights >= 2 && session.fast_drink_count >= 2) {
    insights.push(
      buildInsight({
        factKind: 'RECAP_LOOKED_LIKE_LAST_FAST_NIGHT',
        personalized: true,
        currentFact: { ...insightFacts, 'pattern.nights': fastPattern.nights, 'pattern.key': 'FAST_NIGHT' },
        historicalEvidence: evidenceFromNights(fastPattern.nights, fastPattern.evidence_ids),
      }),
    );
  }

  const shapePattern = patternOf(context, 'SLOW_START_SHARP_LATER');
  if (shapePattern && shapePattern.nights >= MIN_STABLE_NIGHTS && secondHalfPickedUp(session)) {
    insights.push(
      buildInsight({
        factKind: 'RECAP_PERSONAL_PATTERN',
        personalized: true,
        currentFact: { ...insightFacts, 'pattern.nights': shapePattern.nights, 'pattern.key': 'SLOW_START_SHARP_LATER' },
        historicalEvidence: evidenceFromNights(shapePattern.nights, shapePattern.evidence_ids),
      }),
    );
  }

  if (session.drink_count >= 2) {
    insights.push(buildInsight({ factKind: 'RECAP_STEADY', currentFact: insightFacts }));
  } else {
    insights.push(buildInsight({ factKind: 'RECAP_NOTHING_NOTABLE', currentFact: insightFacts }));
  }
  return insights;
}

/**
 * The one recap pipeline. Both end-of-night events enter here; the event only travels with the
 * decision as context, so an automatic ending can never produce a different personality story than
 * a manual one about the same night.
 */
export function endNightInsights(context: ContentContext): ContentInsight[] {
  return isSessionEndEvent(context.event) ? recapInsights(context) : [];
}

/** Metadata for the recap, recorded but never treated as an observation about the user. */
export function endNightMetadata(session: SessionContext | null): { end_reason: string; ended_at: string | null } {
  return { end_reason: session?.end_reason ?? 'UNKNOWN', ended_at: session?.ended_at ?? null };
}
