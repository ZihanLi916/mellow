import type { Capability } from '../entitlement';
import { FACT_KINDS, type FactKind, type Priority, type SpeechAct } from './contracts';

/**
 * One row per fact kind. Priority, speech act and the capability a reader must hold are declared
 * once, here, and every evaluator builds its insights from this table. That is what keeps the
 * frozen priority hierarchy true: no evaluator can quietly invent a ranking of its own.
 */
export type FactKindSpec = {
  priority: Priority;
  speechAct: SpeechAct;
  /**
   * The capability a reader needs for this reaction. `null` means the reaction only needs the
   * current session, which every user can read. Safety capabilities are always readable.
   */
  capability: Capability | null;
};

export const FACT_KIND_SPEC: Record<FactKind, FactKindSpec> = {
  FIRST_DRINK_STRONG: { priority: 'P6', speechAct: 'NOTICE', capability: null },
  PACE_SECOND_FAST: { priority: 'P5', speechAct: 'NUDGE', capability: null },
  PACE_BURST_THIRD: { priority: 'P5', speechAct: 'NUDGE', capability: null },
  WATER_AFTER_FAST: { priority: 'P5', speechAct: 'NUDGE', capability: null },
  FOOD_TIMING: { priority: 'P5', speechAct: 'NUDGE', capability: null },
  PACE_DECELERATION: { priority: 'P6', speechAct: 'NOTICE', capability: null },
  STATE_TRANSITION: { priority: 'P4', speechAct: 'NOTICE', capability: null },
  STATE_EARLIER_THAN_USUAL: { priority: 'P1', speechAct: 'COMPARE', capability: 'PERSONAL_BASELINE' },
  HOLDING_STEADIER_THAN_USUAL: { priority: 'P1', speechAct: 'COMPARE', capability: 'PERSONAL_BASELINE' },
  PATTERN_SECOND_OCCURRENCE: { priority: 'P3', speechAct: 'REMEMBER', capability: 'CROSS_SESSION_PATTERN_ANALYSIS' },
  PATTERN_EMERGING: { priority: 'P3', speechAct: 'REVEAL', capability: 'CROSS_SESSION_PATTERN_ANALYSIS' },
  PATTERN_ESTABLISHED: { priority: 'P3', speechAct: 'REMEMBER', capability: 'HISTORICAL_CONTEXT_FOR_CAT' },
  CORRECTION_IDENTIFIED: { priority: 'P6', speechAct: 'NOTICE', capability: null },
  INTENTION_EXCEEDED_TONIGHT: { priority: 'P2', speechAct: 'NOTICE', capability: null },
  SAFETY_RAPID_WINDOW_ELEVATED: { priority: 'P0', speechAct: 'CARE', capability: 'SAFETY_STOP_SLOW_SIGNAL' },
  SAFETY_RAPID_WINDOW_HIGH: { priority: 'P0', speechAct: 'CARE', capability: 'SAFETY_STOP_SLOW_SIGNAL' },
  SAFETY_DRIVING: { priority: 'P0', speechAct: 'CARE', capability: 'SAFETY_DRIVING_WARNING' },
  SAFETY_SEVERE_STATE: { priority: 'P0', speechAct: 'CARE', capability: 'SAFETY_EMERGENCY_GUIDANCE' },
  RECAP_STEADY: { priority: 'P6', speechAct: 'REFLECT', capability: 'BASIC_SESSION_RECAP' },
  RECAP_SLOWER_THAN_USUAL: { priority: 'P1', speechAct: 'COMPARE', capability: 'PERSONAL_BASELINE' },
  RECAP_OVER_PLAN: { priority: 'P2', speechAct: 'REFLECT', capability: 'BASIC_SESSION_RECAP' },
  RECAP_PERSONAL_PATTERN: { priority: 'P3', speechAct: 'REFLECT', capability: 'CROSS_SESSION_PATTERN_ANALYSIS' },
  RECAP_NOTHING_NOTABLE: { priority: 'P6', speechAct: 'REFLECT', capability: 'BASIC_SESSION_RECAP' },
  RECAP_LOOKED_LIKE_LAST_FAST_NIGHT: { priority: 'P3', speechAct: 'REMEMBER', capability: 'HISTORICAL_CONTEXT_FOR_CAT' },
  MORNING_COMFORTABLE_ZONE: { priority: 'P4', speechAct: 'COMPARE', capability: 'PERSONAL_BASELINE' },
  MORNING_ROUGHER_SAME_INTAKE: { priority: 'P4', speechAct: 'COMPARE', capability: 'PERSONAL_BASELINE' },
  MORNING_UNDERESTIMATED: { priority: 'P1', speechAct: 'REVEAL', capability: 'PERSONALIZED_INTOXICATION_ESTIMATE' },
  MORNING_OVERESTIMATED: { priority: 'P1', speechAct: 'REVEAL', capability: 'PERSONALIZED_INTOXICATION_ESTIMATE' },
  MORNING_SLEEP_DISAGREES: { priority: 'P3', speechAct: 'NOTICE', capability: null },
  MORNING_FAST_NIGHTS_UNKIND: { priority: 'P3', speechAct: 'REMEMBER', capability: 'CROSS_SESSION_PATTERN_ANALYSIS' },
  MORNING_FOOD_CASE: { priority: 'P3', speechAct: 'REVEAL', capability: 'FOOD_EFFECT_MODEL' },
  MORNING_LATE_COCKTAILS: { priority: 'P3', speechAct: 'REVEAL', capability: 'CROSS_SESSION_PATTERN_ANALYSIS' },
  MORNING_NO_EVIDENCE: { priority: 'P6', speechAct: 'NOTICE', capability: null },
  MORNING_HEAVY_FELT: { priority: 'P0', speechAct: 'CARE', capability: 'SAFETY_STOP_SLOW_SIGNAL' },
};

/**
 * Higher wins inside the same priority tier. Only ever a tie-break; it never changes a tier.
 */
const IMPORTANCE: Partial<Record<FactKind, number>> = {
  SAFETY_SEVERE_STATE: 100,
  SAFETY_DRIVING: 100,
  SAFETY_RAPID_WINDOW_HIGH: 90,
  SAFETY_RAPID_WINDOW_ELEVATED: 80,
  MORNING_HEAVY_FELT: 70,
  STATE_EARLIER_THAN_USUAL: 60,
  HOLDING_STEADIER_THAN_USUAL: 55,
  RECAP_SLOWER_THAN_USUAL: 52,
  PATTERN_ESTABLISHED: 50,
  PATTERN_EMERGING: 45,
  PATTERN_SECOND_OCCURRENCE: 40,
  MORNING_UNDERESTIMATED: 40,
  MORNING_OVERESTIMATED: 38,
  INTENTION_EXCEEDED_TONIGHT: 35,
  RECAP_OVER_PLAN: 34,
  PACE_BURST_THIRD: 30,
  PACE_SECOND_FAST: 25,
  STATE_TRANSITION: 20,
};

export function importanceOf(kind: FactKind): number {
  return IMPORTANCE[kind] ?? 0;
}

/** Declaration order is the final, fully deterministic tie-break. */
export function factKindOrder(kind: FactKind): number {
  return FACT_KINDS.indexOf(kind);
}

/**
 * Fact kinds whose wording claims something beyond tonight: a pattern, a habit, a baseline, a
 * recurring shape. Their wording is evidence-gated, and the first occurrence of a shape never
 * produces one at all.
 */
export const GENERALIZING_KINDS: readonly FactKind[] = [
  'STATE_EARLIER_THAN_USUAL',
  'HOLDING_STEADIER_THAN_USUAL',
  'PATTERN_SECOND_OCCURRENCE',
  'PATTERN_EMERGING',
  'PATTERN_ESTABLISHED',
  'RECAP_SLOWER_THAN_USUAL',
  'RECAP_PERSONAL_PATTERN',
  'RECAP_LOOKED_LIKE_LAST_FAST_NIGHT',
  'MORNING_FAST_NIGHTS_UNKIND',
  'MORNING_FOOD_CASE',
  'MORNING_LATE_COCKTAILS',
];

export function generalizes(kind: FactKind): boolean {
  return GENERALIZING_KINDS.includes(kind);
}
