import { canAccessCapability } from './featureGate';
import type { Entitlement } from './plans';

/**
 * Which layer produced an estimate. The front end must never guess this: the estimate service
 * reports it, so the same card can honestly say "general estimates" for Free and "your personal
 * drinking history" for Premium.
 */
export const ESTIMATE_SOURCES = ['POPULATION', 'PERSONAL_MODEL'] as const;
export type EstimateSource = (typeof ESTIMATE_SOURCES)[number];

export const PERSONALIZATION_LEVELS = ['GENERAL', 'PARTIAL', 'PERSONALIZED'] as const;
export type PersonalizationLevel = (typeof PERSONALIZATION_LEVELS)[number];

export type EstimateAttribution = {
  estimateSource: EstimateSource;
  personalizationLevel: PersonalizationLevel;
  personalModelEnabled: boolean;
  explanation: string;
};

export type EstimateAttributionInput = {
  entitlement: Entitlement;
  /** True only when a personal-model estimate genuinely exists right now. */
  personalModelAvailable: boolean;
  /** True when limited personal inputs for this session exist (weight, food, reported feeling). */
  personalInputsAvailable: boolean;
};

/**
 * Personalization can only move upward. A missing or immature personal model falls back to the
 * population estimate; it never becomes worse than what Free already receives.
 */
export function estimateAttribution(input: EstimateAttributionInput): EstimateAttribution {
  const personalModelEnabled =
    canAccessCapability(input.entitlement, 'PERSONALIZED_INTOXICATION_ESTIMATE') &&
    input.personalModelAvailable;
  if (personalModelEnabled)
    return {
      estimateSource: 'PERSONAL_MODEL',
      personalizationLevel: 'PERSONALIZED',
      personalModelEnabled: true,
      explanation: 'Based on your personal drinking history.',
    };
  if (input.personalInputsAvailable)
    return {
      estimateSource: 'POPULATION',
      personalizationLevel: 'PARTIAL',
      personalModelEnabled: false,
      explanation: 'Based on general estimates, adjusted with the details you gave tonight.',
    };
  return {
    estimateSource: 'POPULATION',
    personalizationLevel: 'GENERAL',
    personalModelEnabled: false,
    explanation: 'Based on general estimates.',
  };
}
