type RuntimeCrypto = {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
};

export interface RuntimeIdEnvironment {
  crypto?: RuntimeCrypto | null;
  now?: () => number;
  random?: () => number;
}

let fallbackCounter = 0;

const formatUuid = (bytes: Uint8Array) => {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const fallbackUuid = (now: () => number, random: () => number) => {
  fallbackCounter = (fallbackCounter + 1) >>> 0;
  const timeHex = Math.max(0, Math.floor(now())).toString(16).padStart(12, '0').slice(-12);
  const counterHex = fallbackCounter.toString(16).padStart(8, '0');
  const randomHex = Array.from({ length: 3 }, () =>
    Math.floor(Math.max(0, Math.min(0.9999999999999999, random())) * 0x1_0000_0000)
      .toString(16)
      .padStart(8, '0'),
  ).join('');
  const hex = `${timeHex}${counterHex}${randomHex}`.slice(0, 32).padEnd(32, '0').split('');
  hex[12] = '4';
  hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16], 16) & 3];
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
};

const runtimeCrypto = (): RuntimeCrypto | undefined => {
  try {
    return typeof globalThis.crypto === 'object' ? globalThis.crypto : undefined;
  } catch {
    return undefined;
  }
};

/** Local runtime identity only. This is not a security or authentication token. */
export function createRuntimeId(environment: RuntimeIdEnvironment = {}): string {
  const source = Object.prototype.hasOwnProperty.call(environment, 'crypto')
    ? environment.crypto ?? undefined
    : runtimeCrypto();

  if (typeof source?.randomUUID === 'function') {
    try {
      return source.randomUUID.call(source);
    } catch {
      // Some browsers expose the method but reject it outside a secure context.
    }
  }

  if (typeof source?.getRandomValues === 'function') {
    try {
      const bytes = new Uint8Array(16);
      source.getRandomValues.call(source, bytes);
      return formatUuid(bytes);
    } catch {
      // Continue to the non-security fallback below.
    }
  }

  return fallbackUuid(environment.now ?? Date.now, environment.random ?? Math.random);
}
