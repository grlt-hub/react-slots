# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@grlt-hub/react-slots` v4 — a slot system for React (named extension points where plugins inject components). Effector-free rewrite (branch `4.0.0`): the only runtime dependency is `use-sync-external-store`, the only peer is `react >=16.8.0 <20.0.0`. Toolchain, monorepo layout, and code style mirror the sibling project `@grlt-hub/app-compose`.

## Monorepo layout

pnpm workspace (`packages/*`), structured like app-compose:

- **Root** — private `@grlt-hub/react-slots-dev`: shared toolchain in devDependencies (typescript, tsdown, vitest, knip, oxlint, oxfmt), base `tsconfig.json`, `.oxfmtrc.json`, scripts delegate via `pnpm -r`.
- **`packages/react-slots`** — the published library: own runtime/peer deps plus package-specific devDeps (react, react-dom, happy-dom, @types/\*), own `tsconfig.json` (extends root), `tsdown.config.ts`, `vitest.config.ts`, `knip.json`, `.oxlintrc.json`, README, CHANGELOG.

## Commands

All from the repo root:

```sh
pnpm build        # per package: tsc --noEmit + tsdown (esm + cjs + dts into dist/)
pnpm lint         # per package: knip (dead code/deps) + oxlint ./src
pnpm fmt          # oxfmt --write . (root-level, formats everything)
pnpm test         # per package: vitest run (runtime tests + type tests via typecheck)

pnpm -C packages/react-slots exec vitest run src/__tests__/store.test.ts   # single test file
pnpm -C packages/react-slots exec vitest run -t "insert respects order"    # single test by name
```

`pnpm build && pnpm lint && pnpm test` must be green before any handoff. `prepack` runs the build automatically on publish; releases are CI-driven, never manual.

Package manager is pnpm (pinned via `packageManager`). pnpm settings live in `pnpm-workspace.yaml` (`minimumReleaseAge: 4320` — new package versions younger than 3 days won't install). Gotcha: **optional** deps blocked by that gate (platform binaries like `@rolldown/*`) are skipped *silently* and surface later as "Cannot find native binding" — fix via `minimumReleaseAgeExclude`, don't lower the gate. Current excludes are temporary (safe to drop after 2026-06-07).

Knip quirks in the workspace: shared binaries/deps live at root, so the package `knip.json` needs `ignoreBinaries` and `ignoreDependencies: ["vitest"]`; config files are covered by `ignore: ["*.config.ts"]` (same as app-compose).

## Architecture

Three layers in `packages/react-slots/src/` (paths below are relative to the package), each one file, dependencies point strictly downward:

```
payload.ts      types only: Payload<T> insert signatures, NormalizedProps, EmptyObject
createSlot.tsx  adapter: createSlot<T>() → { Root, api: { insert, clear } }
store.ts        core: createStore — persistent sorted list + Set of listeners;
                plus useStore — useSyncExternalStore shim bridge (3rd arg = SSR snapshot)
insertSorted.ts pure upper-bound insert into a sorted immutable list
```

### Core contracts (store.ts) — every line is load-bearing for React

These invariants exist because `useSyncExternalStore` compares snapshots with `Object.is` and requires `getSnapshot` results to be cached. Breaking any of them causes infinite render loops, stale UIs, or phantom re-renders — and they're all pinned by tests in `store.test.ts`:

- `get()` returns the same reference between mutations; every mutation produces a new array (copy-on-write via `insertSorted`).
- Empty state is the single shared `EMPTY` constant (initial and after `clear`).
- `clear()` on an empty store is a no-op and does **not** notify.
- Sorting is stable: equal `order` (default 0) keeps insertion order — `findIndex` with strict `>` is the upper-bound that guarantees it.
- `notify` is synchronous and 1:1 with mutations. Do not batch (React 18+ auto-batches; planned observability hooks rely on 1:1).

`toSpliced` in `insertSorted.ts` is deliberate: runtime floor is ES2023 (Node 20+ / Safari 16.4+ / Chrome 110+); tsconfig/tsdown targets are aligned to it.

### Adapter rules (createSlot.tsx) — performance-first, by explicit owner instruction

- The child `memo` wrapper is created **once at insert-time**, never inside render. (3.x created it in render — every host re-render remounted children; that bug must not return.)
- Two distinct memo shapes depending on `mapProps`:
  - without `mapProps`: `Child = memo(Component)` directly — slot props pass through, single shallow barrier, no extra fiber;
  - with `mapProps`: double barrier `memo(props => <Memoized {...mapProps(props)} />)` where `Memoized = memo(Component)`. Outer memo gates by raw host props (skips `mapProps` calls); inner gates by mapped **values** — so a change in a prop that `mapProps` drops never reaches `Component`, and unstable host props are shielded when `mapProps` narrows to stable values. Guarantee: `Component` re-renders ⟺ its mapped-prop values changed (library-side maximum; unstable values flowing _through_ `mapProps` can only be fixed by the host).
- No `useMemo` inside the wrapper: `memo` already gates re-renders, so by the time the wrapper re-renders its props have changed and a cache would always miss.
- `mapProps` is optional; without it slot props reach `Component` as-is. `mapProps` must be pure.
- Item `id` comes from a module-level counter at insert time and is used as the React `key`: it's an _identity_ key stored in state (stable across reorders), not a position/index key.
- Per-slot stores: inserting into one slot must never wake subscribers of another.

The re-render guarantees (sibling insert doesn't re-render existing children; mid-list insert doesn't remount; same-value host re-render bails) are pinned in `createSlot.test.tsx` via render/mount counters — treat those tests as the spec.

### Type design (payload.ts)

- `Payload<T>` is conditional: slots without props (`createSlot()`, `void`, `unknown` → `EmptyObject`) get a single signature with `mapProps?: never` (forbidden); slots with props get two overloads discriminated by `mapProps?: undefined`.
- `Insertable = (object & { key?: never; ref?: never }) | void` constrains both `T` (createSlot) and `R` (mapProps result): rejects primitives (spread of a primitive crashes at runtime) and React-reserved `key`/`ref` (silently swallowed from spreads; `key` would clobber the slot's own keying). Do NOT replace with a conditional helper referencing the parameter itself — that's a circular constraint (TS2313).
- `order?: number | undefined` (explicit `| undefined`) on every insert signature — consumers with `exactOptionalPropertyTypes` pass `order` from their own optional params.
- `NormalizedProps` uses tuple checks (`[T] extends [void]`) — non-distributive, so union slot props like `{ x } | undefined` keep their optionality.
- `Component` returns `ReactNode`, **not** `JSX.Element` (CHANGELOG #10 — allows `() => null`, strings, arrays). Pinned by a runtime test.
- The phantom type lives directly on `createSlot<T>()`; there is no identifier/config-object indirection.
- `@ts-expect-error` placement in test-d files is empirical: TS attributes overload failures either to a property line or to the call expression depending on how many properties fail per overload — verify with `pnpm exec tsc --noEmit` when adding cases.

## Testing

- Runtime tests: `src/__tests__/*.test.ts(x)`; type tests: `*.test-d.ts(x)` (vitest typecheck, runs as part of `make test`).
- **No @testing-library** (deliberate): render tests use `src/__tests__/renderer.tsx` — a ~35-line helper over `react-dom/client` `createRoot` + `act` from `react`. It registers `afterEach` cleanup on import; test files need no setup/teardown. Wrap store mutations in `act(...)` explicitly.
- Environment: happy-dom (vitest config), `IS_REACT_ACT_ENVIRONMENT` is set by the renderer helper.

## Style & conventions

- oxfmt formats (no prettier): no semicolons, double quotes, sorted imports, 120 cols. Run `make fmt` after edits.
- Code is comment-free by owner preference; names and tests carry the explanation.
- Exports go in a single `export { ... }` block at file bottom; inline `type` imports (`import { x, type Y }`).
- `src/index.ts` exports **only** `createSlot`. `createStore`/`useStore` are internal.
