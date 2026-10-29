import { normalizeConfirmedIntake } from '../intake/confirmed';
import { parseConsumerBundle, parseConsumerState, ALLOWED_CONSUMER_GAMES, type ConsumerState, type TonightSession, type ConsumerCheck, type ConfirmedDrink } from './contracts';
import type { GameMeasurementBundle } from '../games/measurement/bridge';
import type { GameId } from '../games/core/contracts';
import { createRuntimeId } from '../runtime/runtimeId';
import { NIGHT_BOUNDARY_POLICY, occasionKey, sessionOccasionKey, validatedTimezoneOffsetMinutes } from './nightIdentity';
import {
  expireActiveSession,
  finalizeSession,
  markMeaningfulActivity,
  resolveActiveSession,
  type SessionEndReason,
} from './sessionLifecycle';

export function createConsumerState(): ConsumerState { return { schemaVersion: 1, revision: 0, activeSessionId: null, sessions: [] }; }
function active(state: ConsumerState): TonightSession {
  const session = state.sessions.find(s => s.id === state.activeSessionId);
  if (!session) throw new Error('NO_ACTIVE_SESSION');
  return session;
}
function replace(state: ConsumerState, session: TonightSession): ConsumerState {
  return parseConsumerState({ ...state, revision: state.revision + 1, sessions: state.sessions.map(s => s.id === session.id ? session : s) });
}
/** An explicit reopen restarts the inactivity window; an inactivity-finalized night is never reused. */
function reopen(session: TonightSession, now: Date, key: string, offset: number): TonightSession {
  const stamp = now.toISOString();
  const activity = session.lastMeaningfulActivityAt;
  return {
    ...session,
    endedAt: null,
    status: 'ACTIVE',
    endedReason: null,
    occasionKey: key,
    timezoneOffsetMinutes: offset,
    boundaryPolicy: NIGHT_BOUNDARY_POLICY,
    lastMeaningfulActivityAt: activity && Date.parse(activity) > Date.parse(stamp) ? activity : stamp,
  };
}
export function ensureTonight(value: ConsumerState, now = new Date(), id = createRuntimeId(), timezoneOffsetMinutes?:number): ConsumerState {
  // Deterministic expiry before resolving the active night: an over-window session is finalized
  // first, so a new event can never continue a night the inactivity policy already closed.
  const state = expireActiveSession(parseConsumerState(value), now);
  const offset=validatedTimezoneOffsetMinutes(timezoneOffsetMinutes),key=occasionKey(now,offset);
  const current=state.sessions.find(s=>s.id===state.activeSessionId);
  if(current&&sessionOccasionKey(current,offset)===key)return state;
  const closedCurrent=current?{...current,endedAt:now.toISOString(),status:'ENDED' as const,endedReason:null,checks:current.checks.map(c=>c.status==='IN_PROGRESS'?{...c,status:'ABORTED' as const,completedAt:now.toISOString(),interruptionReason:'NIGHT_BOUNDARY'}:c)}:null;
  const sessions=state.sessions.map(s=>closedCurrent&&s.id===closedCurrent.id?closedCurrent:s);
  // A night that auto-ended must never be silently reopened: its history is final and further
  // drinking starts the next active night.
  const reusable=[...sessions].reverse().find(s=>sessionOccasionKey(s,offset)===key&&s.endedReason!=='AUTO_INACTIVITY');
  if(reusable)return parseConsumerState({...state,revision:state.revision+1,activeSessionId:reusable.id,sessions:sessions.map(s=>s.id===reusable.id?reopen(s,now,key,offset):s)});
  return parseConsumerState({ ...state, revision: state.revision + 1, activeSessionId: id, sessions: [...sessions, { id, startedAt: now.toISOString(), endedAt: null, status: 'ACTIVE' as const, endedReason: null, lastMeaningfulActivityAt: now.toISOString(), occasionKey:key, timezoneOffsetMinutes:offset, boundaryPolicy:NIGHT_BOUNDARY_POLICY, drinks: [], checks: [] }] });
}
export type ConfirmDrinkInput = Pick<ConfirmedDrink, 'id' | 'confirmedAt' | 'label' | 'category' | 'photoFingerprint' | 'sourcePhotoFingerprint' | 'identitySource' | 'recognitionVersion' | 'identityEvidence' | 'knowledgeDrinkId' | 'intakeReading' | 'normalizedIntake'> & {abvPercent?:number|null};
export function confirmDrink(value: ConsumerState, input: ConfirmDrinkInput): { state: ConsumerState; drink: ConfirmedDrink; duplicate: boolean } {
  const state = parseConsumerState(value), session = active(state);
  const sameId = state.sessions.flatMap(s => s.drinks).find(d => d.id === input.id);
  if (sameId && (sameId.photoFingerprint !== input.photoFingerprint || sameId.sessionId !== session.id)) throw new Error('DRINK_ID_CONFLICT');
  const source=input.sourcePhotoFingerprint??input.photoFingerprint;
  const existing = sameId ?? session.drinks.find(d => d.photoFingerprint === input.photoFingerprint||((d.sourcePhotoFingerprint??d.photoFingerprint)===source&&(input.photoFingerprint===source||d.photoFingerprint===source)));
  if (existing) return { state, drink: existing, duplicate: true };
  const drink: ConfirmedDrink = { ...input, ...(input.intakeReading?{intakeReading:normalizeConfirmedIntake(input.intakeReading,input.label.trim(),input.abvPercent??null)}:{}), label: input.label.trim(), sessionId: session.id, confidence: 'LOW', containerVolumeMl: null, abvPercent: input.abvPercent??null, consumption: { status: 'UNKNOWN', consumedVolumeMl: null } };
  // Confirming a drink is meaningful session activity: it advances the inactivity clock.
  return { state: markMeaningfulActivity(replace(state, { ...session, drinks: [...session.drinks, drink] }), session.id, input.confirmedAt), drink, duplicate: false };
}
export function reportTonightState(value:ConsumerState,level:number,now=new Date()):ConsumerState {
  const state=ensureTonight(value,now),session=active(state);
  // A subjective state report is meaningful session activity.
  return markMeaningfulActivity(replace(state,{...session,reportedState:{level,reportedAt:now.toISOString()}}),session.id,now.toISOString());
}
export function startConsumerCheck(value: ConsumerState, input: { id: string; startedAt: string; gameOrder?: GameId[] }): { state: ConsumerState; check: ConsumerCheck } {
  const state = parseConsumerState(value), session = active(state);
  if (session.checks.some(c => c.status === 'IN_PROGRESS')) throw new Error('CHECK_ALREADY_IN_PROGRESS');
  const gameOrder = input.gameOrder ?? ['MELLOW_MIX', 'OPPOSITE_CAT'];
  if (!gameOrder.every(g => (ALLOWED_CONSUMER_GAMES as readonly GameId[]).includes(g))) throw new Error('GAME_NOT_ALLOWED');
  const check: ConsumerCheck = { ...input, gameOrder: gameOrder.filter((g): g is ConsumerCheck['gameOrder'][number] => (ALLOWED_CONSUMER_GAMES as readonly GameId[]).includes(g)), sessionId: session.id, status: 'IN_PROGRESS', completedAt: null, bundles: [] };
  return { state: replace(state, { ...session, checks: [...session.checks, check] }), check };
}
export function appendConsumerBundle(value: ConsumerState, checkId: string, input: GameMeasurementBundle<object, object>, now = new Date()): ConsumerState {
  const state = parseConsumerState(value), session = active(state), bundle = parseConsumerBundle(input);
  const check = session.checks.find(c => c.id === checkId);
  if (!check) throw new Error('CHECK_NOT_FOUND');
  const existing = state.sessions.flatMap(s => s.checks).flatMap(c => c.bundles.map(b => ({ checkId: c.id, bundle: b }))).find(x => x.bundle.sessionId === bundle.sessionId);
  if (existing) {
    if (existing.checkId === checkId && JSON.stringify(existing.bundle) === JSON.stringify(bundle)) return state;
    throw new Error('BUNDLE_ID_CONFLICT');
  }
  if (check.status !== 'IN_PROGRESS') throw new Error('CHECK_NOT_IN_PROGRESS');
  if (check.gameOrder[check.bundles.length] !== bundle.gameResult.gameId) throw new Error('BUNDLE_ORDER_MISMATCH');
  const bundles = [...check.bundles, bundle];
  const sensor = bundle.measurementContext.sensor;
  const invalidSensor = bundle.gameResult.gameId === 'DONT_SPILL' && !(sensor.requested && sensor.available === true && sensor.permission === 'GRANTED' && sensor.sampleRateHz !== null && sensor.sampleRateHz >= 20 && bundle.measurementContext.inputModalities.includes('DEVICE_ORIENTATION'));
  const invalid = !bundle.gameResult.valid || !bundle.gameResult.trials.length || invalidSensor;
  const status = invalid ? 'ABORTED' : bundles.length === check.gameOrder.length ? 'COMPLETED' : 'IN_PROGRESS';
  const next: ConsumerCheck = { ...check, bundles, status, completedAt: status === 'IN_PROGRESS' ? null : now.toISOString(), ...(invalid ? { interruptionReason: 'INVALID_GAME_RESULT' } : {}) };
  return replace(state, { ...session, checks: session.checks.map(c => c.id === checkId ? next : c) });
}
export function abortConsumerCheck(value: ConsumerState, checkId: string, reason: string, now = new Date()): ConsumerState {
  const state = parseConsumerState(value), session = active(state), check = session.checks.find(c => c.id === checkId);
  if (!check) throw new Error('CHECK_NOT_FOUND');
  if (check.status !== 'IN_PROGRESS') return state;
  return replace(state, { ...session, checks: session.checks.map(c => c.id === checkId ? { ...c, status: 'ABORTED', completedAt: now.toISOString(), interruptionReason: reason } : c) });
}
export function recoverInterruptedChecks(value: ConsumerState, now = new Date()): ConsumerState {
  const state = parseConsumerState(value);
  if (!state.sessions.some(s => s.checks.some(c => c.status === 'IN_PROGRESS'))) return state;
  return parseConsumerState({ ...state, revision: state.revision + 1, sessions: state.sessions.map(s => ({ ...s, checks: s.checks.map(c => c.status === 'IN_PROGRESS' ? { ...c, status: 'ABORTED', completedAt: now.toISOString(), interruptionReason: 'RECOVERY' } : c) })) });
}
/**
 * Ends the active night through the one canonical finalization pipeline.
 *
 * The deterministic inactivity check runs first, so an End Night pressed after the window already
 * closed records `AUTO_INACTIVITY` with the cutoff timestamp instead of relabelling it `MANUAL`.
 *
 * Idempotent: with no active session it returns the same state, and a second call after an ending
 * (manual or automatic) is a no-op instead of creating a duplicate recap or evidence.
 */
export function endTonight(value: ConsumerState, now = new Date(), reason: SessionEndReason = 'MANUAL'): ConsumerState {
  const state = expireActiveSession(parseConsumerState(value), now);
  if (!state.activeSessionId) return state;
  return parseConsumerState(finalizeSession(state, state.activeSessionId, reason, now));
}

/**
 * Deterministic inactivity check for any boundary (startup, resume, fetch, before a new event).
 * Returns the identical state when nothing expired.
 */
export function expireSessionInactivity(value: ConsumerState, now = new Date()): ConsumerState {
  return expireActiveSession(parseConsumerState(value), now);
}

/** The currently active night, or null once it has been ended or has exceeded the threshold. */
export function currentActiveSession(value: ConsumerState, now = new Date()): TonightSession | null {
  return resolveActiveSession(parseConsumerState(value), now);
}
