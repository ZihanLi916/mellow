import type { ModelMaturity } from '../entitlement';
import {
  MIN_REPEATED_NIGHTS,
  MIN_STABLE_NIGHTS,
  MIN_WELL_KNOWN_NIGHTS,
  type EvidenceLevel,
  type FamiliarityBand,
  familiarityRank,
  type PersonalContext,
} from './contracts';

/**
 * Familiarity grammar (spec §25).
 *
 * Familiarity is maturity: how much usable evidence Mellow has accumulated about this person. It is
 * not a statistical confidence and it is not an indicator of what the user owns. A band may never
 * claim more history than the evidence actually supports, so a two-night user can never be spoken
 * to as a well-known one.
 */

/** Coarse evidence levels from independent nights. Two nights are never a personality. */
export function evidenceLevelForNights(nights: number): EvidenceLevel {
  if (!Number.isFinite(nights) || nights <= 0) return 'NONE';
  if (nights >= MIN_STABLE_NIGHTS) return 'STABLE';
  if (nights >= MIN_REPEATED_NIGHTS) return 'REPEATED';
  return 'WEAK';
}

/** The most familiar band a given amount of history is allowed to produce. */
function evidenceCap(nights: number): FamiliarityBand {
  if (!Number.isFinite(nights) || nights <= 0) return 'STRANGER';
  if (nights >= MIN_WELL_KNOWN_NIGHTS) return 'WELL_KNOWN';
  if (nights >= MIN_STABLE_NIGHTS) return 'FAMILIAR';
  return 'LEARNING';
}

function maturityBand(maturity: ModelMaturity): FamiliarityBand {
  switch (maturity) {
    case 'ESTABLISHED':
      return 'WELL_KNOWN';
    case 'FAMILIAR':
      return 'FAMILIAR';
    case 'LEARNING':
      return 'LEARNING';
    default:
      return 'STRANGER';
  }
}

function familiarityBandFromScalar(familiarity: number): FamiliarityBand {
  const value = Number.isFinite(familiarity) ? Math.max(0, Math.min(1, familiarity)) : 0;
  if (value >= 0.75) return 'WELL_KNOWN';
  if (value >= 0.5) return 'FAMILIAR';
  if (value > 0) return 'LEARNING';
  return 'STRANGER';
}

function weaker(a: FamiliarityBand, b: FamiliarityBand): FamiliarityBand {
  return familiarityRank(a) <= familiarityRank(b) ? a : b;
}

/**
 * Derives the band from the model maturity when one exists, from the maturity scalar otherwise, and
 * then caps it by the history that genuinely exists.
 */
export function familiarityBand(personal: {
  familiarity: number;
  model_maturity: ModelMaturity | null;
  historical_nights: number;
}): FamiliarityBand {
  const requested = personal.model_maturity
    ? maturityBand(personal.model_maturity)
    : familiarityBandFromScalar(personal.familiarity);
  return weaker(requested, evidenceCap(personal.historical_nights));
}

export function bandOf(personal: PersonalContext): FamiliarityBand {
  return familiarityBand(personal);
}

/**
 * How the band changes language (spec §25). The band never *grants* a claim: it only decides how
 * short the wording may be and how much the cat may assume the user knows it is being watched.
 * `maxWords` is the brevity budget the voice layer enforces for this band.
 */
export const BAND_GRAMMAR: Record<
  FamiliarityBand,
  { maxWords: number; allowsBaselineLanguage: boolean; allowsShortForm: boolean }
> = {
  STRANGER: { maxWords: 14, allowsBaselineLanguage: false, allowsShortForm: false },
  LEARNING: { maxWords: 16, allowsBaselineLanguage: false, allowsShortForm: false },
  FAMILIAR: { maxWords: 16, allowsBaselineLanguage: true, allowsShortForm: false },
  WELL_KNOWN: { maxWords: 12, allowsBaselineLanguage: true, allowsShortForm: true },
};
