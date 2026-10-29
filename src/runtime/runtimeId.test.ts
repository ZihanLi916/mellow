import { describe, expect, it, vi } from 'vitest';
import { createRuntimeId } from './runtimeId';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('createRuntimeId', () => {
  it('uses native crypto.randomUUID when available', () => {
    const nativeId = '11111111-1111-4111-8111-111111111111';
    const randomUUID = vi.fn(() => nativeId);
    expect(createRuntimeId({ crypto: { randomUUID } })).toBe(nativeId);
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('uses getRandomValues when randomUUID is explicitly undefined', () => {
    const getRandomValues = vi.fn(<T extends ArrayBufferView | null>(array: T) => {
      (array as Uint8Array).fill(0x2a);
      return array;
    });
    expect(createRuntimeId({ crypto: { randomUUID: undefined, getRandomValues } })).toMatch(UUID_V4);
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it('uses getRandomValues when that is the only crypto capability', () => {
    let value = 0;
    const getRandomValues = <T extends ArrayBufferView | null>(array: T) => {
      (array as Uint8Array).forEach((_, index, bytes) => { bytes[index] = value += 1; });
      return array;
    };
    expect(createRuntimeId({ crypto: { getRandomValues } })).toMatch(UUID_V4);
  });

  it('falls back safely in a reduced non-secure environment', () => {
    const options = { crypto: null, now: () => 1_725_000_000_000, random: () => 0.25 } as const;
    const first = createRuntimeId(options);
    const second = createRuntimeId(options);
    expect(first).toMatch(UUID_V4);
    expect(second).toMatch(UUID_V4);
    expect(second).not.toBe(first);
  });

  it('falls through when an exposed native method throws', () => {
    const getRandomValues = <T extends ArrayBufferView | null>(array: T) => {
      (array as Uint8Array).fill(7);
      return array;
    };
    expect(createRuntimeId({ crypto: { randomUUID: () => { throw new Error('insecure'); }, getRandomValues } })).toMatch(UUID_V4);
  });
});
