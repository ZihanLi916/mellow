# Verification

Recorded on October 29, 2026 against this public source selection.

## Reproduce

Use Node.js 22.13 or later and pnpm 11:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
```

## Recorded results

- **36 tests passed across 5 test files.**
- **TypeScript type checking passed.**
- Checks run locally against the exported modules, without production credentials or a live backend.

| Original test file | Passed | Focus |
| --- | ---: | --- |
| `src/intake/normalized.test.ts` | 4 | Normalized intake contracts |
| `src/content/contentEngine.test.ts` | 9 | Feedback decisions |
| `src/content/voice.test.ts` | 10 | Voice rules |
| `src/content/safety.test.ts` | 8 | Safety priorities |
| `src/runtime/runtimeId.test.ts` | 5 | Runtime identity fallback |

These are existing project tests copied with the selected modules. They cover specific rules and boundaries, not every exported module or the full application.

## Export adaptation

`src/runtime/runtimeId.ts` narrows the type-only `getRandomValues` generic from `ArrayBufferView | null` to `ArrayBufferView` for this standalone TypeScript environment. Executable logic is unchanged. The original and exported hashes are recorded in [the source manifest](source-manifest.json).

## What this does not establish

The results do not establish live model/provider reliability, physical-device acceptance, deployed service integration, clinical accuracy, real-user outcomes, or App Store release. Website images demonstrate product presentation with illustrative records. Personal Model is an internal Premium preview.
