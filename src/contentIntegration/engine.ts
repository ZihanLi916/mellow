import {
  observe,
  type ContentContext,
  type ContentDecision,
  type ModelSignal,
} from '../content';
import {
  CONTENT_ENGINE_VERSION,
  CONTENT_OUTPUT_CONTRACT_VERSION,
  dedupKeyOf,
  outputIdOf,
  type ContentOutputRecord,
  type SourceEvent,
} from './contracts';

/**
 * The frozen-engine call site (spec §3).
 *
 * One domain event produces at most one call to `observe()` and at most one stored record. The
 * integration adds no wording, no priority and no evidence of its own: it copies what the engine
 * decided into a structure the product can persist and display.
 */

export type EvaluatedEvent = {
  event: SourceEvent;
  decision: ContentDecision;
  record: ContentOutputRecord;
  signals: ModelSignal[];
};

export function outputRecordFor(input: {
  event: SourceEvent;
  decision: ContentDecision;
  generatedAt: string;
  engineVersion?: string;
}): ContentOutputRecord {
  const dedupKey = dedupKeyOf({
    trigger: input.event.trigger,
    sessionId: input.event.sessionId,
    eventId: input.event.eventId,
    engineVersion: input.engineVersion,
  });
  return {
    contentOutputId: outputIdOf(dedupKey),
    voiceFactKind: input.decision.speech_reason,
    dedupKey,
    sessionId: input.event.sessionId,
    eventId: input.event.eventId,
    eventType: input.event.trigger,
    contentEvent: input.event.contentEvent,
    generatedAt: input.generatedAt,
    shouldSpeak: input.decision.should_speak,
    reason: input.decision.reason,
    priority: input.decision.priority,
    speechAct: input.decision.speech_act,
    message: input.decision.message,
    personalized: input.decision.personalized,
    evidenceLevel: input.decision.evidence_level,
    safetyLevel: input.decision.safety_level,
    lifetime: input.event.lifetime,
    evidenceIds: [...(input.decision.historical_evidence?.evidence_ids ?? [])],
    capability: input.decision.capability,
    sourceContentVersion: CONTENT_ENGINE_VERSION,
    sourceEngineVersion: CONTENT_ENGINE_VERSION,
    sourceOutputContract: CONTENT_OUTPUT_CONTRACT_VERSION,
  };
}

/** Runs the frozen pipeline exactly once for one domain event. */
export function evaluateSourceEvent(
  context: ContentContext,
  event: SourceEvent,
  generatedAt: string,
  engineVersion?: string,
): EvaluatedEvent {
  const decision = observe(context);
  return {
    event,
    decision,
    record: outputRecordFor({ event, decision, generatedAt, engineVersion }),
    signals: decision.model_signals,
  };
}
