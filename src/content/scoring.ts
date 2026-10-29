import { evidenceRank, type ContentDecision, type SafetyLevel } from './contracts';
import { claimStrength } from './evidence';
import { auditVoice, brevityBudget, wordCount, type VoiceViolation } from './voice/rules';
import { templateById } from './voice';
import type { VoiceTemplate } from './voice/template';

/**
 * Offline content scoring (spec §31–§32). Five dimensions, two points each, ten in total, and a set
 * of hard failures that fail a candidate outright regardless of its total.
 *
 * The scoring is intentionally mechanical: it grades the frozen wording against the insight it was
 * rendered from, so "sounds nice" cannot outscore "grounded and honest".
 */

export const SCORING_DIMENSIONS = [
  'SPECIFICITY',
  'PERSONALIZATION',
  'EVIDENCE_GROUNDING',
  'NATURALNESS',
  'MELLOW_PERSONALITY',
] as const;
export type ScoreDimension = (typeof SCORING_DIMENSIONS)[number];

export const PRODUCTION_CANDIDATE_MINIMUM = 7;

export const HARD_FAIL_RULES = {
  INVENTED_PERSONAL_HISTORY: /personal claim without any recorded night/i,
  INVENTED_PATTERN: /pattern claim without pattern evidence/i,
  UNSUPPORTED_CAUSALITY: /\bmakes you\b|\bcauses?\b|\bbecause of\b|\bdue to\b|\bwill make\b|\bprevents?\b/i,
  UNSAFE_ALCOHOL_ADVICE: /safe to drive|fine to drive|you can drink|keep drinking|one more|you[’']ll be fine|able to drink/i,
  TOLERANCE_PRAISE: /hold your liquor|impressive tolerance|handled .{0,20}\bwell\b/i,
  SHAME: /you failed|you messed up|\bbad night\b|disappoint|embarrass/i,
  FALSE_CERTAINTY: /\bdefinitely\b|\bfor sure\b|\bguaranteed\b|100%/i,
  FABRICATED_CONFIDENCE: /\b\d{1,3}\s?%|i[’']m \d+\s?(sure|certain)/i,
  CHATBOT_STYLE: /\?|would you like|let[’']s chat|tell me more/i,
  GENERIC_ENCOURAGEMENT: /great job|\bgood job\b|proud of you|you[’']ve got this|well done/i,
  CAT_PUNS: /\bpaws?\b|\bpurr|\bmeow|\bpawsitive\b|\bkitty\b/i,
  AUTO_END_AS_BEHAVIOUR: /inactiv|auto-?end|auto-?ended|closed itself|stopped using/i,
  /** Humour is not allowed once risk is real (spec §19). */
  HUMOR_AT_RISK: /fast-forward button|more civilized|confidence tonight|fast lane/i,
  /** A reaction the reader is not allowed to read must never have been produced in the first place. */
  UNREADABLE_CAPABILITY: /\b/,
} as const;
export type HardFailRule = keyof typeof HARD_FAIL_RULES;

export type ContentScore = {
  scored: boolean;
  dimensions: Record<ScoreDimension, number>;
  total: number;
  hard_fail: boolean;
  hard_fail_rules: HardFailRule[];
  violations: VoiceViolation[];
  pass: boolean;
};

const UNSCORED: ContentScore = {
  scored: false,
  dimensions: { SPECIFICITY: 0, PERSONALIZATION: 0, EVIDENCE_GROUNDING: 0, NATURALNESS: 0, MELLOW_PERSONALITY: 0 },
  total: 0,
  hard_fail: false,
  hard_fail_rules: [],
  violations: [],
  pass: false,
};

export type ScoreInput = {
  decision: ContentDecision;
  template?: VoiceTemplate | null;
  safety_level?: SafetyLevel;
  capability_readable?: boolean;
};

const CONDITIONAL_RULES: HardFailRule[] = ['INVENTED_PERSONAL_HISTORY', 'INVENTED_PATTERN', 'HUMOR_AT_RISK', 'UNREADABLE_CAPABILITY'];

function hardFailRules(input: ScoreInput): HardFailRule[] {
  const { decision } = input;
  const message = decision.message ?? '';
  const rules: HardFailRule[] = [];
  if (decision.personalized && decision.historical_evidence !== null && decision.historical_evidence.nights === 0) {
    rules.push('INVENTED_PERSONAL_HISTORY');
  }
  const generalizesMessage = /\busually\b|\byour usual\b|\btwice\b|\bpattern\b|i[’']ve noticed\b/i.test(message);
  if (generalizesMessage && evidenceRank(decision.evidence_level) < evidenceRank('REPEATED')) {
    rules.push('INVENTED_PATTERN');
  }
  for (const rule of Object.keys(HARD_FAIL_RULES) as HardFailRule[]) {
    if (CONDITIONAL_RULES.includes(rule)) continue;
    if (HARD_FAIL_RULES[rule].test(message)) rules.push(rule);
  }
  if (
    decision.tone !== null &&
    (decision.tone === 'DRY' || decision.tone === 'PLAYFUL') &&
    (input.safety_level ?? decision.safety_level) !== 'NORMAL'
  ) {
    rules.push('HUMOR_AT_RISK');
  }
  if (input.capability_readable === false && decision.capability !== null) rules.push('UNREADABLE_CAPABILITY');
  return [...new Set(rules)];
}

export function scoreContent(input: ScoreInput): ContentScore {
  const { decision } = input;
  if (!decision.should_speak || decision.message === null) return UNSCORED;
  const message = decision.message;
  const template = input.template ?? (decision.template_id ? templateById(decision.template_id) : null);
  const factKeys = template?.factKeys ?? [];
  const budget = brevityBudget(decision.speech_act);
  const violations = auditVoice(message, {
    safetyLevel: input.safety_level ?? decision.safety_level,
    speechAct: decision.speech_act,
    tone: decision.tone,
    maxWords: budget.maxWords,
    maxSentences: budget.maxSentences,
  });
  const grounded = factKeys.filter((key) => key in decision.current_fact).length;
  const claim = claimStrength(message);
  // Concrete tonight facts may be hedged as much as they like; only an evidence-based claim may
  // outrun the evidence behind it.
  const overclaim = decision.evidence_level !== 'NONE' && evidenceRank(claim) > evidenceRank(decision.evidence_level);
  const words = wordCount(message);

  const dimensions: Record<ScoreDimension, number> = {
    SPECIFICITY: factKeys.length >= 2 ? 2 : factKeys.length === 1 ? 1 : 0,
    PERSONALIZATION:
      decision.personalized && (decision.historical_evidence?.nights ?? 0) >= 1 ? 2 : decision.personalized ? 1 : 0,
    EVIDENCE_GROUNDING: overclaim ? 0 : factKeys.length > 0 && grounded === factKeys.length ? 2 : 1,
    NATURALNESS: violations.length === 0 ? 2 : violations.some((violation) => violation.hard) ? 0 : 1,
    MELLOW_PERSONALITY: /\bgreat job\b|proud of you|you[’']ve got this/i.test(message) ? 0 : decision.tone !== 'PLAIN' || words <= 8 ? 2 : 1,
  };
  const total = SCORING_DIMENSIONS.reduce((sum, dimension) => sum + dimensions[dimension], 0);
  const hardFail = hardFailRules(input);
  return {
    scored: true,
    dimensions,
    total,
    hard_fail: hardFail.length > 0,
    hard_fail_rules: hardFail,
    violations,
    pass: hardFail.length === 0 && total >= PRODUCTION_CANDIDATE_MINIMUM,
  };
}

export function templateForDecision(decision: ContentDecision): VoiceTemplate | null {
  return decision.template_id ? templateById(decision.template_id) : null;
}
