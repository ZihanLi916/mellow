import {
  type ContentInsight,
  type EvidenceLevel,
  type FactKind,
  type FactValue,
  type FamiliarityBand,
  type SafetyLevel,
  type SpeechAct,
  type VoiceTone,
  evidenceRank,
  familiarityRank,
} from '../contracts';
import { BAND_GRAMMAR } from '../familiarity';
import { FACT_KIND_SPEC } from '../taxonomy';
import { FOLLOWUP_LINES } from './followupLines';
import { RECAP_LINES } from './recapLines';
import {
  auditVoice,
  brevityBudget,
  hardViolations,
  toneAllowed,
  wordCount,
  type VoiceViolation,
} from './rules';
import { templateClaim, type VoiceTemplate } from './template';
import { TONIGHT_LINES } from './tonightLines';

/**
 * The Mellow voice renderer. It receives an insight — facts, priority, evidence — and returns one
 * short line. It has no access to raw user data, no model, and no ability to invent a fact: every
 * sentence it can produce is a frozen, reviewed template from this directory.
 */

export const VOICE_TEMPLATES: readonly VoiceTemplate[] = [...TONIGHT_LINES, ...RECAP_LINES, ...FOLLOWUP_LINES];

export const VOICE_TEMPLATE_IDS: readonly string[] = VOICE_TEMPLATES.map((template) => template.id);

export function templatesFor(factKind: FactKind): VoiceTemplate[] {
  return VOICE_TEMPLATES.filter((template) => template.factKind === factKind);
}

export function templateById(id: string): VoiceTemplate | null {
  return VOICE_TEMPLATES.find((template) => template.id === id) ?? null;
}

function bandSpecificity(template: VoiceTemplate): number {
  return (template.minBand ? 1 : 0) + (template.maxBand ? 1 : 0);
}

function bandAllows(template: VoiceTemplate, band: FamiliarityBand): boolean {
  if (template.minBand && familiarityRank(band) < familiarityRank(template.minBand)) return false;
  if (template.maxBand && familiarityRank(band) > familiarityRank(template.maxBand)) return false;
  return true;
}

/**
 * A template may only be used at the evidence its wording claims. Wording that generalizes beyond
 * tonight is filtered structurally, so a two-night history can never receive "you usually…".
 * Concrete tonight facts may be hedged as much as they like.
 */
export function templateAllowedAtEvidence(
  template: VoiceTemplate,
  evidence: { level: EvidenceLevel; generalization: boolean },
): boolean {
  if (!evidence.generalization) return true;
  return evidenceRank(templateClaim(template)) <= evidenceRank(evidence.level);
}

export function isTemplateAllowed(
  template: VoiceTemplate,
  options: {
    band: FamiliarityBand;
    safety: SafetyLevel;
    evidence: { level: EvidenceLevel; generalization: boolean };
    facts: Record<string, FactValue>;
  },
): boolean {
  if (!bandAllows(template, options.band)) return false;
  if (!templateAllowedAtEvidence(template, options.evidence)) return false;
  if (template.requiresFactTrue && options.facts[template.requiresFactTrue] !== true) return false;
  return toneAllowed(template.tone, options.safety);
}

export type TemplateSelectionOptions = {
  band: FamiliarityBand;
  safety: SafetyLevel;
  /** `0` always yields the frozen primary wording. */
  seed?: number;
};

function candidatesFor(insight: ContentInsight, options: TemplateSelectionOptions): VoiceTemplate[] {
  const evidence = { level: insight.historical_evidence.level, generalization: insight.generalization };
  return templatesFor(insight.fact_kind)
    .filter((template) =>
      isTemplateAllowed(template, {
        band: options.band,
        safety: options.safety,
        evidence,
        facts: insight.current_fact,
      }),
    )
    .sort(
      (a, b) =>
        evidenceRank(templateClaim(b)) - evidenceRank(templateClaim(a)) ||
        bandSpecificity(b) - bandSpecificity(a) ||
        VOICE_TEMPLATES.indexOf(a) - VOICE_TEMPLATES.indexOf(b),
    );
}

export function selectTemplate(
  insight: ContentInsight,
  options: TemplateSelectionOptions,
): VoiceTemplate | null {
  const candidates = candidatesFor(insight, options);
  if (candidates.length === 0) return null;
  const seed = Number.isFinite(options.seed) ? Math.max(0, Math.floor(options.seed ?? 0)) : 0;
  return seed > 0 ? candidates[seed % candidates.length] : candidates[0];
}

export type RenderedReaction = {
  message: string;
  tone: VoiceTone;
  templateId: string;
  template: VoiceTemplate;
  violations: VoiceViolation[];
  blocked: boolean;
};

/** Renders one insight, or returns `null` when no frozen wording fits the reader or the risk. */
export function renderInsight(
  insight: ContentInsight,
  options: TemplateSelectionOptions & { speechAct: SpeechAct },
): RenderedReaction | null {
  const template = selectTemplate(insight, options);
  if (!template) return null;
  const budget = brevityBudget(options.speechAct);
  const violations = auditVoice(template.text, {
    safetyLevel: options.safety,
    speechAct: options.speechAct,
    tone: template.tone,
    maxWords: Math.min(budget.maxWords, BAND_GRAMMAR[options.band].maxWords),
    maxSentences: budget.maxSentences,
  });
  return {
    message: template.text,
    tone: template.tone,
    templateId: template.id,
    template,
    violations,
    blocked: hardViolations(violations).length > 0,
  };
}

/** Renders one insight with the taxonomy's own speech act. */
export function renderFor(insight: ContentInsight, options: TemplateSelectionOptions): RenderedReaction | null {
  return renderInsight(insight, { ...options, speechAct: FACT_KIND_SPEC[insight.fact_kind].speechAct });
}

/** Every frozen line audited against its own tone, act and evidence claim. Used by the tests. */
export function auditCatalog(): Array<{ id: string; violations: VoiceViolation[]; words: number }> {
  return VOICE_TEMPLATES.map((template) => {
    const act = FACT_KIND_SPEC[template.factKind].speechAct;
    const budget = brevityBudget(act);
    return {
      id: template.id,
      words: wordCount(template.text),
      violations: auditVoice(template.text, {
        safetyLevel: 'NORMAL',
        speechAct: act,
        tone: template.tone,
        maxWords: budget.maxWords,
        maxSentences: budget.maxSentences,
      }),
    };
  });
}
