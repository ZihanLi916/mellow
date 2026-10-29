import type { Capability } from '../entitlement';
import {
  CONTENT_ENGINE_VERSION,
  CONTENT_OUTPUT_CONTRACT_VERSION,
  type ContentEvent,
  type EvidenceLevel,
  type ModelSignal,
  type Priority,
  type SafetyLevel,
  type SilenceReason,
  type SpeechAct,
} from '../content';

/**
 * Mellow Content Engine Integration v0.1 — contracts.
 *
 * This layer is the only bridge between real product events and the frozen content engine. It reads
 * domain events, snapshots and the resolved entitlement summary, and it never contains a cat
 * sentence: everything the user reads still comes from `src/content` (spec: integration must not add
 * wording of its own).
 */

export const CONTENT_INTEGRATION_VERSION = 'mellow-content-integration-0.1.0' as const;

/** The five real product entries wired in v0.1. Nothing else is connected. */
export const INTEGRATION_TRIGGERS = [
  'DRINK_CONFIRMED',
  'STATE_TRANSITION',
  'WATER_LOGGED',
  'FOOD_LOGGED',
  'SESSION_ENDED',
  'NEXT_DAY_OUTCOME',
] as const;
export type IntegrationTrigger = (typeof INTEGRATION_TRIGGERS)[number];

/** The frozen engine event each product trigger asks about. A session end resolves its own name. */
export const TRIGGER_CONTENT_EVENT: Record<IntegrationTrigger, ContentEvent> = {
  DRINK_CONFIRMED: 'DRINK_LOGGED',
  STATE_TRANSITION: 'STATE_REPORTED',
  WATER_LOGGED: 'WATER_LOGGED',
  FOOD_LOGGED: 'FOOD_LOGGED',
  SESSION_ENDED: 'SESSION_ENDED_MANUAL',
  NEXT_DAY_OUTCOME: 'NEXT_DAY_FOLLOWUP',
};

/**
 * How long a reaction belongs to the product (spec §14).
 *
 * `EVENT` reactions belong to one event and are never re-shown after a refresh. `SESSION` reactions
 * (the End Night recap) are part of that night's summary and may be read again while the night is
 * the current one.
 */
export const REACTION_LIFETIMES = ['EVENT', 'SESSION'] as const;
export type ReactionLifetime = (typeof REACTION_LIFETIMES)[number];

/** A real domain event, derived from a snapshot change rather than from a UI callback. */
export type SourceEvent = {
  trigger: IntegrationTrigger;
  /** Stable identity of the domain event: a drink id, a report id, an end timestamp, a session id. */
  eventId: string;
  sessionId: string;
  contentEvent: ContentEvent;
  lifetime: ReactionLifetime;
  observedAt: string;
};

/**
 * The persisted output record (spec §9). The message is stored for display only; nothing ever parses
 * it back into data — the structured fields beside it are the data.
 */
export type ContentOutputRecord = {
  voiceFactKind?: string | null;
  contentOutputId: string;
  dedupKey: string;
  sessionId: string | null;
  eventId: string;
  eventType: IntegrationTrigger;
  contentEvent: ContentEvent;
  generatedAt: string;
  shouldSpeak: boolean;
  reason: SilenceReason | null;
  priority: Priority | null;
  speechAct: SpeechAct | null;
  message: string | null;
  personalized: boolean;
  evidenceLevel: EvidenceLevel;
  safetyLevel: SafetyLevel;
  lifetime: ReactionLifetime;
  /** Structured evidence behind the reaction, when the engine had any. */
  evidenceIds: string[];
  /** The capability the frozen engine required for this reaction, when it required one. */
  capability: Capability | null;
  /** Which frozen contract produced it, so a stored record always names its origin. */
  sourceContentVersion: string;
  sourceEngineVersion: string;
  sourceOutputContract: string;
};

/** Personal model signals travel separately from the wording (spec §9, §24). */
export type ContentSignalRecord = {
  contentOutputId: string;
  sessionId: string;
  recordedAt: string;
  signal: ModelSignal;
};

/**
 * A stable dedup key. It is built only from identity that survives a refresh, a retry or a refetch:
 * the session, the domain event and the frozen engine version.
 */
export function dedupKeyOf(input: {
  trigger: IntegrationTrigger;
  sessionId: string;
  eventId: string;
  engineVersion?: string;
}): string {
  return [
    input.engineVersion ?? CONTENT_ENGINE_VERSION,
    input.trigger,
    input.sessionId,
    input.eventId,
  ].join('|');
}

/** The same key is the identity of the stored record, so dedup and persistence cannot diverge. */
export function outputIdOf(dedupKey: string): string {
  return `content:${dedupKey}`;
}

/** How many records and signals a store keeps. Older entries are dropped, never rewritten. */
export const MAX_STORED_OUTPUTS = 300;
export const MAX_STORED_SIGNALS = 600;

/** A recap that was produced while the app was closed is only offered for the current night. */
export const RECAP_WINDOW_HOURS = 24;

export { CONTENT_ENGINE_VERSION, CONTENT_OUTPUT_CONTRACT_VERSION };
