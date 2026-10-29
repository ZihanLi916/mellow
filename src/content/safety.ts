import {
  RAPID_WINDOW,
  type ContentInsight,
  type FactValue,
  type SafetyLevel,
  type SessionContext,
  strongerSafety,
} from './contracts';
import { buildInsight } from './insight';

/**
 * Safety (spec §19). Safety is evaluated from timestamps and user declarations only, it is never
 * gated by a plan, and it always outranks every other reason to speak.
 *
 * The thresholds are deliberately stated as *confirmed drinks inside a real time window*, not as an
 * opinion about the night:
 *
 * - four drinks inside two hours            → ELEVATED, "pause here"
 * - five inside two hours, or four in one   → HIGH, the direct line
 * - six inside two hours, or a very heavy self-report → CRITICAL
 * - a declared drive after drinking         → CRITICAL
 *
 * Safe pacing is silent. Silence is not a safety claim of any kind.
 */

/** Largest number of confirmed drinks inside any trailing window of `minutes`. */
export function maxDrinksWithin(drinkTimes: readonly string[], minutes: number): number {
  const times = drinkTimes
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  let best = 0;
  for (let end = 0; end < times.length; end += 1) {
    let start = end;
    while (start > 0 && times[end] - times[start - 1] <= minutes * 60_000) start -= 1;
    best = Math.max(best, end - start + 1);
  }
  return best;
}

export type SafetyAssessment = {
  level: SafetyLevel;
  max_within_60: number;
  max_within_120: number;
  severe_state: boolean;
  driving_declared: boolean;
  facts: Record<string, FactValue>;
};

const NORMAL_ASSESSMENT: SafetyAssessment = {
  level: 'NORMAL',
  max_within_60: 0,
  max_within_120: 0,
  severe_state: false,
  driving_declared: false,
  facts: {},
};

export function assessSafety(session: SessionContext | null): SafetyAssessment {
  if (!session) return NORMAL_ASSESSMENT;
  const maxWithin60 = maxDrinksWithin(session.drink_times, RAPID_WINDOW.HIGH_MINUTES_FAST);
  const maxWithin120 = maxDrinksWithin(session.drink_times, RAPID_WINDOW.HIGH_MINUTES);
  const severeState = (session.reported_state?.level ?? 0) >= 4;
  const drivingDeclared = session.driving_declared && session.drink_count >= 1;
  const facts: Record<string, FactValue> = {
    'safety.max_within_120': maxWithin120,
    'safety.max_within_60': maxWithin60,
    'safety.drinks': session.drink_count,
  };
  let level: SafetyLevel = 'NORMAL';
  if (maxWithin120 >= RAPID_WINDOW.HIGH_DRINKS || maxWithin60 >= RAPID_WINDOW.HIGH_DRINKS_FAST) {
    level = strongerSafety(level, 'HIGH');
  } else if (maxWithin120 >= RAPID_WINDOW.ELEVATED_DRINKS) {
    level = strongerSafety(level, 'ELEVATED');
  }
  if (maxWithin120 >= 6 || severeState) level = strongerSafety(level, 'CRITICAL');
  if (drivingDeclared) level = strongerSafety(level, 'CRITICAL');
  return { level, max_within_60: maxWithin60, max_within_120: maxWithin120, severe_state: severeState, driving_declared: drivingDeclared, facts };
}

/**
 * The P0 candidates. When more than one fires, the most severe wins: arbitration orders P0 by
 * severity before anything else, so a joke can never outrank a risk.
 */
export function safetyInsights(session: SessionContext | null, assessment: SafetyAssessment): ContentInsight[] {
  if (!session) return [];
  const insights: ContentInsight[] = [];
  if (assessment.driving_declared) {
    insights.push(
      buildInsight({
        factKind: 'SAFETY_DRIVING',
        safetyLevel: 'CRITICAL',
        currentFact: { ...assessment.facts, 'session.driving_declared': true },
      }),
    );
  }
  if (assessment.severe_state || assessment.max_within_120 >= 6) {
    insights.push(
      buildInsight({
        factKind: 'SAFETY_SEVERE_STATE',
        safetyLevel: 'CRITICAL',
        currentFact: {
          ...assessment.facts,
          'session.reported_state_level': session.reported_state?.level ?? null,
        },
      }),
    );
  }
  if (
    assessment.max_within_120 >= RAPID_WINDOW.HIGH_DRINKS ||
    assessment.max_within_60 >= RAPID_WINDOW.HIGH_DRINKS_FAST
  ) {
    insights.push(
      buildInsight({ factKind: 'SAFETY_RAPID_WINDOW_HIGH', safetyLevel: 'HIGH', currentFact: assessment.facts }),
    );
  } else if (assessment.max_within_120 >= RAPID_WINDOW.ELEVATED_DRINKS) {
    insights.push(
      buildInsight({
        factKind: 'SAFETY_RAPID_WINDOW_ELEVATED',
        safetyLevel: 'ELEVATED',
        currentFact: assessment.facts,
      }),
    );
  }
  return insights;
}

/** Safety silence is not a clearance. Nothing in the engine may ever say a night was safe. */
export const SAFETY_DISCLAIMER = 'Mellow never states that a night was safe, sober or fit to drive.';
