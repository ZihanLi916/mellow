import { describe, expect, it } from 'vitest';
import { contentContextFromSnapshot, sessionContextFromTonightSession } from './adapt';
import { CONTENT_OUTPUT_CONTRACT_VERSION, SPEECH_ACTS, type ContentContext, type ContentDecision } from './contracts';
import { defaultPlanPort, elevatedPlanPort, openNightSnapshot, snapshotFromNights } from './fixtures';
import { observe } from './shouldSpeak';
import { templateById, VOICE_TEMPLATE_IDS } from './voice';
import { claimStrength } from './evidence';

/**
 * The pipeline itself: event → context → insight → should Mellow speak → one line.
 */

const NOW = '2026-09-11T01:00:00.000Z';

function openNight(drinks: Array<{ id: string; at: string; abvPercent?: number }>, extras = {}) {
  const snapshot = openNightSnapshot({
    id: 'tonight',
    start: '2026-09-11T20:00:00.000Z',
    drinks: drinks.map((drink) => ({ ...drink, abvPercent: drink.abvPercent ?? 5 })),
  });
  return contentContextFromSnapshot({
    snapshot,
    event: 'DRINK_LOGGED',
    capability: defaultPlanPort(),
    sessionId: 'tonight',
    extras: { now: NOW, ...extras },
  });
}

describe('content engine pipeline', () => {
  it('returns the full output contract on every event, speaking or not', () => {
    const decision = observe(openNight([{ id: 'd-1', at: '2026-09-11T20:00:00.000Z' }]));
    expect(decision.version).toBe(CONTENT_OUTPUT_CONTRACT_VERSION);
    for (const field of [
      'should_speak',
      'reason',
      'priority',
      'speech_act',
      'speech_reason',
      'message',
      'tone',
      'evidence_level',
      'personalized',
      'safety_level',
      'model_signals',
      'current_fact',
      'followup_context',
      'insight_key',
      'capability',
    ]) {
      expect(Object.keys(decision), field).toContain(field);
    }
    expect(decision.should_speak).toBe(false);
    expect(decision.reason).toBe('NO_MEANINGFUL_NEW_INFORMATION');
    expect(decision.message).toBeNull();
    expect(decision.priority).toBeNull();
    expect(decision.speech_act).toBeNull();
  });

  it('never invents a line: every message comes from the frozen catalog', () => {
    const decisions: ContentDecision[] = [
      observe(openNight([{ id: 'd-1', at: '2026-09-11T20:00:00.000Z', abvPercent: 40 }])),
      observe(
        openNight([
          { id: 'd-1', at: '2026-09-11T20:00:00.000Z' },
          { id: 'd-2', at: '2026-09-11T20:10:00.000Z' },
        ]),
      ),
      observe(
        openNight([
          { id: 'd-1', at: '2026-09-11T20:00:00.000Z' },
          { id: 'd-2', at: '2026-09-11T20:10:00.000Z' },
          { id: 'd-3', at: '2026-09-11T20:20:00.000Z' },
        ]),
      ),
    ];
    for (const decision of decisions) {
      expect(decision.should_speak).toBe(true);
      expect(decision.template_id).not.toBeNull();
      expect(VOICE_TEMPLATE_IDS).toContain(decision.template_id as string);
      expect(templateById(decision.template_id as string)?.text).toBe(decision.message);
    }
  });

  it('is deterministic for identical input', () => {
    const first = observe(openNight([{ id: 'd-1', at: '2026-09-11T20:00:00.000Z', abvPercent: 40 }]));
    const second = observe(openNight([{ id: 'd-1', at: '2026-09-11T20:00:00.000Z', abvPercent: 40 }]));
    expect(second).toEqual(first);
  });

  it('stays silent for an event with nothing in it', () => {
    const context = contentContextFromSnapshot({
      snapshot: snapshotFromNights([]),
      event: 'SESSION_STARTED',
      capability: defaultPlanPort(),
    });
    const decision = observe(context);
    expect(decision.should_speak).toBe(false);
    expect(decision.model_signals).toEqual([]);
  });

  it('offers no way to ask the user a question or open a conversation', () => {
    expect(SPEECH_ACTS).not.toContain('ASK');
    const speaking: ContentDecision[] = [
      observe(openNight([{ id: 'd-1', at: '2026-09-11T20:00:00.000Z', abvPercent: 40 }])),
      observe(
        openNight([
          { id: 'd-1', at: '2026-09-11T20:00:00.000Z' },
          { id: 'd-2', at: '2026-09-11T20:10:00.000Z' },
        ]),
      ),
    ];
    for (const decision of speaking) {
      expect(decision.message ?? '').not.toMatch(/\?/);
      expect(decision.speech_act).not.toBe('ASK');
    }
  });

  it('keeps a lower priority from displacing a higher one when both exist', () => {
    // Five drinks inside two hours is both a rapid window (P0) and a fast-pace burst (P5).
    const decision = observe(
      openNight(
        Array.from({ length: 5 }, (_, index) => ({
          id: `d-${index + 1}`,
          at: new Date(Date.parse('2026-09-11T20:00:00.000Z') + index * 25 * 60_000).toISOString(),
        })),
      ),
    );
    expect(decision.priority).toBe('P0');
    expect(decision.speech_act).toBe('CARE');
    expect(decision.safety_level).toBe('HIGH');
    expect(decision.message).not.toMatch(/fast-forward|civilized/i);
  });

  it('strengthens language only as evidence allows', () => {
    const night = (index: number, day: string) => ({
      id: `history-${index}`,
      start: `${day}T20:00:00.000Z`,
      end: `${day}T22:00:00.000Z`,
      endReason: 'MANUAL' as const,
      drinks: [
        { id: `h${index}-1`, at: `${day}T20:00:00.000Z` },
        { id: `h${index}-2`, at: `${day}T20:45:00.000Z` },
      ],
      reports: [{ level: 2, observedAt: `${day}T20:45:00.000Z` }],
    });
    const snapshot = snapshotFromNights([
      night(1, '2026-08-01'),
      night(2, '2026-08-08'),
      {
        id: 'tonight',
        start: '2026-09-11T20:00:00.000Z',
        drinks: [
          { id: 'd-1', at: '2026-09-11T20:00:00.000Z' },
          { id: 'd-2', at: '2026-09-11T20:40:00.000Z' },
          { id: 'd-3', at: '2026-09-11T21:20:00.000Z' },
        ],
        reports: [{ level: 2, observedAt: '2026-09-11T20:10:00.000Z' }],
      },
    ]);
    const context: ContentContext = contentContextFromSnapshot({
      snapshot,
      event: 'STATE_REPORTED',
      capability: elevatedPlanPort(),
      sessionId: 'tonight',
      familiarity: 0.3,
      extras: { now: NOW },
    });
    const decision = observe(context);
    // Two prior nights are repetition, not a baseline: the wording must stay hedged.
    expect(decision.should_speak).toBe(true);
    expect(decision.evidence_level).toBe('REPEATED');
    expect(decision.message ?? '').not.toMatch(/usually|your usual|typically|your normal/i);
    expect(decision.message ?? '').toMatch(/so far|looks like|seems|maybe|might/i);
  });

  it('reads an open night through the real session context', () => {
    const snapshot = openNightSnapshot({
      id: 'tonight',
      start: '2026-09-11T20:00:00.000Z',
      drinks: [
        { id: 'd-1', at: '2026-09-11T20:00:00.000Z' },
        { id: 'd-2', at: '2026-09-11T20:12:00.000Z' },
      ],
    });
    const session = snapshot.consumer.sessions[0];
    const context = sessionContextFromTonightSession(session, { now: NOW });
    expect(context.drink_count).toBe(2);
    expect(context.last_gap_minutes).toBe(12);
    expect(context.fast_drink_count).toBe(1);
    expect(context.median_gap_minutes).toBe(12);
  });

  it('keeps a variant seed inside the frozen catalog and never changes the contract fields', () => {
    const base = observe(openNight([{ id: 'd-1', at: '2026-09-11T20:00:00.000Z', abvPercent: 40 }]));
    const seeded = observe({
      ...openNight([{ id: 'd-1', at: '2026-09-11T20:00:00.000Z', abvPercent: 40 }]),
      variant_seed: 1,
    });
    expect(seeded.priority).toBe(base.priority);
    expect(seeded.speech_act).toBe(base.speech_act);
    expect(VOICE_TEMPLATE_IDS).toContain(seeded.template_id as string);
    expect(claimStrength(seeded.message ?? '')).toBe(claimStrength(base.message ?? ''));
  });
});
