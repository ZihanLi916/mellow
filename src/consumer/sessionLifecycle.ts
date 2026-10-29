import type { ConsumerState, TonightSession } from './contracts';

/**
 * Session / night lifecycle.
 *
 * One night is a `TonightSession`. It is `ACTIVE` while `endedAt === null` and `ENDED` afterwards.
 * This module owns every transition, so manual ending and inactivity expiry share one pipeline and
 * can never drift apart.
 *
 * `endedReason` is `MANUAL` for an explicit End Night and `AUTO_INACTIVITY` for the deterministic
 * inactivity timeout. `null` is reserved for records that ended before this lifecycle existed or
 * that were closed by the local-06:00 night boundary; those are neither a user action nor an
 * inactivity timeout, and inventing a reason for them would be dishonest.
 */

/**
 * Inactivity threshold. The only definition of the two-hour window in the codebase; nothing else
 * may hard-code `2 * 60 * 60 * 1000` or a millisecond literal for it.
 */
export const AUTO_END_INACTIVITY_MS = 2 * 60 * 60 * 1000;

export const SESSION_STATUSES = ['ACTIVE', 'ENDED'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const SESSION_END_REASONS = ['MANUAL', 'AUTO_INACTIVITY'] as const;
export type SessionEndReason = (typeof SESSION_END_REASONS)[number];

export function isSessionActive(session: TonightSession): boolean {
  return session.endedAt === null;
}

/**
 * The instant inactivity is measured from.
 *
 * New sessions always carry an explicit `lastMeaningfulActivityAt`. Records written before this
 * field existed fall back to the newest explicit input the session already owns (its own start,
 * its confirmed drinks, its reported feeling) instead of inventing a timestamp.
 */
export function lastMeaningfulActivityAt(session: TonightSession): string {
  if (session.lastMeaningfulActivityAt) return session.lastMeaningfulActivityAt;
  const candidates = [session.startedAt, ...session.drinks.map((drink) => drink.confirmedAt)];
  if (session.reportedState) candidates.push(session.reportedState.reportedAt);
  return candidates.reduce(
    (latest, value) => (Date.parse(value) > Date.parse(latest) ? value : latest),
    session.startedAt,
  );
}

/** Deterministic moment an inactive night is considered over: activity + threshold. */
export function inactivityCutoff(session: TonightSession): number {
  return Date.parse(lastMeaningfulActivityAt(session)) + AUTO_END_INACTIVITY_MS;
}

export function hasExceededInactivity(session: TonightSession, now: Date): boolean {
  if (!isSessionActive(session)) return false;
  const activity = Date.parse(lastMeaningfulActivityAt(session));
  if (!Number.isFinite(activity)) return false;
  return now.getTime() - activity >= AUTO_END_INACTIVITY_MS;
}

/**
 * Records a meaningful session action. Only genuine drinking-session input may call this: adding,
 * editing or deleting a drink, logging water or food, or reporting a subjective state. Opening the
 * app, viewing Home, changing tabs, reading history, opening settings, polling or a background
 * refresh must never call it, so passive use cannot postpone the timeout.
 */
export function markMeaningfulActivity(
  state: ConsumerState,
  sessionId: string,
  at: string,
): ConsumerState {
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (!session || !isSessionActive(session)) return state;
  const recorded = session.lastMeaningfulActivityAt;
  if (recorded && Date.parse(recorded) >= Date.parse(at)) return state;
  return {
    ...state,
    sessions: state.sessions.map((candidate) =>
      candidate.id === sessionId ? { ...candidate, lastMeaningfulActivityAt: at } : candidate,
    ),
  };
}

/**
 * The stored `endedAt` for a finalization.
 *
 * `AUTO_INACTIVITY` uses the stable cutoff `lastMeaningfulActivityAt + AUTO_END_INACTIVITY_MS` so
 * a night never reports a duration that depends on when the user happened to reopen the app.
 * `MANUAL` uses the closing moment, never earlier than the session's own last meaningful input.
 */
export function endedAtForSessionEnd(
  session: TonightSession,
  reason: SessionEndReason,
  now: Date,
): string {
  const started = Date.parse(session.startedAt);
  if (reason === 'AUTO_INACTIVITY') {
    const cutoff = inactivityCutoff(session);
    return new Date(
      Math.max(started, Number.isFinite(cutoff) ? cutoff : now.getTime()),
    ).toISOString();
  }
  const activity = Date.parse(lastMeaningfulActivityAt(session));
  const closing = Number.isFinite(activity) ? Math.max(now.getTime(), activity) : now.getTime();
  return new Date(Math.max(started, closing)).toISOString();
}

/**
 * The single finalization pipeline for manual and automatic endings.
 *
 * Idempotent by construction: calling it on an already-ended session returns the identical state,
 * so repeated expiry checks, refetches or confirmation taps cannot duplicate a recap, double-count
 * a drink or emit model evidence twice.
 */
export function finalizeSession(
  state: ConsumerState,
  sessionId: string,
  reason: SessionEndReason,
  now: Date,
): ConsumerState {
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (!isSessionActive(session)) return state;
  const endedAt = endedAtForSessionEnd(session, reason, now);
  const finalized: TonightSession = {
    ...session,
    endedAt,
    status: 'ENDED',
    endedReason: reason,
    checks: session.checks.map((check) =>
      check.status !== 'IN_PROGRESS'
        ? check
        : {
            ...check,
            status: 'ABORTED' as const,
            // An interrupted check cannot be recorded as completing before it started.
            completedAt:
              Date.parse(endedAt) > Date.parse(check.startedAt) ? endedAt : check.startedAt,
            interruptionReason: 'SESSION_ENDED',
          },
    ),
  };
  return {
    ...state,
    revision: state.revision + 1,
    activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
    sessions: state.sessions.map((candidate) =>
      candidate.id === sessionId ? finalized : candidate,
    ),
  };
}

/**
 * Deterministic expiry check. Returns the identical state when nothing expired, so callers can use
 * reference equality to decide whether anything has to be persisted.
 */
export function expireActiveSession(state: ConsumerState, now: Date): ConsumerState {
  const activeId = state.activeSessionId;
  if (!activeId) return state;
  const session = state.sessions.find((candidate) => candidate.id === activeId);
  if (!session || !hasExceededInactivity(session, now)) return state;
  return finalizeSession(state, activeId, 'AUTO_INACTIVITY', now);
}

/**
 * Read-only resolution of the current active session. An expired night resolves to `null` before
 * anything is written, so a fetch can never present an over-window night as still live.
 */
export function resolveActiveSession(state: ConsumerState, now: Date): TonightSession | null {
  const activeId = state.activeSessionId;
  if (!activeId) return null;
  const session = state.sessions.find((candidate) => candidate.id === activeId);
  if (!session || !isSessionActive(session)) return null;
  return hasExceededInactivity(session, now) ? null : session;
}
