import { describe, expect, it } from 'vitest';
import { contentContextFromSnapshot } from './adapt';
import { RAPID_WINDOW } from './contracts';
import { defaultPlanPort, openNightSnapshot, snapshotFromNights } from './fixtures';
import { assessSafety, maxDrinksWithin, safetyInsights } from './safety';
import { evaluate, observe } from './shouldSpeak';
import { allowedTones, VOICE_RULES } from './voice/rules';

/** Safety: independent of the cat voice, independent of what the user owns, and always first. */

const NOW = '2026-09-11T22:00:00.000Z';

function nightWith(drinkCount: number, gapMinutes: number, extras: Record<string, unknown> = {}) {
  const snapshot = openNightSnapshot({
    id: 'tonight',
    start: '2026-09-11T20:00:00.000Z',
    drinks: Array.from({ length: drinkCount }, (_, index) => ({
      id: `d-${index + 1}`,
      at: new Date(Date.parse('2026-09-11T20:00:00.000Z') + index * gapMinutes * 60_000).toISOString(),
    })),
  });
  return contentContextFromSnapshot({
    snapshot,
    event: 'DRINK_LOGGED',
    capability: defaultPlanPort(),
    sessionId: 'tonight',
    extras: { now: NOW, ...extras },
  });
}

function contextWithVeryHeavyReport() {
  const snapshot = snapshotFromNights([
    {
      id: 'reported',
      start: '2026-09-11T20:00:00.000Z',
      end: null,
      endReason: null,
      drinks: [
        { id: 'r-1', at: '2026-09-11T20:00:00.000Z' },
        { id: 'r-2', at: '2026-09-11T20:40:00.000Z' },
      ],
      reports: [{ level: 4, observedAt: '2026-09-11T21:30:00.000Z' }],
    },
  ]);
  return contentContextFromSnapshot({
    snapshot,
    event: 'STATE_REPORTED',
    capability: defaultPlanPort(),
    sessionId: 'reported',
    extras: { now: NOW },
  });
}

describe('safety evaluation', () => {
  it('counts drinks inside a real trailing window', () => {
    const times = [
      '2026-09-11T20:00:00.000Z',
      '2026-09-11T20:30:00.000Z',
      '2026-09-11T21:00:00.000Z',
      '2026-09-11T23:00:00.000Z',
    ];
    // The window boundary is inclusive, which is the conservative reading for a risk signal.
    expect(maxDrinksWithin(times, 60)).toBe(3);
    expect(maxDrinksWithin(times, 120)).toBe(3);
    expect(maxDrinksWithin(times, 240)).toBe(4);
    expect(maxDrinksWithin(times, 59)).toBe(2);
  });

  it('escalates with the intake inside the window, not with opinion', () => {
    expect(assessSafety(nightWith(4, 35).session!).level).toBe('ELEVATED');
    expect(assessSafety(nightWith(5, 25).session!).level).toBe('HIGH');
    expect(assessSafety(nightWith(4, 18).session!).level).toBe('HIGH');
    expect(assessSafety(nightWith(8, 15).session!).level).toBe('CRITICAL');
    expect(RAPID_WINDOW.ELEVATED_DRINKS).toBe(4);
  });

  it('treats a declared drive and a very heavy self-report as critical', () => {
    expect(assessSafety(nightWith(2, 40, { drivingDeclared: true }).session!).level).toBe('CRITICAL');
    expect(assessSafety(contextWithVeryHeavyReport().session).level).toBe('CRITICAL');
  });

  it('always outranks the personality line for the same night', () => {
    const context = nightWith(5, 12);
    const evaluation = evaluate(context);
    // Both candidates exist, so the suppression is genuine arbitration and not an accident.
    expect(evaluation.insights.map((insight) => insight.priority)).toContain('P5');
    const decision = observe(context);
    expect(decision.priority).toBe('P0');
    expect(decision.speech_act).toBe('CARE');
    expect(decision.message).toBe('That’s a lot in a short window. Slow down and stay put.');
    expect(decision.safety_level).toBe('HIGH');
  });

  it('removes humour from the vocabulary before the risk is real', () => {
    for (const level of ['HIGH', 'CRITICAL'] as const) {
      expect(allowedTones(level)).not.toContain('DRY');
      expect(allowedTones(level)).not.toContain('PLAYFUL');
    }
    expect(allowedTones('ELEVATED')).toContain('DRY');
    expect(allowedTones('NORMAL')).toContain('PLAYFUL');
    expect(VOICE_RULES.tonesBySafety.NORMAL.length).toBeGreaterThan(VOICE_RULES.tonesBySafety.HIGH.length);
  });

  it('never states that a night was safe to drive', () => {
    const decision = observe(nightWith(2, 40, { drivingDeclared: true }));
    expect(decision.message).toBe('Don’t drive tonight.');
    expect(decision.message ?? '').not.toMatch(/\bsafe\b|fine to drive|okay to drive|\bsober\b/i);
  });

  it('produces safety candidates without consulting any capability', () => {
    const session = nightWith(5, 25).session!;
    const insights = safetyInsights(session, assessSafety(session));
    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) expect(insight.capability).toMatch(/^SAFETY_/);
  });

  it('stays silent about an ordinary night without pretending it was safe', () => {
    const decision = observe(nightWith(3, 40));
    expect(decision.should_speak).toBe(false);
    expect(decision.message).toBeNull();
    expect(decision.safety_level).toBe('NORMAL');
  });
});

