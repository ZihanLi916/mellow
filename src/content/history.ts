import type { TonightSession } from '../consumer/contracts';
import {
  type FoodContext,
  type HistoricalPattern,
  type HistoricalSessionSummary,
  type NextDayOutcome,
  type PatternKey,
  type PersonalBaselineFacts,
} from './contracts';

/**
 * History derivation.
 *
 * Patterns and the personal baseline are read off nights that were actually recorded. A night with
 * no stored local offset cannot make a claim about what time of day it was, a night without a
 * report cannot say when the person started to feel it, and a pattern with one night is reported as
 * one night — never as a habit.
 */

/** A night is fast when its pace or its median gap says so, from logged timestamps only. */
export const RAPID_PACE_PER_HOUR = 2.5;
export const RAPID_MEDIAN_GAP_MINUTES = 30;
/** An outcome-linked pattern needs at least this many nights behind it before it can be named. */
export const MIN_PATTERN_NIGHTS = 2;

export function foodFromProduct(food: string | null | undefined): FoodContext {
  if (food === 'Ate') return 'ATE';
  if (food === 'A little') return 'LITTLE';
  if (food === 'Not yet') return 'NOT_YET';
  return 'UNKNOWN';
}

export function median(values: readonly number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Local hour of an instant, using the session's own stored offset. `null` when there is none. */
export function localHour(at: string, timezoneOffsetMinutes: number | undefined): number | null {
  if (timezoneOffsetMinutes === undefined || !Number.isFinite(timezoneOffsetMinutes)) return null;
  const time = Date.parse(at);
  if (!Number.isFinite(time)) return null;
  const local = new Date(time + timezoneOffsetMinutes * 60_000);
  return local.getUTCHours();
}

export function isLateHour(hour: number | null): boolean {
  return hour !== null && (hour >= 22 || hour < 5);
}

export type SessionWater = { count: number };

export type SessionOutcome = Partial<
  Pick<NextDayOutcome, 'overall_morning' | 'hangover' | 'sleep_quality' | 'felt_intoxication'>
>;

/** Morning severity from the answers that exist. `null` means "not answered", never zero. */
export function morningSeverity(outcome: SessionOutcome | null): number | null {
  if (!outcome) return null;
  const values = [outcome.overall_morning, outcome.hangover].filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  return values.length ? Math.max(...values) : null;
}

export type SummaryInput = {
  session: TonightSession;
  water: SessionWater;
  outcome: SessionOutcome | null;
  /** From the night's own food answer; absent when the night recorded none. */
  food?: FoodContext;
  /** First in-night report at level 2 or above, when one was recorded. */
  buzzAt?: string | null;
};

/** One completed night reduced to the facts history is allowed to speak from. */
export function historicalSummary(input: SummaryInput): HistoricalSessionSummary {
  const { session, water, outcome } = input;
  const drinks = [...session.drinks].sort((a, b) => Date.parse(a.confirmedAt) - Date.parse(b.confirmedAt));
  const start = Date.parse(session.startedAt);
  const end = session.endedAt ? Date.parse(session.endedAt) : null;
  const gaps = drinks.slice(1).map((drink, index) => (Date.parse(drink.confirmedAt) - Date.parse(drinks[index].confirmedAt)) / 60_000);
  const duration = end !== null && Number.isFinite(start) ? Math.max(0, (end - start) / 3_600_000) : 0;
  const pace = duration > 0.25 ? drinks.length / duration : null;
  const medianGap = median(gaps);
  const fast =
    drinks.length >= 3 &&
    ((pace !== null && pace >= RAPID_PACE_PER_HOUR) || (medianGap !== null && medianGap <= RAPID_MEDIAN_GAP_MINUTES));
  const midday = end !== null ? (start + end) / 2 : start;
  const firstHalf = drinks.filter((drink) => Date.parse(drink.confirmedAt) < midday).length;
  const secondHalf = drinks.length - firstHalf;
  const offset = session.timezoneOffsetMinutes;
  const late = drinks.some(
    (drink) => drink.category === 'COCKTAIL' && isLateHour(localHour(drink.confirmedAt, offset)),
  );
  const buzzReport = input.buzzAt !== undefined
    ? input.buzzAt
    : session.reportedState && session.reportedState.level >= 2
      ? session.reportedState.reportedAt
      : null;
  return {
    session_id: session.id,
    started_at: session.startedAt,
    ended_at: session.endedAt ?? session.startedAt,
    end_reason: session.endedReason,
    drink_count: drinks.length,
    pace_per_hour: pace,
    median_gap_minutes: medianGap,
    food: input.food ?? 'UNKNOWN',
    water_count: water.count,
    late,
    fast,
    second_half_heavier: secondHalf >= firstHalf + 2,
    minutes_to_buzz: buzzReport ? (Date.parse(buzzReport) - start) / 60_000 : null,
    felt_level: outcome?.felt_intoxication ?? null,
    morning: outcome?.overall_morning ?? null,
    hangover: outcome?.hangover ?? null,
    sleep_quality: outcome?.sleep_quality ?? null,
  };
}

/** Only nights that genuinely ended count as history. An open night is not evidence yet. */
export function historicalSummaries(inputs: readonly SummaryInput[]): HistoricalSessionSummary[] {
  return inputs
    .filter((input) => input.session.endedAt !== null)
    .map(historicalSummary)
    .sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at) || a.session_id.localeCompare(b.session_id));
}

function outcomeOf(summaries: readonly HistoricalSessionSummary[]) {
  return summaries
    .map((summary) => morningSeverity({ overall_morning: summary.morning, hangover: summary.hangover }))
    .filter((value): value is number => value !== null);
}

function pattern(
  key: PatternKey,
  matches: readonly HistoricalSessionSummary[],
  total: number,
): HistoricalPattern | null {
  if (matches.length === 0) return null;
  const severities = outcomeOf(matches);
  return {
    key,
    nights: matches.length,
    total_nights: total,
    evidence_ids: matches.map((summary) => summary.session_id).sort(),
    last_at: matches.at(-1)?.ended_at ?? null,
    outcome: severities.length
      ? {
          nights_with_outcome: severities.length,
          heavier_mornings: severities.filter((value) => value >= 2).length,
          milder_mornings: severities.filter((value) => value <= 1).length,
        }
      : null,
  };
}

/** Every pattern the recorded nights actually support. A shape with one night is still one night. */
export function patternsFrom(summaries: readonly HistoricalSessionSummary[]): HistoricalPattern[] {
  const total = summaries.length;
  const candidates: Array<[PatternKey, HistoricalSessionSummary[]]> = [
    ['FAST_NIGHT', summaries.filter((summary) => summary.fast)],
    ['EMPTY_STOMACH_FAST_PACE', summaries.filter((summary) => summary.fast && summary.food === 'NOT_YET')],
    ['FOOD_BEFORE_DRINKS', summaries.filter((summary) => summary.food === 'ATE' || summary.food === 'LITTLE')],
    ['LATE_COCKTAILS', summaries.filter((summary) => summary.late)],
    ['SLOW_START_SHARP_LATER', summaries.filter((summary) => summary.second_half_heavier)],
  ];
  return candidates
    .map(([key, matches]) => pattern(key, matches, total))
    .filter((value): value is HistoricalPattern => value !== null);
}

/**
 * The personal baseline, derived only from nights that carry the relevant fact. When fewer than two
 * nights support a field it stays `null`: a single night is not a baseline.
 */
export function baselineFrom(summaries: readonly HistoricalSessionSummary[], evidenceIds: readonly string[]): PersonalBaselineFacts | null {
  const paced = summaries.filter((summary) => summary.pace_per_hour !== null && summary.drink_count >= 2);
  const buzzed = summaries.filter((summary) => summary.minutes_to_buzz !== null);
  const nights = summaries.filter((summary) => summary.drink_count >= 1);
  if (paced.length < 2 && buzzed.length < 2 && nights.length < 2) return null;
  return {
    typical_buzz_onset_minutes: buzzed.length >= 2 ? median(buzzed.map((summary) => summary.minutes_to_buzz as number)) : null,
    typical_drink_count_at_buzz: buzzed.length >= 2 ? median(buzzed.map((summary) => summary.drink_count)) : null,
    typical_pace_per_hour: paced.length >= 2 ? median(paced.map((summary) => summary.pace_per_hour as number)) : null,
    typical_night_drinks: nights.length >= 2 ? median(nights.map((summary) => summary.drink_count)) : null,
    evidence_nights: nights.length,
    evidence_ids: [...new Set(evidenceIds.length ? evidenceIds : nights.map((summary) => summary.session_id))].sort(),
  };
}
