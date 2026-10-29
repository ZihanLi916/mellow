import type { VoiceTemplate } from './template';

/**
 * Next-day follow-up reactions (spec §23). One reaction, whatever the user chose to report, and
 * nothing that pretends to know more than the answers do.
 */
export const FOLLOWUP_LINES: readonly VoiceTemplate[] = [
  {
    id: 'morning-comfortable-1',
    factKind: 'MORNING_COMFORTABLE_ZONE',
    text: 'Looks like that was a pretty comfortable zone for you.',
    tone: 'PLAIN',
    generalization: false,
    factKeys: ['followup.felt_intoxication', 'followup.prediction_expected_level'],
  },
  {
    id: 'morning-rougher-1',
    factKind: 'MORNING_ROUGHER_SAME_INTAKE',
    text: 'Same sort of intake, rougher morning. Noted.',
    tone: 'PLAIN',
    generalization: false,
    factKeys: ['followup.felt_intoxication', 'followup.overall_morning'],
  },
  {
    id: 'morning-underestimated-1',
    factKind: 'MORNING_UNDERESTIMATED',
    text: 'Got it. I underestimated you last night.',
    tone: 'PLAIN',
    generalization: false,
    factKeys: ['followup.felt_intoxication', 'followup.prediction_expected_level', 'followup.prediction_delta'],
  },
  {
    id: 'morning-overestimated-1',
    factKind: 'MORNING_OVERESTIMATED',
    text: 'You felt steadier than I expected. I’ll remember that.',
    tone: 'PLAIN',
    generalization: false,
    factKeys: ['followup.felt_intoxication', 'followup.prediction_expected_level', 'followup.prediction_delta'],
  },
  {
    id: 'morning-sleep-1',
    factKind: 'MORNING_SLEEP_DISAGREES',
    text: 'Last night may have felt easy. Your sleep disagrees.',
    tone: 'DRY',
    generalization: false,
    factKeys: ['followup.sleep_quality', 'followup.felt_intoxication'],
  },
  {
    id: 'morning-fast-nights-1',
    factKind: 'MORNING_FAST_NIGHTS_UNKIND',
    text: 'Okay. Fast nights really aren’t being kind to future-you.',
    tone: 'DRY',
    generalization: true,
    minBand: 'LEARNING',
    factKeys: ['pattern.nights', 'pattern.outcome.nights_with_outcome', 'pattern.outcome.heavier_mornings'],
  },
  {
    id: 'morning-food-case-1',
    factKind: 'MORNING_FOOD_CASE',
    text: 'Food-before-drinks is building a pretty good case for itself.',
    tone: 'DRY',
    generalization: true,
    minBand: 'LEARNING',
    factKeys: ['pattern.nights', 'pattern.outcome.nights_with_outcome', 'pattern.outcome.milder_mornings'],
  },
  {
    id: 'morning-late-cocktails-1',
    factKind: 'MORNING_LATE_COCKTAILS',
    text: 'Late cocktails are developing a bit of a reputation.',
    tone: 'DRY',
    generalization: true,
    minBand: 'LEARNING',
    factKeys: ['pattern.nights', 'pattern.key'],
  },
  {
    id: 'morning-no-evidence-1',
    factKind: 'MORNING_NO_EVIDENCE',
    text: 'Nothing obvious yet. I’m still learning.',
    tone: 'PLAIN',
    generalization: false,
    factKeys: ['followup.felt_intoxication'],
  },
  {
    id: 'morning-heavy-felt-1',
    factKind: 'MORNING_HEAVY_FELT',
    text: 'That was a heavy one. Worth keeping the next one slower.',
    tone: 'CARE',
    generalization: false,
    factKeys: ['followup.felt_intoxication', 'session.drink_count'],
  },
];
