export type Expression =
  | "neutral"
  | "smug"
  | "surprised"
  | "side-eye"
  | "soft"
  | "thinking";

export type ReactionEvent =
  | "first-drink"
  | "repeat-drink"
  | "new-drink"
  | "uncertain"
  | "correction"
  | "game-good"
  | "game-miss"
  | "perfect-pour"
  | "return"
  | "late-night"
  | "care"
  | "self-report"
  | "estimate-rise"
  | "estimate-stable"
  | "felt-less"
  | "felt-more";

export interface ReactionLine {
  id: string;
  event: ReactionEvent;
  text: string;
  expression: Expression;
  weight: number;
  rare: boolean;
  locale: "en";
  cooldownMs: number;
}

export interface ReactionHistoryEntry {
  id: string;
  at: number;
}

export type ReactionHistory = ReactionHistoryEntry[];

const REACTION_LIBRARY: readonly ReactionLine[] = [
  // first-drink
  {
    id: "fd-1",
    event: "first-drink",
    text: "Noted.",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "fd-2",
    event: "first-drink",
    text: "I’ll keep that here.",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "fd-3",
    event: "first-drink",
    text: "A little context.",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },

  // repeat-drink
  {
    id: "rd-1",
    event: "repeat-drink",
    text: "Familiar face.",
    expression: "side-eye",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "rd-2",
    event: "repeat-drink",
    text: "I remember that one.",
    expression: "side-eye",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "rd-3",
    event: "repeat-drink",
    text: "I stopped asking.",
    expression: "side-eye",
    weight: 0.4,
    rare: true,
    locale: "en",
    cooldownMs: 86400000,
  },

  // new-drink
  {
    id: "nd-1",
    event: "new-drink",
    text: "A plot twist.",
    expression: "thinking",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "nd-2",
    event: "new-drink",
    text: "That’s new here.",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "nd-3",
    event: "new-drink",
    text: "Interesting choice.",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },

  // uncertain
  {
    id: "un-1",
    event: "uncertain",
    text: "A closer look?",
    expression: "thinking",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "un-2",
    event: "uncertain",
    text: "I’m not quite sure.",
    expression: "thinking",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "un-3",
    event: "uncertain",
    text: "Help a cat out.",
    expression: "thinking",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },

  // correction
  {
    id: "co-1",
    event: "correction",
    text: "Fair correction.",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "co-2",
    event: "correction",
    text: "My mistake.",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "co-3",
    event: "correction",
    text: "That makes more sense.",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },

  // game-good
  {
    id: "gg-1",
    event: "game-good",
    text: "Nicely done.",
    expression: "smug",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "gg-2",
    event: "game-good",
    text: "Well played.",
    expression: "smug",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "gg-3",
    event: "game-good",
    text: "…Show-off.",
    expression: "smug",
    weight: 0.4,
    rare: true,
    locale: "en",
    cooldownMs: 86400000,
  },

  // game-miss
  {
    id: "gm-1",
    event: "game-miss",
    text: "The table saw nothing.",
    expression: "side-eye",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "gm-2",
    event: "game-miss",
    text: "Not quite.",
    expression: "side-eye",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "gm-3",
    event: "game-miss",
    text: "That card had plans.",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },

  // perfect-pour
  {
    id: "pp-1",
    event: "perfect-pour",
    text: "Right on the line.",
    expression: "smug",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "pp-2",
    event: "perfect-pour",
    text: "A neat finish.",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "pp-3",
    event: "perfect-pour",
    text: "…Show-off.",
    expression: "smug",
    weight: 0.4,
    rare: true,
    locale: "en",
    cooldownMs: 86400000,
  },

  // return
  {
    id: "re-1",
    event: "return",
    text: "Kept your seat.",
    expression: "soft",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "re-2",
    event: "return",
    text: "Back again?",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "re-3",
    event: "return",
    text: "There you are.",
    expression: "soft",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },

  // late-night
  {
    id: "ln-1",
    event: "late-night",
    text: "Still up?",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "ln-2",
    event: "late-night",
    text: "Quiet out there.",
    expression: "thinking",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "ln-3",
    event: "late-night",
    text: "Long evening?",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },

  // care
  {
    id: "ca-1",
    event: "care",
    text: "No rush.",
    expression: "soft",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "ca-2",
    event: "care",
    text: "Water?",
    expression: "soft",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "ca-3",
    event: "care",
    text: "Grab a bite?",
    expression: "soft",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },

  // self-report
  {
    id: "sr-1",
    event: "self-report",
    text: "I hear you.",
    expression: "soft",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "sr-2",
    event: "self-report",
    text: "Noted.",
    expression: "soft",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "sr-3",
    event: "self-report",
    text: "Thanks for telling me.",
    expression: "soft",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },

  // estimate-rise
  {
    id: "er-1",
    event: "estimate-rise",
    text: "Let’s take this slowly.",
    expression: "thinking",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "er-2",
    event: "estimate-rise",
    text: "A change worth noticing.",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "er-3",
    event: "estimate-rise",
    text: "No rush.",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },

  // estimate-stable
  {
    id: "es-1",
    event: "estimate-stable",
    text: "Taking it slowly.",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "es-2",
    event: "estimate-stable",
    text: "A quiet moment.",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "es-3",
    event: "estimate-stable",
    text: "I’m here.",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },

  // felt-less
  {
    id: "fl-1",
    event: "felt-less",
    text: "Two different signals.",
    expression: "soft",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "fl-2",
    event: "felt-less",
    text: "Your feeling is noted.",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "fl-3",
    event: "felt-less",
    text: "Still, no rush.",
    expression: "thinking",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },

  // felt-more
  {
    id: "fm-1",
    event: "felt-more",
    text: "I hear you.",
    expression: "soft",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "fm-2",
    event: "felt-more",
    text: "Let’s take a moment.",
    expression: "neutral",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
  {
    id: "fm-3",
    event: "felt-more",
    text: "I’m here.",
    expression: "thinking",
    weight: 1,
    rare: false,
    locale: "en",
    cooldownMs: 600000,
  },
] as const;

export const REACTIONS: ReadonlyArray<ReactionLine> = REACTION_LIBRARY;

const GLOBAL_COOLDOWN_MS = 8000;
const RECENT_EXCLUSION_COUNT = 8;
const SILENCE_PROBABILITY = 0.25;
const RARE_GATE = 0.025;

export function chooseReaction(
  event: ReactionEvent,
  history: ReactionHistory = [],
  now: number = Date.now(),
  random: () => number = Math.random,
  enabled: boolean = true,
): ReactionLine | null {
  if (!enabled) {
    return null;
  }

  // Clamp random to [0,1) deterministically
  const clampedRandom = (): number => {
    const value = random();
    if (Number.isNaN(value)) {
      return 0;
    }
    return Math.min(0.9999999999999999, Math.max(0, value));
  };

  // Global 8-second cooldown: if any reaction within 8000ms of now, silence
  if (
    history.some(
      (entry) => now - entry.at < GLOBAL_COOLDOWN_MS && entry.at <= now,
    )
  ) {
    return null;
  }

  // Silence chance (25%)
  if (clampedRandom() < SILENCE_PROBABILITY) {
    return null;
  }

  // Filter reactions for the event
  let candidates = REACTION_LIBRARY.filter((line) => line.event === event);

  if (candidates.length === 0) {
    return null;
  }

  // Exclude recent IDs (last 8 history entries)
  const recentIds = new Set(
    history.slice(-RECENT_EXCLUSION_COUNT).map((entry) => entry.id),
  );
  candidates = candidates.filter((line) => !recentIds.has(line.id));

  if (candidates.length === 0) {
    return null;
  }

  // Per-line cooldown
  candidates = candidates.filter((line) => {
    const lastOccurrence = history.reduce((latest, entry) => {
      if (entry.id === line.id && entry.at > latest) {
        return entry.at;
      }
      return latest;
    }, -Infinity);
    if (lastOccurrence === -Infinity) {
      return true;
    }
    return now - lastOccurrence >= line.cooldownMs;
  });

  if (candidates.length === 0) {
    return null;
  }

  // Rare gate: if a rare line, require random <= 0.025; non-rare always pass
  candidates = candidates.filter((line) => {
    if (line.rare) {
      return clampedRandom() <= RARE_GATE;
    }
    return true;
  });

  if (candidates.length === 0) {
    return null;
  }

  // Weighted random selection
  const totalWeight = candidates.reduce((sum, line) => sum + line.weight, 0);
  if (totalWeight <= 0) {
    return null;
  }

  let roll = clampedRandom() * totalWeight;
  for (const line of candidates) {
    roll -= line.weight;
    if (roll <= 0) {
      return line;
    }
  }

  // Fallback: return last candidate (rare floating point edge)
  return candidates[candidates.length - 1];
}
