import type { ArchetypeId, StyleReading } from './contracts';

/** V1 publication policy only. All eight prototypes and their scores remain intact. */
export const V1_PUBLIC_ARCHETYPES = [
  'THE_RITUALIST', 'THE_EXPLORER', 'THE_CRUISER', 'THE_RISER',
  'THE_SOCIAL_SHIFTER', 'THE_TAPER', 'THE_METRONOME',
] as const satisfies readonly ArchetypeId[];

export function isWithheldFromV1(id: ArchetypeId | null): boolean {
  return id === 'THE_FREEFORM';
}

export function publicReading(reading: StyleReading): StyleReading {
  return reading.kind === 'ARCHETYPE' && isWithheldFromV1(reading.archetype_id)
    ? { kind: 'STILL_MIXING', archetype_id: null, status: 'EARLY_READ', reasons: ['WITHHELD_FROM_V1_PUBLICATION'] }
    : reading;
}
