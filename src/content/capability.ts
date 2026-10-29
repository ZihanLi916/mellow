import {
  canAccessCapability,
  capabilityAllowed,
  describeAccess,
  type Capability,
  type Entitlement,
  type EntitlementSummary,
} from '../entitlement';
import type { ContentCapabilityPort } from './contracts';

/**
 * The content engine's only door to access control.
 *
 * The engine asks "may I read this capability?" and nothing else. It never imports a plan, never
 * compares plan strings and never decides what a plan means. Every answer comes from
 * `src/entitlement`, so a future store adapter changes what users own without touching content.
 */

/**
 * Capabilities whose algorithm does not exist yet. They are declared `SCHEMA_ONLY` by the
 * entitlement layer precisely so that nothing reports a value for them. The content engine refuses
 * to read them even when a plan would allow the capability, which is what stops it from ever
 * inventing a personal-model confidence number (spec §27).
 */
export const UNREADABLE_CAPABILITIES: readonly Capability[] = ['PERSONAL_MODEL_CONFIDENCE'];

function mayRead(canAccess: (capability: Capability) => boolean, capability: Capability): boolean {
  if (UNREADABLE_CAPABILITIES.includes(capability)) return false;
  return canAccess(capability);
}

/** Port over an already-resolved entitlement, for server-side use. */
export function capabilityPortFromEntitlement(entitlement: Entitlement): ContentCapabilityPort {
  return { canRead: (capability) => mayRead((value) => canAccessCapability(entitlement, value), capability) };
}

/**
 * Port over the wire summary. The client never re-derives plan rules; it asks whether the
 * server-resolved capability list contains the capability.
 */
export function capabilityPortFromSummary(summary: EntitlementSummary): ContentCapabilityPort {
  return { canRead: (capability) => mayRead((value) => capabilityAllowed(summary, value), capability) };
}

/** Full disclosure for a locked reaction, so a caller can explain itself without judging plans. */
export function capabilityDecision(entitlement: Entitlement, capability: Capability) {
  return describeAccess(entitlement, capability);
}
