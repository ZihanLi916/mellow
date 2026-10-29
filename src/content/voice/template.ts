import type { EvidenceLevel, FactKind, FamiliarityBand, VoiceTone } from '../contracts';
import { claimStrength } from '../evidence';

/**
 * A single frozen sentence. Vocabulary is deliberately limited to whole sentences here: no slot
 * filling, no string building, so every line an English reader can see was written by hand and can
 * be reviewed, scored and frozen.
 */
export type VoiceTemplate = {
  id: string;
  factKind: FactKind;
  text: string;
  tone: VoiceTone;
  /** True when the line claims something beyond tonight: a pattern, a habit, a baseline. */
  generalization: boolean;
  /** Facts the wording is grounded in. Checked against `current_fact` when a line renders. */
  factKeys: string[];
  /**
   * A fact key that must be present and truthy for this wording to be used. It is how a sentence
   * with a second, more specific claim ("the pace picked up most in the second half") only appears
   * when the night actually shows it.
   */
  requiresFactTrue?: string;
  minBand?: FamiliarityBand;
  maxBand?: FamiliarityBand;
};

/** Strongest claim the frozen wording makes, read from the text itself rather than declared. */
export function templateClaim(template: VoiceTemplate): EvidenceLevel {
  return claimStrength(template.text);
}

export function line(template: VoiceTemplate): VoiceTemplate {
  return template;
}
