import {
  FOLLOWUP_SIGNAL_CONTRACT_VERSION,
  type EvidenceLevel,
  type ModelSignal,
  type ModelSignalCode,
} from './contracts';
import { evidenceFromNights } from './evidence';

/**
 * Model signals (spec §24).
 *
 * A follow-up reaction is not only a sentence: the useful part is what it tells the Personal
 * Drinking Model. Signals are clean, structured and versioned, and the content engine never trains
 * anything itself.
 *
 * Collecting signals is not an entitlement. The recorded history belongs to the user, so evidence
 * keeps accumulating on every plan; only *speaking* from it may be gated.
 */

export type ModelSignalInput = {
  code: ModelSignalCode;
  sessionId: string;
  direction: ModelSignal['direction'];
  magnitude?: number | null;
  nights: number;
  evidenceIds?: readonly string[];
  at: string;
  level?: EvidenceLevel;
};

export function modelSignal(input: ModelSignalInput): ModelSignal {
  const evidence = evidenceFromNights(input.nights, input.evidenceIds ?? []);
  return {
    code: input.code,
    session_id: input.sessionId,
    direction: input.direction,
    magnitude: input.magnitude ?? null,
    evidence: input.level ? { ...evidence, level: input.level } : evidence,
    at: input.at,
    contract: FOLLOWUP_SIGNAL_CONTRACT_VERSION,
  };
}

export function signalCodes(signals: readonly ModelSignal[]): ModelSignalCode[] {
  return signals.map((signal) => signal.code);
}

/** A rare, stable order for tests and freeze manifests. */
export function sortSignals(signals: readonly ModelSignal[]): ModelSignal[] {
  return [...signals].sort(
    (a, b) => a.code.localeCompare(b.code) || a.session_id.localeCompare(b.session_id),
  );
}
