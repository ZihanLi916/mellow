import type { Capability } from '../entitlement';
import {
  emptyPersonalContext,
  type ContentInsight,
  type FactKind,
  type FactValue,
  type HistoricalEvidence,
  type PersonalComparison,
  type SafetyLevel,
  type SessionContext,
} from './contracts';
import { evidenceFromNights } from './evidence';
import { FACT_KIND_SPEC, generalizes } from './taxonomy';
/**
 * One builder for every candidate insight. Priority, speech act and the required capability always
 * come from the taxonomy table, so an evaluator states facts and nothing else.
 */

export type InsightInput = {
  factKind: FactKind;
  safetyLevel?: SafetyLevel;
  personalized?: boolean;
  generalization?: boolean;
  /** Only for fact kinds whose gate genuinely depends on the evidence in hand. */
  capability?: Capability | null;
  currentFact?: Record<string, FactValue>;
  personalComparison?: PersonalComparison | null;
  historicalEvidence?: HistoricalEvidence;
  /** Disambiguates two candidates of the same kind inside one evaluation. */
  suffix?: string;
};

export function buildInsight(input: InsightInput): ContentInsight {
  const spec = FACT_KIND_SPEC[input.factKind];
  return {
    key: input.suffix ? `${input.factKind}:${input.suffix}` : input.factKind,
    speech_reason: input.factKind,
    fact_kind: input.factKind,
    priority: spec.priority,
    speech_act: spec.speechAct,
    safety_level: input.safetyLevel ?? 'NORMAL',
    personalized: input.personalized ?? false,
    generalization: input.generalization ?? generalizes(input.factKind),
    capability: input.capability === undefined ? spec.capability : input.capability,
    current_fact: input.currentFact ?? {},
    personal_comparison: input.personalComparison ?? null,
    historical_evidence: input.historicalEvidence ?? evidenceFromNights(0),
  };
}

/** Convenience alias so evaluators can read like prose. */
export function emptyPersonal() {
  return emptyPersonalContext();
}

export function sessionLabel(session: SessionContext | null): string {
  return session?.session_id ?? 'unknown-session';
}
