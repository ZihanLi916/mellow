export const MEMORY_PROTOCOL_VERSION = 'memory-v0' as const;
export const TEMPORAL_PROTOCOL_VERSION = 'temporal-v0' as const;
export const MOTOR_PROTOCOL_VERSION = 'motor-v0' as const;

export type MemoryGameId = 'MELLOW_MIX' | 'THREE_CARDS' | 'MELLOW_STOLE_IT';
export type TemporalGameId = 'OPPOSITE_CAT' | 'PERFECT_POUR' | 'FOLLOW_THE_PATH';
export type MotorGameId = 'DONT_SPILL' | 'BLOW_BALL' | 'ICE_CUTTING';
export type GameId = MemoryGameId | TemporalGameId | MotorGameId;
export type GameDomain = 'MEMORY' | 'TEMPORAL' | 'MOTOR';
export const MELLOW_MIX_PROTOCOL_VERSION = 'mellow-mix-visual-v2' as const;
export const THREE_CARDS_SWAP_PROTOCOL_VERSION = 'three-cards-symbols-v2' as const;
export const PERFECT_POUR_PROTOCOL_VERSION = 'perfect-pour-flow-v1' as const;
export const OPPOSITE_CAT_PROTOCOL_VERSION = 'opposite-cat-swipe-only-v2' as const;
export const BLOW_BALL_PROTOCOL_VERSION = 'blow-ball-flight-v2' as const;
export const DONT_SPILL_PROTOCOL_VERSION = 'dont-spill-neutral-v1' as const;

export type GameProtocolVersion =
  | typeof MEMORY_PROTOCOL_VERSION
  | typeof TEMPORAL_PROTOCOL_VERSION
  | typeof MOTOR_PROTOCOL_VERSION
  | 'mellow-mix-ingredients-v1' | 'three-cards-swap-v1' | 'blow-ball-landing-v1'
  | typeof MELLOW_MIX_PROTOCOL_VERSION
  | typeof THREE_CARDS_SWAP_PROTOCOL_VERSION
  | typeof PERFECT_POUR_PROTOCOL_VERSION
  | typeof OPPOSITE_CAT_PROTOCOL_VERSION
  | 'opposite-cat-swipe-v1'
  | typeof BLOW_BALL_PROTOCOL_VERSION
  | typeof DONT_SPILL_PROTOCOL_VERSION;

export interface GameResult<
  TTrial extends object = Record<string, unknown>,
  TSummary extends object = Record<string, unknown>,
> {
  gameId: GameId;
  domain: GameDomain;
  protocolVersion: GameProtocolVersion;
  startedAt: string;
  completedAt: string;
  valid: boolean;
  trials: TTrial[];
  summaryMetrics: TSummary;
}

export type CreateGameResultInput<TTrial extends object, TSummary extends object> = Omit<
  GameResult<TTrial, TSummary>,
  'domain' | 'protocolVersion'
>;

export function createMemoryGameResult<TTrial extends object, TSummary extends object>(
  input: Omit<CreateGameResultInput<TTrial, TSummary>, 'gameId'> & { gameId: MemoryGameId },
): GameResult<TTrial, TSummary> {
  return createDomainGameResult(input, 'MEMORY', MEMORY_PROTOCOL_VERSION);
}

export function createTemporalGameResult<TTrial extends object, TSummary extends object>(
  input: Omit<CreateGameResultInput<TTrial, TSummary>, 'gameId'> & { gameId: TemporalGameId },
): GameResult<TTrial, TSummary> {
  return createDomainGameResult(input, 'TEMPORAL', TEMPORAL_PROTOCOL_VERSION);
}

export function createMotorGameResult<TTrial extends object, TSummary extends object>(
  input: Omit<CreateGameResultInput<TTrial, TSummary>, 'gameId'> & { gameId: MotorGameId },
): GameResult<TTrial, TSummary> {
  return createDomainGameResult(input, 'MOTOR', MOTOR_PROTOCOL_VERSION);
}

function createDomainGameResult<TTrial extends object, TSummary extends object>(
  input: CreateGameResultInput<TTrial, TSummary>,
  domain: GameDomain,
  protocolVersion: GameProtocolVersion,
): GameResult<TTrial, TSummary> {
  if (Date.parse(input.completedAt) < Date.parse(input.startedAt)) {
    throw new Error('completedAt must not precede startedAt');
  }
  return { ...input, domain, protocolVersion };
}
