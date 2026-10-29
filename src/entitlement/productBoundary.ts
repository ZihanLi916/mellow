import type { ArchetypeId, FirstReadGate, StyleReading } from '../drinkingStyle/contracts';
import type { Entitlement } from './plans';
import { isCapabilityShipped } from './capabilities';
import { canAccessCapability } from './featureGate';
import { isWithheldFromV1, publicReading } from '../drinkingStyle/publicationPolicy';

/**
 * The v0.3 product boundary.
 *
 * One account-scoped statement of what is actually true for this person, so no surface has to guess a
 * subscription state, and so Free never accidentally receives the personal model or vice versa.
 *
 * The important separation: collecting raw data is not the same as learning a personal model.
 */
export const TONIGHT_MODELS = ['SYSTEM', 'PERSONAL'] as const;
export type TonightModel = (typeof TONIGHT_MODELS)[number];

export const PERSONALITY_SOURCES = ['NONE', 'FIRST_READ_SNAPSHOT', 'PERSONAL_MODEL', 'EXPIRED_PREMIUM_SNAPSHOT'] as const;
export type PersonalitySource = (typeof PERSONALITY_SOURCES)[number];

export const PERSONAL_MODEL_STATES = ['NEVER_STARTED', 'ACTIVE', 'FROZEN'] as const;
export type PersonalModelState = (typeof PERSONAL_MODEL_STATES)[number];

export const PREMIUM_ENTITLEMENT_STATES = ['ACTIVE', 'INACTIVE'] as const;
export type PremiumEntitlementState = (typeof PREMIUM_ENTITLEMENT_STATES)[number];

/** The personality a surface may show, and where it came from. */
export type VisiblePersonality = {
  source: PersonalitySource;
  archetype_id: ArchetypeId | null;
  still_mixing: boolean;
  /** True when this reading will not change as more nights are logged. */
  frozen: boolean;
  data_revision: number | null;
  generated_at: string | null;
  algorithm_version: string | null;
};

/** The minimal snapshot that survives a freeze (first read, or the end of a subscription). */
export type FrozenPersonality = {
  archetype_id: ArchetypeId | null;
  still_mixing: boolean;
  source_revision: number;
  data_revision: number;
  generated_at: string;
  algorithm_version: string;
  profile_version: string;
  prototype_version: string;
  /** Present for a subscription-end snapshot: the personal-model revision at the moment of freezing. */
  personal_model_revision: number | null;
  source: 'FIRST_READ' | 'SUBSCRIPTION_END';
};

export type ProductBoundary = {
  plan: Entitlement['plan'];
  tonight_model: TonightModel;
  personality_source: PersonalitySource;
  personal_model_state: PersonalModelState;
  premium_entitlement: PremiumEntitlementState;
  /** Raw collection is never a plan feature: it keeps running on every plan, including after expiry. */
  collects_raw_data: true;
  /** The personal model may only be built or updated while this is true. */
  may_update_personal_model: boolean;
  visible: {
    personality_label: boolean;
    personality_description: boolean;
    basic_share_card: boolean;
    dimensions: boolean;
    dimension_interpretation: boolean;
    subscores: boolean;
    evidence: boolean;
    supporting_traits: boolean;
    personality_evolution: boolean;
    personality_history: boolean;
    card_customization: boolean;
  };
  first_read: FirstReadGate | null;
  reasons: string[];
};

export type BoundaryInput = {
  entitlement: Entitlement;
  /** Whether the environment actually has an approved personal model to show. */
  personalModelAvailable: boolean;
  personalModelRevision: number | null;
  /** Non-null once a snapshot exists (first read published, or subscription ended). */
  frozenSnapshotRevision: number | null;
  /** Which kind of snapshot is stored, so Free-after-expiry is distinguishable from Free-first-read. */
  lastSnapshotSource: 'FIRST_READ' | 'SUBSCRIPTION_END' | null;
  /** True when the account has ever published a first read. */
  hasFirstRead: boolean;
  firstReadGate: FirstReadGate | null;
  asOf: string;
};

/** Whether this entitlement may use a personal learning model at all. Product code asks this, never a plan name. */
export function personalModelAllowed(entitlement: Entitlement): boolean {
  return canAccessCapability(entitlement, 'PERSONAL_DRINKING_MODEL');
}

/**
 * The single derivation every surface reads. Pure, account-scoped, no UI guessing.
 *
 * `premiumEntitlementWasActive` is carried separately from the current entitlement on purpose: after a
 * subscription ends the current entitlement is Free again, but the *last* premium snapshot is still the
 * honest visible identity. Without this flag the app could not tell "never subscribed" from "expired".
 */
export function productBoundary(input: BoundaryInput): ProductBoundary {
  const premium = personalModelAllowed(input.entitlement);
  const modelUsable = premium && input.personalModelAvailable;
  const snapshotSource = input.lastSnapshotSource;
  const reasons: string[] = [];
  let personalModelState: PersonalModelState;
  if (modelUsable) {
    personalModelState = 'ACTIVE';
    reasons.push('PERSONAL_MODEL_ACTIVE');
  } else if (snapshotSource === 'SUBSCRIPTION_END') {
    // A model existed and can no longer update. The last reading stands; nothing new trains it.
    personalModelState = 'FROZEN';
    reasons.push('SUBSCRIPTION_ENDED_MODEL_RETAINED_AND_FROZEN');
  } else {
    personalModelState = 'NEVER_STARTED';
    reasons.push(premium ? 'PERSONAL_MODEL_NOT_APPROVED_YET' : 'FREE_USES_THE_SYSTEM_MODEL_ONLY');
  }

  // A first-read snapshot is not a personal model, and it must never replace the live, evolving reading
  // for an account that is entitled to learn.
  const personalitySource: PersonalitySource = premium
    ? 'PERSONAL_MODEL'
    : input.hasFirstRead || input.frozenSnapshotRevision !== null
      ? snapshotSource === 'SUBSCRIPTION_END'
        ? 'EXPIRED_PREMIUM_SNAPSHOT'
        : 'FIRST_READ_SNAPSHOT'
      : 'NONE';

  const evolution = canAccessCapability(input.entitlement, 'PERSONALITY_EVOLUTION');
  const reveal = canAccessCapability(input.entitlement, 'BASIC_PERSONALITY_REVEAL') && input.hasFirstRead;
  return {
    plan: input.entitlement.plan,
    tonight_model: modelUsable ? 'PERSONAL' : 'SYSTEM',
    personality_source: personalitySource,
    personal_model_state: personalModelState,
    premium_entitlement: premium ? 'ACTIVE' : 'INACTIVE',
    collects_raw_data: true,
    may_update_personal_model: premium,
    visible: {
      personality_label: reveal,
      personality_description: reveal,
      basic_share_card: reveal,
      dimensions: canAccessCapability(input.entitlement, 'PERSONALITY_DIMENSIONS'),
      dimension_interpretation: canAccessCapability(input.entitlement, 'PERSONALITY_DIMENSIONS'),
      subscores: canAccessCapability(input.entitlement, 'PERSONALITY_EVIDENCE'),
      evidence: canAccessCapability(input.entitlement, 'PERSONALITY_EVIDENCE'),
      supporting_traits: canAccessCapability(input.entitlement, 'PERSONALITY_EVIDENCE'),
      personality_evolution: evolution,
      personality_history: evolution,
      card_customization: canAccessCapability(input.entitlement, 'PREMIUM_CARD_CUSTOMIZATION') && isCapabilityShipped('PREMIUM_CARD_CUSTOMIZATION'),
    },
    first_read: input.firstReadGate,
    reasons,
  };
}




/**
 * What a surface should render for the personality, given the boundary and the live reading.
 *
 * A frozen snapshot wins over the live reading on purpose: after the first read, Free keeps its
 * published identity even while raw logging continues.
 */
export function visiblePersonality(
  boundary: ProductBoundary,
  live: StyleReading,
  liveRevision: number,
  frozen: FrozenPersonality | null,
): VisiblePersonality {
  if (boundary.personality_source === 'FIRST_READ_SNAPSHOT' || boundary.personality_source === 'EXPIRED_PREMIUM_SNAPSHOT') {
    if (frozen) {
      return {
        source: boundary.personality_source,
        archetype_id: isWithheldFromV1(frozen.archetype_id) ? null : frozen.archetype_id,
        still_mixing: frozen.still_mixing || isWithheldFromV1(frozen.archetype_id),
        frozen: true,
        data_revision: frozen.source_revision,
        generated_at: frozen.generated_at,
        algorithm_version: frozen.algorithm_version,
      };
    }
  }
  const published = publicReading(live);
  return {
    source: boundary.personality_source === 'NONE' ? 'NONE' : 'PERSONAL_MODEL',
    archetype_id: published.archetype_id,
    still_mixing: published.kind === 'STILL_MIXING',
    frozen: false,
    data_revision: liveRevision,
    generated_at: null,
    algorithm_version: null,
  };
}

/** Snapshot versions recorded so a reading stays explainable after the algorithm moves on. */
export type SnapshotVersions = {
  algorithm_version: string;
  profile_version: string;
  prototype_version: string;
};

export function freezeFirstRead(
  reading: StyleReading,
  revisions: { sourceRevision: number; dataRevision: number },
  versions: SnapshotVersions,
  generatedAt: string,
): FrozenPersonality {
  return {
    archetype_id: reading.kind === 'ARCHETYPE' ? reading.archetype_id : null,
    still_mixing: reading.kind === 'STILL_MIXING',
    source_revision: revisions.sourceRevision,
    data_revision: revisions.dataRevision,
    generated_at: generatedAt,
    algorithm_version: versions.algorithm_version,
    profile_version: versions.profile_version,
    prototype_version: versions.prototype_version,
    personal_model_revision: null,
    source: 'FIRST_READ',
  };
}

/**
 * Replaces the stored snapshot when a subscription ends.
 *
 * The last legitimately generated reading wins: an expiry must not push the user back to their night-5
 * identity. When nothing was ever published, there is nothing to freeze and the previous snapshot stands.
 */
export function freezeOnExpiry(
  lastValid: { reading: StyleReading; dataRevision: number; personalModelRevision: number | null } | null,
  versions: SnapshotVersions,
  generatedAt: string,
): FrozenPersonality | null {
  if (!lastValid) return null;
  return {
    archetype_id: lastValid.reading.kind === 'ARCHETYPE' ? lastValid.reading.archetype_id : null,
    still_mixing: lastValid.reading.kind === 'STILL_MIXING',
    source_revision: lastValid.dataRevision,
    data_revision: lastValid.dataRevision,
    generated_at: generatedAt,
    algorithm_version: versions.algorithm_version,
    profile_version: versions.profile_version,
    prototype_version: versions.prototype_version,
    personal_model_revision: lastValid.personalModelRevision,
    source: 'SUBSCRIPTION_END',
  };
}

export type CatchUpPlan = {
  /** True when the model may be initialised from history the user already authorised. */
  must_not_start_from_zero: true;
  /** Objective nights already recorded that may be replayed into the personal model. */
  replay_revisions: number[];
  /** Nights since the subscription ended that were only collected as raw Free data. */
  gap_revisions: number[];
  /** Subjective labels cannot be invented for nights that never collected them. */
  fabricated_subjective_labels: false;
  /** Where the catch-up begins: a frozen snapshot, or the first recorded night. */
  starts_from: 'FROZEN_SNAPSHOT' | 'AUTHORISED_HISTORY';
};

/** Activation (or reactivation) never trains from zero: it replays data the user already recorded. */
export function catchUpPlan(
  frozen: FrozenPersonality | null,
  authorisedRevisions: readonly number[],
): CatchUpPlan {
  const sorted = [...authorisedRevisions].sort((a, b) => a - b);
  const gapRevisions = frozen ? sorted.filter((revision) => revision > frozen.data_revision) : [];
  return {
    must_not_start_from_zero: true,
    replay_revisions: sorted,
    gap_revisions: gapRevisions,
    fabricated_subjective_labels: false,
    starts_from: frozen && frozen.source === 'SUBSCRIPTION_END' ? 'FROZEN_SNAPSHOT' : 'AUTHORISED_HISTORY',
  };
}
