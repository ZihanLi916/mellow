import type { VoiceTemplate } from './template';

/**
 * End Night reflection (spec §20). A recap says at most one to three short sentences, never an
 * essay, and it never depends on how the night happened to be closed.
 */
export const RECAP_LINES: readonly VoiceTemplate[] = [
  {
    id: 'recap-steady-1',
    factKind: 'RECAP_STEADY',
    text: 'Pretty steady night. Nothing unusual.',
    tone: 'PLAIN',
    generalization: false,
    factKeys: ['session.drink_count', 'session.median_gap_minutes'],
  },
  {
    id: 'recap-slower-stable',
    factKind: 'RECAP_SLOWER_THAN_USUAL',
    text: 'Nice and steady. You gave each drink more room than usual tonight.',
    tone: 'PLAIN',
    generalization: true,
    minBand: 'FAMILIAR',
    factKeys: ['session.median_gap_minutes', 'baseline.typical_pace_per_hour'],
  },
  {
    id: 'recap-slower-weak',
    factKind: 'RECAP_SLOWER_THAN_USUAL',
    text: 'Nice and steady. Slower than your recent nights, so far.',
    tone: 'PLAIN',
    generalization: true,
    factKeys: ['session.median_gap_minutes', 'baseline.typical_pace_per_hour'],
  },
  {
    id: 'recap-over-plan-1',
    factKind: 'RECAP_OVER_PLAN',
    text: 'Ended up heavier than you planned. The pace picked up most in the second half.',
    tone: 'PLAIN',
    generalization: false,
    factKeys: [
      'session.drink_count',
      'intention.planned_drinks',
      'session.first_half_drinks',
      'session.second_half_drinks',
      'session.second_half_heavier',
    ],
    requiresFactTrue: 'session.second_half_heavier',
  },
  {
    id: 'recap-over-plan-2',
    factKind: 'RECAP_OVER_PLAN',
    text: 'Ended up heavier than you planned.',
    tone: 'PLAIN',
    generalization: false,
    factKeys: ['session.drink_count', 'intention.planned_drinks'],
  },
  {
    id: 'recap-personal-pattern-1',
    factKind: 'RECAP_PERSONAL_PATTERN',
    text: 'Very you, apparently: slow start, then a sharper jump later.',
    tone: 'DRY',
    generalization: true,
    minBand: 'FAMILIAR',
    factKeys: ['pattern.nights', 'session.first_half_drinks', 'session.second_half_drinks'],
  },
  {
    id: 'recap-nothing-notable-1',
    factKind: 'RECAP_NOTHING_NOTABLE',
    text: 'Quiet one. Nothing particularly interesting for my notes.',
    tone: 'DRY',
    generalization: false,
    factKeys: ['session.drink_count'],
  },
  {
    id: 'recap-last-fast-night-1',
    factKind: 'RECAP_LOOKED_LIKE_LAST_FAST_NIGHT',
    text: 'This looks a lot like your last fast night.',
    tone: 'PLAIN',
    generalization: true,
    minBand: 'LEARNING',
    factKeys: ['session.fast_drink_count', 'pattern.nights', 'pattern.key'],
  },
];
