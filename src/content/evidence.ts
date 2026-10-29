import { evidenceRank, type EvidenceLevel, type HistoricalEvidence } from './contracts';
import { evidenceLevelForNights } from './familiarity';

/**
 * Evidence strength → language strength (spec §11).
 *
 * A generalization may never be stated more strongly than its evidence. The markers below are the
 * observable form of that rule, so both the renderer and the audit can enforce it mechanically:
 *
 * - weak data      → looks like / seems / maybe / so far / might
 * - repeated       → I've noticed / twice now / this is the third time / pattern
 * - stable base    → usually / your usual / your normal / typically
 */

export const WEAK_MARKERS: readonly RegExp[] = [
  /\blooks like\b/i,
  /\bseems?\b/i,
  /\bmaybe\b/i,
  /\bso far\b/i,
  /\bmight\b/i,
  /\bstarting to\b/i,
];

export const REPEATED_MARKERS: readonly RegExp[] = [
  /\btwice\b/i,
  /\bthird time\b/i,
  /i[’']ve noticed/i,
  /\bpattern\b/i,
  /\bagain\b/i,
];

export const STABLE_MARKERS: readonly RegExp[] = [
  /\busually\b/i,
  /\byour usual\b/i,
  /\bthan usual\b/i,
  /\byour normal\b/i,
  /\btypically\b/i,
];

function matches(message: string, markers: readonly RegExp[]): boolean {
  return markers.some((marker) => marker.test(message));
}

/** The strongest claim the wording actually makes, read off the message itself. */
export function claimStrength(message: string): EvidenceLevel {
  if (matches(message, STABLE_MARKERS)) return 'STABLE';
  if (matches(message, REPEATED_MARKERS)) return 'REPEATED';
  if (matches(message, WEAK_MARKERS)) return 'WEAK';
  return 'NONE';
}

export type EvidenceLanguageAudit = {
  ok: boolean;
  claim: EvidenceLevel;
  reason: 'NONE' | 'OVERCLAIM' | 'UNHEDGED_GENERALIZATION';
};

/**
 * A generalization needs a hedge while the evidence is weak, and no wording may ever claim more
 * than the evidence supports. Concrete tonight facts need no hedge at any level.
 */
export function auditEvidenceLanguage(
  message: string,
  evidence: { level: EvidenceLevel; generalization: boolean },
): EvidenceLanguageAudit {
  const claim = claimStrength(message);
  // A concrete tonight fact is not an evidence claim, so a hedge on it can never be an overclaim.
  if (evidence.level !== 'NONE' && evidenceRank(claim) > evidenceRank(evidence.level)) {
    return { ok: false, claim, reason: 'OVERCLAIM' };
  }
  if (evidence.generalization && evidence.level === 'WEAK' && claim === 'NONE') {
    return { ok: false, claim, reason: 'UNHEDGED_GENERALIZATION' };
  }
  return { ok: true, claim, reason: 'NONE' };
}

/** True when the wording is allowed at this evidence level. */
export function evidenceLanguageAllowed(
  message: string,
  evidence: { level: EvidenceLevel; generalization: boolean },
): boolean {
  return auditEvidenceLanguage(message, evidence).ok;
}

/** Evidence summary used by the insights and the output contract. */
export function evidenceSummary(
  nights: number,
  level: EvidenceLevel,
  evidenceIds: readonly string[] = [],
): HistoricalEvidence {
  return { level, nights, evidence_ids: [...new Set(evidenceIds)].sort() };
}

/** Evidence summary derived from an independent-night count. */
export function evidenceFromNights(nights: number, evidenceIds: readonly string[] = []): HistoricalEvidence {
  const safe = Number.isFinite(nights) && nights > 0 ? Math.floor(nights) : 0;
  return evidenceSummary(safe, evidenceLevelForNights(safe), evidenceIds);
}
