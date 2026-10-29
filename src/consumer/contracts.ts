import {normalizedIntakeSchema} from '../intake/normalized';
import {confirmedIntakeSchema} from '../intake/worldContract';
import { z } from 'zod';
import { validateMeasurementBundle, type GameMeasurementBundle } from '../games/measurement/bridge';
import type { JsonValue } from '../games/measurement/contracts';
import {printedAbvSchema} from './visionContract';
import { SESSION_END_REASONS, SESSION_STATUSES } from './sessionLifecycle';

export const MAX_SESSIONS = 100, MAX_DRINKS_PER_SESSION = 100, MAX_CHECKS_PER_SESSION = 50, MAX_GAMES_PER_CHECK = 3, MAX_BUNDLE_BYTES = 1_048_576;
export const ALLOWED_CONSUMER_GAMES = ['MELLOW_MIX', 'THREE_CARDS', 'OPPOSITE_CAT', 'PERFECT_POUR', 'DONT_SPILL', 'BLOW_BALL'] as const;
const id = z.string().min(1).max(200), date = z.string().datetime(), n = z.number().finite().nonnegative();
const game = z.enum(ALLOWED_CONSUMER_GAMES);
const protocol = z.enum(['memory-v0', 'temporal-v0', 'motor-v0', 'mellow-mix-ingredients-v1','mellow-mix-visual-v2', 'three-cards-swap-v1','three-cards-symbols-v2', 'opposite-cat-swipe-v1','opposite-cat-swipe-only-v2', 'perfect-pour-flow-v1', 'blow-ball-landing-v1','blow-ball-flight-v2','dont-spill-neutral-v1']);
const json: z.ZodType<JsonValue> = z.lazy(() => z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(json), z.record(z.string(), json)]));
const domain = z.enum(['MEMORY', 'TEMPORAL', 'MOTOR']);
const context = z.object({
  contextVersion: z.literal('measurement-context-v1'), capturedAt: date, gameProtocolVersion: protocol,
  deviceClass: z.enum(['PHONE', 'TABLET', 'DESKTOP', 'UNKNOWN']), browserFamily: z.enum(['CHROMIUM', 'SAFARI', 'FIREFOX', 'OTHER', 'UNKNOWN']),
  viewport: z.object({ width: n, height: n, devicePixelRatio: n }),
  inputModalities: z.array(z.enum(['TOUCH', 'POINTER', 'KEYBOARD', 'DEVICE_ORIENTATION', 'UNKNOWN'])), pointerMode: z.enum(['COARSE', 'FINE', 'MIXED', 'UNKNOWN']), touchPoints: n,
  performance: z.object({ observedFrames: n, estimatedFps: n.nullable(), droppedFrameCount: n, droppedFrameRate: n.nullable() }),
  sensor: z.object({ requested: z.boolean(), available: z.boolean().nullable(), permission: z.enum(['GRANTED', 'DENIED', 'NOT_REQUESTED', 'UNKNOWN']), sampleRateHz: n.nullable() }),
  visibility: z.object({ interruptionCount: n, hiddenDurationMs: n }), runtimeErrorCodes: z.array(z.string()),
});
const bundleSchema = z.object({
  bundleVersion: z.literal('game-measurement-bundle-v1'), streamPolicyVersion: z.literal('raw-stream-v1'), sessionId: id,
  gameResult: z.object({ gameId: game, domain, protocolVersion: protocol, startedAt: date, completedAt: date, valid: z.boolean(), trials: z.array(z.record(z.string(), json)), summaryMetrics: z.record(z.string(), json) }),
  rawEvents: z.array(z.object({ eventId: id, sessionId: id, gameId: game, domain, protocolVersion: protocol, measurementVersion: z.literal('play-measurement-v1'), trialIndex: n.int(), sequence: n.int().positive(), occurredAt: date, monotonicTimeMs: n, lifecycleState: z.literal('ACTIVE'), eventType: id, payload: z.record(z.string(), json) })).max(2000),
  lifecycleByTrial: z.array(z.array(z.object({ state: z.enum(['ACTIVE', 'RESOLVED', 'FEEDBACK', 'NEXT_TRIAL']), monotonicTimeMs: n })).max(4)),
  measurementContext: context, familiarizationState: z.enum(['NEW', 'FAMILIARIZING', 'CALIBRATING', 'ESTABLISHED']), truncatedEventCount: n.int(),
});
const drinkSchema = z.object({
  id, sessionId: id, confirmedAt: date, label: z.string().trim().min(1).max(120), category: z.enum(['UNKNOWN', 'BEER', 'WINE', 'COCKTAIL', 'SPIRITS', 'OTHER']), confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  identitySource: z.enum(['USER_CONFIRMED', 'USER_CORRECTED']), recognitionVersion: id, photoFingerprint: id,sourcePhotoFingerprint:id.optional(),knowledgeDrinkId:id.optional(),
  identityEvidence: z.object({model:z.string().max(120),confidence:z.enum(['LOW','MEDIUM','HIGH']),visibleEvidence:z.array(z.string().max(160)).max(4),targetPosition:z.string().max(100),kind:z.enum(['DRINK','MENU_ITEM']).optional(),printedAbv:printedAbvSchema.nullable().optional()}).optional(),
  intakeReading: confirmedIntakeSchema.optional(), normalizedIntake: normalizedIntakeSchema.optional(),
  containerVolumeMl: z.null(), abvPercent: z.number().min(0).max(100).nullable(), consumption: z.object({ status: z.literal('UNKNOWN'), consumedVolumeMl: z.null() }),
});
const checkSchema = z.object({ id, sessionId: id, startedAt: date, completedAt: date.nullable(), status: z.enum(['IN_PROGRESS', 'COMPLETED', 'ABORTED']), gameOrder: z.array(game).min(1).max(MAX_GAMES_PER_CHECK), bundles: z.array(bundleSchema).max(MAX_GAMES_PER_CHECK), interruptionReason: z.string().max(200).optional() });
const sessionSchema = z.object({
  id, startedAt: date, endedAt: date.nullable(),
  occasionKey:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),timezoneOffsetMinutes:z.number().int().min(-840).max(840).optional(),boundaryPolicy:z.literal('local-0600-v1').optional(),
  // Explicit session lifecycle. Defaults keep snapshots written before this contract readable;
  // `endedAt` stays the storage truth and `parseConsumerState` derives the status from it on read.
  status:z.enum(SESSION_STATUSES).default('ACTIVE'),
  endedReason:z.enum(SESSION_END_REASONS).nullable().default(null),
  /** Advanced only by meaningful session actions, never by passive app usage. */
  lastMeaningfulActivityAt:date.nullable().default(null),
  drinks: z.array(drinkSchema).max(MAX_DRINKS_PER_SESSION), checks: z.array(checkSchema).max(MAX_CHECKS_PER_SESSION),reportedState:z.object({level:z.number().int().min(0).max(4),reportedAt:date}).optional() });
const stateSchema = z.object({ schemaVersion: z.literal(1), revision: n.int(), activeSessionId: id.nullable(), sessions: z.array(sessionSchema).max(MAX_SESSIONS) });
export type ConfirmedDrink = z.infer<typeof drinkSchema>;
export type ConsumerCheck = Omit<z.infer<typeof checkSchema>, 'bundles'> & { bundles: GameMeasurementBundle<object, object>[] };
export type TonightSession = Omit<z.infer<typeof sessionSchema>, 'checks'> & { checks: ConsumerCheck[] };
export type ConsumerState = Omit<z.infer<typeof stateSchema>, 'sessions'> & { sessions: TonightSession[] };

function requireCondition(condition: boolean, error: string): asserts condition { if (!condition) throw new Error(error); }
const domains = { MELLOW_MIX: 'MEMORY', THREE_CARDS: 'MEMORY', OPPOSITE_CAT: 'TEMPORAL', PERFECT_POUR: 'TEMPORAL', DONT_SPILL: 'MOTOR', BLOW_BALL: 'MOTOR' } as const;
const protocols = { MELLOW_MIX: ['memory-v0', 'mellow-mix-ingredients-v1','mellow-mix-visual-v2'], THREE_CARDS: ['memory-v0', 'three-cards-swap-v1','three-cards-symbols-v2'], OPPOSITE_CAT: ['temporal-v0', 'opposite-cat-swipe-v1','opposite-cat-swipe-only-v2'], PERFECT_POUR: ['temporal-v0', 'perfect-pour-flow-v1'], DONT_SPILL: ['motor-v0','dont-spill-neutral-v1'], BLOW_BALL: ['motor-v0', 'blow-ball-landing-v1','blow-ball-flight-v2'] };
export function parseConsumerBundle(value: unknown): GameMeasurementBundle<object, object> {
  requireCondition(new TextEncoder().encode(JSON.stringify(value)).length <= MAX_BUNDLE_BYTES, 'BUNDLE_TOO_LARGE');
  const b = bundleSchema.parse(value), r = b.gameResult;
  requireCondition(validateMeasurementBundle(b).length === 0, 'INVALID_BUNDLE');
  requireCondition(r.domain === domains[r.gameId] && protocols[r.gameId].includes(r.protocolVersion) && b.measurementContext.gameProtocolVersion === r.protocolVersion, 'BUNDLE_PROTOCOL_MISMATCH');
  requireCondition(Date.parse(r.completedAt) >= Date.parse(r.startedAt), 'INVALID_GAME_TIMES');
  let sequence = 0, previousTime = -1;
  for (const e of b.rawEvents) {
    const life = b.lifecycleByTrial[e.trialIndex], resolved = life?.find(t => t.state === 'RESOLVED');
    requireCondition(!!life && e.domain === r.domain && e.sequence > sequence && e.monotonicTimeMs >= previousTime && e.monotonicTimeMs >= life[0].monotonicTimeMs && (!resolved || e.monotonicTimeMs <= resolved.monotonicTimeMs), 'INVALID_RAW_EVENT');
    sequence = e.sequence; previousTime = e.monotonicTimeMs;
  }
  return b;
}
export function parseConsumerState(value: unknown): ConsumerState {
  const state = stateSchema.parse(value);
  const seen = new Set<string>();
  const unique = (value: string) => { requireCondition(!seen.has(value), 'DUPLICATE_ID'); seen.add(value); };
  for (const s of state.sessions) {
    // Lifecycle normalization. `endedAt` is the storage truth: a session is ENDED exactly when it
    // has an end timestamp, which keeps every snapshot written before this contract readable.
    s.status = s.endedAt === null ? 'ACTIVE' : 'ENDED';
    if (s.endedAt === null) s.endedReason = null;
    requireCondition(s.endedAt !== null || s.endedReason === null, 'INVALID_SESSION_LIFECYCLE');
    requireCondition(s.endedAt === null || Date.parse(s.endedAt) >= Date.parse(s.startedAt), 'INVALID_SESSION_TIMES');
    unique(s.id);
    const fingerprints = new Set<string>();
    for (const d of s.drinks) { unique(d.id); requireCondition(d.sessionId === s.id && !fingerprints.has(d.photoFingerprint), 'INVALID_DRINK_IDENTITY'); fingerprints.add(d.photoFingerprint); }
    for (const c of s.checks) {
      unique(c.id);
      requireCondition(c.sessionId === s.id && new Set(c.gameOrder).size === c.gameOrder.length && c.bundles.length <= c.gameOrder.length, 'INVALID_CHECK_IDENTITY');
      requireCondition(!c.completedAt || Date.parse(c.completedAt) >= Date.parse(c.startedAt), 'INVALID_CHECK_TIMES');
      for (const [i, b] of c.bundles.entries()) { unique(b.sessionId); parseConsumerBundle(b); requireCondition(b.gameResult.gameId === c.gameOrder[i], 'BUNDLE_ORDER_MISMATCH'); }
      if (c.status === 'COMPLETED') requireCondition(c.completedAt !== null && c.bundles.length === c.gameOrder.length && c.bundles.every(b => b.gameResult.valid && b.gameResult.trials.length > 0), 'INCOMPLETE_CHECK');
      if (c.status === 'IN_PROGRESS') requireCondition(c.completedAt === null && c.bundles.length < c.gameOrder.length && c.bundles.every(b => b.gameResult.valid), 'INVALID_PENDING_CHECK');
    }
  }
  requireCondition(state.activeSessionId === null || state.sessions.some(s => s.id === state.activeSessionId && s.endedAt === null), 'ACTIVE_SESSION_NOT_FOUND');
  return state;
}
