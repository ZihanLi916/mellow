import { describe, expect, it } from 'vitest';
import { contentContextFromSnapshot } from './adapt';
import { FACT_KINDS } from './contracts';
import { STABLE_MARKERS, claimStrength, evidenceFromNights } from './evidence';
import { defaultPlanPort, openNightSnapshot } from './fixtures';
import { buildInsight } from './insight';
import { FACT_KIND_SPEC, generalizes } from './taxonomy';
import {
  VOICE_TEMPLATES,
  VOICE_TEMPLATE_IDS,
  auditCatalog,
  renderFor,
  renderInsight,
  selectTemplate,
  templatesFor,
} from './voice';
import { hardViolations } from './voice/rules';
import { templateClaim } from './voice/template';

/** The voice layer: a closed catalog of reviewed sentences, and nothing else. */

describe('Mellow voice catalog', () => {
  it('has frozen wording for every fact kind the engine can produce', () => {
    for (const kind of FACT_KINDS) {
      expect(templatesFor(kind).length, kind).toBeGreaterThan(0);
    }
  });

  it('keeps template identifiers unique and every template grounded in declared facts', () => {
    expect(new Set(VOICE_TEMPLATE_IDS).size).toBe(VOICE_TEMPLATE_IDS.length);
    for (const template of VOICE_TEMPLATES) {
      expect(template.factKeys.length, template.id).toBeGreaterThan(0);
      if (template.requiresFactTrue) expect(template.factKeys, template.id).toContain(template.requiresFactTrue);
      expect(template.generalization, template.id).toBe(generalizes(template.factKind));
    }
  });

  it('never lets a concrete tonight line claim a baseline', () => {
    for (const template of VOICE_TEMPLATES) {
      if (!template.generalization) {
        for (const marker of STABLE_MARKERS) expect(marker.test(template.text), `${template.id} ${marker}`).toBe(false);
      }
    }
  });

  it('passes its own style audit for every frozen line', () => {
    for (const entry of auditCatalog()) {
      expect(hardViolations(entry.violations), entry.id).toEqual([]);
      expect(entry.words, entry.id).toBeLessThanOrEqual(40);
    }
  });

  it('reads the wording strength off the text rather than trusting a declaration', () => {
    const stable = VOICE_TEMPLATES.find((template) => template.id === 'tonight-state-earlier-stable');
    const weak = VOICE_TEMPLATES.find((template) => template.id === 'tonight-state-earlier-weak');
    expect(stable && templateClaim(stable)).toBe('STABLE');
    expect(weak && templateClaim(weak)).toBe('WEAK');
  });

  it('refuses to render a baseline claim while the evidence is weak', () => {
    const insight = buildInsight({
      factKind: 'STATE_EARLIER_THAN_USUAL',
      personalized: true,
      historicalEvidence: evidenceFromNights(1),
      currentFact: { 'session.minutes_to_reported_state': 20, 'baseline.typical_buzz_onset_minutes': 45 },
    });
    const rendered = renderFor(insight, { band: 'LEARNING', safety: 'NORMAL', seed: 0 });
    expect(rendered?.message).toBeTruthy();
    expect(claimStrength(rendered?.message ?? '')).not.toBe('STABLE');
    expect(rendered?.message ?? '').not.toMatch(/usually|your usual|typically|your normal/i);
  });

  it('returns nothing rather than a weaker sentence when the reader has no history at all', () => {
    const insight = buildInsight({
      factKind: 'PATTERN_SECOND_OCCURRENCE',
      personalized: true,
      historicalEvidence: evidenceFromNights(2),
      currentFact: { 'pattern.nights': 2, 'pattern.key': 'EMPTY_STOMACH_FAST_PACE' },
    });
    expect(renderFor(insight, { band: 'STRANGER', safety: 'NORMAL', seed: 0 })).toBeNull();
    expect(selectTemplate(insight, { band: 'STRANGER', safety: 'NORMAL', seed: 0 })).toBeNull();
  });

  it('drops the joke entirely once the night is a high-risk one', () => {
    const insight = buildInsight({ factKind: 'PACE_BURST_THIRD', safetyLevel: 'HIGH' });
    const rendered = renderInsight(insight, {
      band: 'FAMILIAR',
      safety: 'HIGH',
      seed: 0,
      speechAct: FACT_KIND_SPEC.PACE_BURST_THIRD.speechAct,
    });
    expect(rendered).toBeNull();
  });

  it('only uses a fact-conditioned sentence when the fact is true', () => {
    const withoutPickup = buildInsight({
      factKind: 'RECAP_OVER_PLAN',
      currentFact: {
        'session.drink_count': 5,
        'intention.planned_drinks': 3,
        'session.second_half_heavier': false,
      },
    });
    const withPickup = buildInsight({
      factKind: 'RECAP_OVER_PLAN',
      currentFact: {
        'session.drink_count': 6,
        'intention.planned_drinks': 4,
        'session.second_half_heavier': true,
      },
    });
    expect(renderFor(withoutPickup, { band: 'STRANGER', safety: 'NORMAL', seed: 0 })?.message).toBe(
      'Ended up heavier than you planned.',
    );
    expect(renderFor(withPickup, { band: 'STRANGER', safety: 'NORMAL', seed: 0 })?.message).toBe(
      'Ended up heavier than you planned. The pace picked up most in the second half.',
    );
  });

  it('reads the tonight context through the real adapter before rendering', () => {
    const snapshot = openNightSnapshot({
      id: 'tonight',
      start: '2026-09-11T20:00:00.000Z',
      drinks: [
        { id: 'd-1', at: '2026-09-11T20:00:00.000Z' },
        { id: 'd-2', at: '2026-09-11T20:06:00.000Z' },
        { id: 'd-3', at: '2026-09-11T20:12:00.000Z' },
      ],
    });
    const context = contentContextFromSnapshot({
      snapshot,
      event: 'DRINK_LOGGED',
      capability: defaultPlanPort(),
      sessionId: 'tonight',
      extras: { now: '2026-09-11T21:00:00.000Z' },
    });
    expect(context.session?.drink_count).toBe(3);
  });
});

