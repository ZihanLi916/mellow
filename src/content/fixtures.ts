import { emptySnapshot, type AlphaSnapshot, type Report } from '../alpha/contracts';
import { confirmDrink, createConsumerState, endTonight, ensureTonight } from '../consumer/domain';
import type { SessionEndReason } from '../consumer/sessionLifecycle';
import { defaultEntitlement, developmentEntitlement, minimumPlanFor } from '../entitlement';
import { capabilityPortFromEntitlement } from './capability';
import { CONTEXTS, emptyNight, emptyProduct, type ProductState } from '../productV1/contracts';
import type { ContentCapabilityPort } from './contracts';

/**
 * Dataset fixtures.
 *
 * Scenarios are built through the real domain objects — the same `ensureTonight` / `confirmDrink` /
 * `endTonight` calls the product makes — so the Mellow Content Dataset v0.1 grades the engine
 * against genuine session state rather than hand-written context objects.
 */

export type DrinkSpec = {
  id: string;
  at: string;
  label?: string;
  category?: 'BEER' | 'WINE' | 'COCKTAIL' | 'SPIRITS' | 'OTHER' | 'UNKNOWN';
  abvPercent?: number | null;
  corrected?: boolean;
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type ReportSpec = { level: number; observedAt: string; kind?: 'DURING_NIGHT' | 'RETROSPECTIVE' };

export type NightSpec = {
  id: string;
  start: string;
  end?: string | null;
  endReason?: SessionEndReason | null;
  drinks?: readonly DrinkSpec[];
  food?: 'Ate' | 'A little' | 'Not yet' | null;
  context?: (typeof CONTEXTS)[number] | null;
  water?: readonly { id: string; timestamp: string }[];
  reports?: readonly ReportSpec[];
  timezoneOffsetMinutes?: number;
};

/**
 * A snapshot whose nights are real consumer sessions. Water and food live in the product state, and
 * state reports live in the alpha report list, exactly where the product stores them.
 */
export function snapshotFromNights(nights: readonly NightSpec[]): AlphaSnapshot {
  let consumer = createConsumerState();
  const reports: Report[] = [];
  const product: ProductState = emptyProduct();
  for (const night of nights) {
    const offset = night.timezoneOffsetMinutes ?? 0;
    consumer = ensureTonight(consumer, new Date(night.start), night.id, offset);
    for (const drink of night.drinks ?? []) {
      consumer = confirmDrink(consumer, {
        id: drink.id,
        confirmedAt: drink.at,
        label: drink.label ?? 'QA drink',
        category: drink.category ?? 'BEER',
        photoFingerprint: `photo-${drink.id}`,
        identitySource: drink.corrected ? 'USER_CORRECTED' : 'USER_CONFIRMED',
        recognitionVersion: 'qa-identity-v1',
        abvPercent: drink.abvPercent ?? 5,
        ...(drink.confidence
          ? {
              identityEvidence: {
                model: 'qa-vision-v1',
                confidence: drink.confidence,
                visibleEvidence: [],
                targetPosition: 'center',
              },
            }
          : {}),
      }).state;
    }
    product.nights[night.id] = {
      ...emptyNight(),
      food: night.food ?? null,
      context: night.context ?? null,
      water: (night.water ?? []).map((entry) => ({
        id: entry.id,
        timestamp: entry.timestamp,
        size: 'MEDIUM' as const,
        estimatedMl: 250,
      })),
      waterTracked: (night.water ?? []).length > 0,
    };
    night.reports?.forEach((report, index) => {
      reports.push({
        id: `${night.id}-report-${index}`,
        sessionId: night.id,
        kind: report.kind ?? 'DURING_NIGHT',
        level: report.level,
        observedAt: report.observedAt,
        recordedAt: report.observedAt,
        revision: 1,
        source: 'USER_SELF_REPORT',
        eligible: false,
      });
    });
    if (night.end) consumer = endTonight(consumer, new Date(night.end), night.endReason ?? 'MANUAL');
  }
  return { ...emptySnapshot(), product, consumer, reports };
}

/** A night that is still open, optionally with finished nights behind it. */
export function openNightSnapshot(active: NightSpec, history: readonly NightSpec[] = []): AlphaSnapshot {
  return snapshotFromNights([...history, { ...active, end: null, endReason: null }]);
}

/* ------------------------------------------------------------------------------------------------
 * Capability ports, built through the canonical entitlement layer.
 * ---------------------------------------------------------------------------------------------- */

/** What every real account holds today. */
export function defaultPlanPort(): ContentCapabilityPort {
  return capabilityPortFromEntitlement(defaultEntitlement('scenario-default'));
}

/**
 * A development simulation of the plan that carries personal-model capabilities. The plan value is
 * read from the capability table so this file never names a plan itself.
 */
export function elevatedPlanPort(): ContentCapabilityPort {
  return capabilityPortFromEntitlement(developmentEntitlement(minimumPlanFor('PERSONAL_BASELINE'), 'scenario-elevated'));
}
