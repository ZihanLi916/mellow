import type { AlphaSnapshot, Report } from '../alpha/contracts';
import type { TonightSession } from '../consumer/contracts';
import { buildPersonalDrinkingProfile, type ModelMaturity, type PersonalDrinkingProfile } from '../entitlement';
import { states as SUBJECTIVE_STATES, type SubjectiveState } from '../lib/schemas';
import {
  FAST_GAP_MINUTES,
  type ContentCapabilityPort,
  type ContentContext,
  type ContentDecision,
  type ContentEvent,
  type DrinkFact,
  type FoodContext,
  type HistoricalSessionSummary,
  type Intention,
  type NextDayOutcome,
  type OutcomePrediction,
  type PersonalContext,
  type SessionContext,
  type StateReport,
} from './contracts';
import { baselineFrom, foodFromProduct, historicalSummaries, patternsFrom } from './history';
import { observe } from './shouldSpeak';

/**
 * Adapters from the canonical domain objects into the content engine's context.
 *
 * This is the only place where Mellow's stored data meets the engine, and it only ever *reads*: the
 * consumer session lifecycle, the alpha snapshot and the personal drinking profile keep their
 * current shape and behaviour.
 */

export type StateReportSource = { level: number; observedAt: string };

export type SessionExtras = {
  context?: string | null;
  food?: FoodContext;
  waterCount?: number;
  waterTimestamps?: readonly string[];
  intention?: Intention | null;
  drivingDeclared?: boolean;
  reports?: readonly StateReportSource[];
  /** Reference instant for an open night, so elapsed time is a fact rather than a reading of the clock. */
  now?: string;
};

function minutesBetween(from: string, to: string): number {
  const start = Date.parse(from);
  const end = Date.parse(to);
  return Number.isFinite(start) && Number.isFinite(end) ? (end - start) / 60_000 : 0;
}

function medianOf(values: readonly number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Level 0..4 on the product's own subjective-state scale. Never a clinical label. */
export function subjectiveStateForLevel(level: number): SubjectiveState {
  const index = Math.max(0, Math.min(SUBJECTIVE_STATES.length - 1, Math.round(level)));
  return SUBJECTIVE_STATES[index];
}

function drinkFact(drink: TonightSession['drinks'][number], startedAt: string, fast: boolean): DrinkFact {
  return {
    id: drink.id,
    label: drink.label,
    category: drink.category,
    abv_percent: drink.abvPercent,
    confirmed_at: drink.confirmedAt,
    minutes_from_start: minutesBetween(startedAt, drink.confirmedAt),
    corrected: drink.identitySource === 'USER_CORRECTED',
    recognition_confidence: drink.identityEvidence?.confidence ?? null,
    fast,
  };
}

/**
 * The tonight context of one real session. Every field is either stored or absent; a missing fact
 * stays `null` and no default is invented for it.
 */
export function sessionContextFromTonightSession(session: TonightSession, extras: SessionExtras = {}): SessionContext {
  const drinks = [...session.drinks].sort((a, b) => Date.parse(a.confirmedAt) - Date.parse(b.confirmedAt));
  const facts: DrinkFact[] = [];
  for (const [index, drink] of drinks.entries()) {
    const gap = index === 0 ? null : minutesBetween(drinks[index - 1].confirmedAt, drink.confirmedAt);
    facts.push(drinkFact(drink, session.startedAt, gap !== null && gap <= FAST_GAP_MINUTES));
  }
  const gaps = facts.slice(1).map((drink, index) => minutesBetween(facts[index].confirmed_at, drink.confirmed_at));
  const waterTimestamps = [...(extras.waterTimestamps ?? [])].sort((a, b) => Date.parse(a) - Date.parse(b));
  const firstWaterAt = waterTimestamps[0] ?? null;
  const reports = [...(extras.reports ?? [])].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const toReport = (source: StateReportSource): StateReport => ({
    level: source.level,
    state: subjectiveStateForLevel(source.level),
    at: source.observedAt,
    minutes_from_start: minutesBetween(session.startedAt, source.observedAt),
  });
  const latest = reports.at(-1);
  const earlier = reports.length >= 2 ? reports[reports.length - 2] : undefined;
  const fallback = session.reportedState
    ? toReport({ level: session.reportedState.level, observedAt: session.reportedState.reportedAt })
    : null;
  const end = session.endedAt ? Date.parse(session.endedAt) : extras.now ? Date.parse(extras.now) : Date.now();
  const half = (Date.parse(session.startedAt) + end) / 2;
  const abvs = facts.map((drink) => drink.abv_percent);
  const current = latest ? toReport(latest) : fallback;
  return {
    session_id: session.id,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    end_reason: session.endedReason,
    context: extras.context ?? null,
    intention: extras.intention ?? null,
    drink_count: facts.length,
    drink_times: facts.map((drink) => drink.confirmed_at),
    last_gap_minutes: gaps.length ? gaps[gaps.length - 1] : null,
    previous_gap_minutes: gaps.length >= 2 ? gaps[gaps.length - 2] : null,
    median_gap_minutes: medianOf(gaps),
    session_minutes: Math.max(0, (end - Date.parse(session.startedAt)) / 60_000),
    minutes_to_reported_state: current?.minutes_from_start ?? null,
    fast_drinks_before_water: firstWaterAt
      ? facts.filter((drink) => drink.fast && Date.parse(drink.confirmed_at) < Date.parse(firstWaterAt)).length
      : 0,
    fast_drink_count: facts.filter((drink) => drink.fast).length,
    water_count: extras.waterCount ?? waterTimestamps.length,
    food: extras.food ?? 'UNKNOWN',
    reported_state: current,
    previous_state: earlier ? toReport(earlier) : null,
    first_drink: facts[0] ?? null,
    last_drink: facts.at(-1) ?? null,
    strongest_abv_percent: abvs.length && abvs.every((value) => value !== null) ? Math.max(...(abvs as number[])) : null,
    all_strengths_known: abvs.length > 0 && abvs.every((value) => value !== null),
    first_half_drinks: facts.filter((drink) => Date.parse(drink.confirmed_at) < half).length,
    second_half_drinks: facts.filter((drink) => Date.parse(drink.confirmed_at) >= half).length,
    driving_declared: extras.drivingDeclared ?? false,
  };
}

/* ------------------------------------------------------------------------------------------------
 * Alpha snapshot adapters.
 * ---------------------------------------------------------------------------------------------- */

export type WaterFacts = { count: number; timestamps: string[] };

export function waterFacts(snapshot: AlphaSnapshot): Map<string, WaterFacts> {
  const map = new Map<string, WaterFacts>();
  for (const [sessionId, night] of Object.entries(snapshot.product?.nights ?? {})) {
    map.set(sessionId, { count: night.water.length, timestamps: night.water.map((entry) => entry.timestamp) });
  }
  return map;
}

/** In-night state reports for one session, oldest first. */
export function reportsForSession(reports: readonly Report[], sessionId: string): StateReportSource[] {
  return reports
    .filter((report) => report.sessionId === sessionId && report.kind === 'DURING_NIGHT')
    .map((report) => ({ level: report.level, observedAt: report.observedAt }))
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
}

/**
 * The one next-day field the product already records: the retrospective self-report at the end of a
 * night becomes `felt_intoxication`. Every other answer is genuinely optional and stays absent.
 */
export function outcomeFromReports(reports: readonly Report[], sessionId: string): NextDayOutcome | null {
  const retrospective = [...reports]
    .filter((report) => report.sessionId === sessionId && report.kind === 'RETROSPECTIVE')
    .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))[0];
  if (!retrospective) return null;
  return {
    session_id: sessionId,
    felt_intoxication: retrospective.level,
    hangover: null,
    sleep_quality: null,
    memory_quality: null,
    mood: null,
    overall_morning: null,
    source: 'USER_SELF_REPORT',
    recorded_at: retrospective.recordedAt,
  };
}

export function sessionContextFromSnapshot(
  snapshot: AlphaSnapshot,
  session: TonightSession,
  extras: SessionExtras = {},
): SessionContext {
  const water = waterFacts(snapshot).get(session.id);
  const night = snapshot.product?.nights[session.id];
  return sessionContextFromTonightSession(session, {
    context: extras.context ?? night?.context ?? null,
    food: extras.food ?? foodFromProduct(night?.food),
    waterCount: extras.waterCount ?? water?.count ?? 0,
    waterTimestamps: extras.waterTimestamps ?? water?.timestamps ?? [],
    reports: extras.reports ?? reportsForSession(snapshot.reports, session.id),
    intention: extras.intention ?? null,
    drivingDeclared: extras.drivingDeclared ?? false,
  });
}

/** History from the stored snapshot: ended nights, their water, their food and their outcome. */
export function historyFromSnapshot(
  snapshot: AlphaSnapshot,
  options: { outcomes?: ReadonlyMap<string, NextDayOutcome> } = {},
): HistoricalSessionSummary[] {
  const water = waterFacts(snapshot);
  const inputs = snapshot.consumer.sessions
    .filter((session) => !snapshot.quarantinedSessions.includes(session.id))
    .map((session) => {
      const night = snapshot.product?.nights[session.id];
      const reports = reportsForSession(snapshot.reports, session.id);
      const buzz = reports.find((report) => report.level >= 2) ?? null;
      return {
        session,
        water: { count: water.get(session.id)?.count ?? 0 },
        outcome: options.outcomes?.get(session.id) ?? outcomeFromReports(snapshot.reports, session.id),
        food: foodFromProduct(night?.food),
        buzzAt: buzz?.observedAt ?? null,
      };
    });
  return historicalSummaries(inputs);
}

/**
 * The personal context, built from the canonical profile so maturity, familiarity and the reserved
 * confidence slot all come from the entitlement layer's own definition, and nothing is invented.
 */
export function personalContextFromProfile(
  profile: PersonalDrinkingProfile,
  input: { sessions?: readonly HistoricalSessionSummary[]; evidenceNights?: number } = {},
): PersonalContext {
  const sessions = [...(input.sessions ?? [])];
  const evidenceIds = profile.sessionEvidenceIds.length
    ? profile.sessionEvidenceIds
    : sessions.map((session) => session.session_id);
  return {
    familiarity: profile.familiarity,
    model_maturity: profile.modelMaturity as ModelMaturity,
    model_confidence: profile.personalModelConfidence,
    historical_nights: input.evidenceNights ?? Math.max(profile.sessionEvidenceIds.length, sessions.length),
    baseline: baselineFrom(sessions, evidenceIds),
    patterns: patternsFrom(sessions),
    sessions,
  };
}

export type SnapshotContextInput = {
  snapshot: AlphaSnapshot;
  event: ContentEvent;
  capability: ContentCapabilityPort;
  sessionId?: string | null;
  session?: TonightSession | null;
  extras?: SessionExtras;
  familiarity?: number;
  modelMaturity?: ModelMaturity | null;
  evidenceNights?: number;
  outcome?: NextDayOutcome | null;
  prediction?: OutcomePrediction | null;
  /** Morning answers recorded for earlier nights. They feed patterns, never a single night's claim. */
  historyOutcomes?: ReadonlyMap<string, NextDayOutcome>;
  variantSeed?: number;
  now?: string;
};

/** The minimum read-only interface the product shell needs in order to ask the engine anything. */
export function contentContextFromSnapshot(input: SnapshotContextInput): ContentContext {
  const now = input.now ?? new Date().toISOString();
  const sessions = input.snapshot.consumer.sessions;
  const target =
    input.session ??
    (input.sessionId ? sessions.find((session) => session.id === input.sessionId) ?? null : null) ??
    sessions.find((session) => session.id === input.snapshot.consumer.activeSessionId) ??
    null;
  const history = historyFromSnapshot(input.snapshot, { outcomes: input.historyOutcomes });
  const profile = buildPersonalDrinkingProfile({
    sessions: sessions.map((session) => ({
      id: session.id,
      endedAt: session.endedAt,
      drinkCount: session.drinks.length,
      evidenceEligible: !input.snapshot.quarantinedSessions.includes(session.id),
    })),
    familiarity: input.familiarity ?? 0,
    asOf: now,
    modelMaturity: input.modelMaturity ?? null,
  });
  const outcome = input.outcome ?? (target ? outcomeFromReports(input.snapshot.reports, target.id) : null) ?? null;
  return {
    event: input.event,
    now,
    session: target ? sessionContextFromSnapshot(input.snapshot, target, input.extras ?? {}) : null,
    personal: personalContextFromProfile(profile, { sessions: history, evidenceNights: input.evidenceNights }),
    capability: input.capability,
    followup: { outcome, prediction: input.prediction ?? null },
    variant_seed: input.variantSeed ?? 0,
  };
}

/**
 * Read-only projection of a finished night's recap.
 *
 * Both endings arrive here — a manual End Night and an inactivity expiry differ only by the
 * session's own `endedReason` — and the engine decides what, if anything, is worth saying.
 */
export function projectEndNightRecap(
  snapshot: AlphaSnapshot,
  sessionId: string,
  capability: ContentCapabilityPort,
  options: Omit<SnapshotContextInput, 'snapshot' | 'event' | 'capability' | 'sessionId'> = {},
): ContentDecision | null {
  const session = snapshot.consumer.sessions.find((candidate) => candidate.id === sessionId);
  if (!session || session.endedAt === null || session.endedReason === null) return null;
  return observe(
    contentContextFromSnapshot({
      ...options,
      snapshot,
      sessionId,
      session,
      capability,
      event: session.endedReason === 'MANUAL' ? 'SESSION_ENDED_MANUAL' : 'SESSION_ENDED_AUTO_INACTIVITY',
    }),
  );
}

