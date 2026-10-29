import { VOICE_RULES_VERSION, type SafetyLevel, type SpeechAct, type VoiceTone } from '../contracts';

/**
 * Voice rules (spec §14–§19). This module owns the *style* constraints; `./templates` owns the
 * sentences. Nothing outside `src/content/voice` may hold a cat line, so changing how Mellow
 * sounds is a single-directory change and never a business-logic change.
 */

export const VOICE_RULES = {
  version: VOICE_RULES_VERSION,
  /** Brevity. A reaction is one short thing, not an explanation. */
  brevity: {
    todayMaxWords: 16,
    /** Two short sentences are still one reaction: "Okay. We’re properly buzzed now." */
    todayMaxSentences: 2,
    recapMaxWords: 40,
    recapMaxSentences: 3,
    /** Safety may be longer than personality. Safety also overrides brevity entirely. */
    careMaxWords: 30,
    careMaxSentences: 3,
  },
  /** Personality mix target: 70% plain, 20% dry, 10% visible personality (spec §14). */
  toneMix: { plain: 0.7, dry: 0.2, personality: 0.1 },
  /**
   * Risk raises directness and lowers humour and cuteness. Playful wording disappears first, dry
   * wording second; at the top of the ladder only the direct voice is left.
   */
  tonesBySafety: {
    NORMAL: ['PLAIN', 'DRY', 'PLAYFUL', 'CARE', 'SAFETY'],
    ELEVATED: ['PLAIN', 'DRY', 'CARE', 'SAFETY'],
    HIGH: ['PLAIN', 'CARE', 'SAFETY'],
    CRITICAL: ['PLAIN', 'CARE', 'SAFETY'],
  } as Record<SafetyLevel, readonly VoiceTone[]>,
};

export function allowedTones(safety: SafetyLevel): readonly VoiceTone[] {
  return VOICE_RULES.tonesBySafety[safety];
}

export function toneAllowed(tone: VoiceTone, safety: SafetyLevel): boolean {
  return allowedTones(safety).includes(tone);
}

/* ------------------------------------------------------------------------------------------------
 * Hard style prohibitions (spec §12, §14, §16, §17, §18).
 * ---------------------------------------------------------------------------------------------- */

export type VoiceViolationCode =
  | 'CAT_PUN'
  | 'EMOJI'
  | 'HUMAN_ADDRESS'
  | 'TOLERANCE_PRAISE'
  | 'SHAME'
  | 'AI_ENCOURAGEMENT'
  | 'CHATBOT_QUESTION'
  | 'UNSUPPORTED_CAUSALITY'
  | 'FALSE_CERTAINTY'
  | 'ABSOLUTE_PERSONAL_CLAIM'
  | 'HUMOR_AT_RISK'
  | 'TOO_LONG'
  | 'TOO_MANY_SENTENCES';

export type VoiceViolation = { code: VoiceViolationCode; hard: boolean; detail: string };

export const PROHIBITED_PATTERNS: ReadonlyArray<{ code: VoiceViolationCode; pattern: RegExp; hard: boolean }> = [
  { code: 'CAT_PUN', pattern: /\bpaws?\b|\bpurr|\bmeow|\bpawsitive\b|\bkitty\b|\bwhiskers?\b/i, hard: true },
  { code: 'EMOJI', pattern: /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{27BF}\u{FE0F}]/u, hard: true },
  { code: 'HUMAN_ADDRESS', pattern: /\bhuman\b|\bhooman\b/i, hard: true },
  { code: 'TOLERANCE_PRAISE', pattern: /hold your liquor|impressive tolerance|handled .{0,20}\bwell\b|you can really drink|built for this/i, hard: true },
  { code: 'SHAME', pattern: /you failed|you messed up|\bbad night\b|disappoint|should have known better|embarrass/i, hard: true },
  {
    code: 'AI_ENCOURAGEMENT',
    pattern: /great job|\bgood job\b|proud of you|you[’']ve got this|well done|i[’']m here for you|remember to stay hydrated|you can do this/i,
    hard: true,
  },
  {
    code: 'CHATBOT_QUESTION',
    pattern: /\?|would you like|do you want to talk|let[’']s chat|how are you feeling|tell me more|anything else/i,
    hard: true,
  },
  { code: 'UNSUPPORTED_CAUSALITY', pattern: /\bmakes you\b|\bcauses?\b|\bcausing\b|\bbecause of\b|\bwill make\b|\bprevents?\b|\bdue to\b/i, hard: true },
  { code: 'FALSE_CERTAINTY', pattern: /\bdefinitely\b|\bfor sure\b|\bguaranteed\b|100%|i[’']m certain|\bproven\b/i, hard: true },
  { code: 'ABSOLUTE_PERSONAL_CLAIM', pattern: /\byou always\b|\byou never\b|\bevery single time\b/i, hard: true },
];

/** Wording that only ever reads as a joke. It may not be used once risk is real. */
export const HUMOR_MARKERS: readonly RegExp[] = [
  /fast-forward button/i,
  /more civilized/i,
  /confidence tonight/i,
  /fast lane/i,
];

export function wordCount(message: string): number {
  return message.split(/\s+/).filter(Boolean).length;
}

export function sentenceCount(message: string): number {
  return message.split(/[.!?…]+/).filter((part) => part.trim().length > 0).length;
}

export type VoiceAuditOptions = {
  safetyLevel: SafetyLevel;
  speechAct: SpeechAct | null;
  tone: VoiceTone | null;
  maxWords: number;
  maxSentences: number;
};

/**
 * Checks a rendered line against the frozen style rules. The engine treats a `hard` violation as a
 * reason to stay silent rather than to ship a line that breaks either the character or the safety
 * ladder. Safety wording is never cut for length: brevity is a style rule, not a safety rule.
 */
export function auditVoice(message: string, options: VoiceAuditOptions): VoiceViolation[] {
  const violations: VoiceViolation[] = [];
  for (const { code, pattern, hard } of PROHIBITED_PATTERNS) {
    if (pattern.test(message)) violations.push({ code, hard, detail: String(pattern) });
  }
  const safetyAct = options.speechAct === 'CARE';
  if (!safetyAct && (options.tone === 'DRY' || options.tone === 'PLAYFUL')) {
    const atRisk = options.safetyLevel === 'HIGH' || options.safetyLevel === 'CRITICAL';
    if (atRisk && HUMOR_MARKERS.some((pattern) => pattern.test(message))) {
      violations.push({ code: 'HUMOR_AT_RISK', hard: true, detail: 'humour at high risk' });
    }
  }
  if (!safetyAct) {
    if (wordCount(message) > options.maxWords)
      violations.push({ code: 'TOO_LONG', hard: false, detail: `${wordCount(message)} words` });
    if (sentenceCount(message) > options.maxSentences)
      violations.push({ code: 'TOO_MANY_SENTENCES', hard: false, detail: `${sentenceCount(message)} sentences` });
  }
  return violations;
}

export function hardViolations(violations: readonly VoiceViolation[]): VoiceViolation[] {
  return violations.filter((violation) => violation.hard);
}

/** Sentence budget for one reaction: a recap may say up to three short things, nothing else may. */
export function brevityBudget(speechAct: SpeechAct | null): { maxWords: number; maxSentences: number } {
  if (speechAct === 'CARE') return { maxWords: VOICE_RULES.brevity.careMaxWords, maxSentences: VOICE_RULES.brevity.careMaxSentences };
  if (speechAct === 'REFLECT') return { maxWords: VOICE_RULES.brevity.recapMaxWords, maxSentences: VOICE_RULES.brevity.recapMaxSentences };
  return { maxWords: VOICE_RULES.brevity.todayMaxWords, maxSentences: VOICE_RULES.brevity.todayMaxSentences };
}
