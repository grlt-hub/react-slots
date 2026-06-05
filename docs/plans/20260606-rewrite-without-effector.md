# Rewrite react-slots without effector (v4.0.0)

## Overview

Rewrite `@grlt-hub/react-slots` as a zero-dependency library: a framework-agnostic core (plain stores with listener sets) plus a thin React adapter (`useSyncExternalStore` with a React 17 fallback).

**Problem it solves:**

- Drops three peer dependencies (`effector`, `effector-react`, `nanoid`) — `react` becomes the only peer.
- Removes effector kernel overhead; per-slot stores mean an insert into one slot never wakes subscribers of another (better than the current shared `$slots` store).
- Removes all `@ts-expect-error` workarounds caused by fighting effector types.

**Architectural decisions (agreed during planning):**

1. **`when` is removed from the core.** Deferred insertion moves to future binding packages (effector bindings will be developed separately, out of scope here). Users subscribe manually: `event.watch((p) => slotsApi.X.insert({...}))`.
2. **Single entry point** (`@grlt-hub/react-slots`), separation inside `src/`: pure core (`store.ts`) + React adapter (`index.tsx`, `use-slot.ts`).
3. **React 17+ support**: `useSyncExternalStore` accessed via namespace (`(React as any).useSyncExternalStore`) with a `useState`+`useEffect` fallback for React 17. Named import would break bundling on React 17.

**Breaking changes (major bump to 4.0.0):**

- `when` option removed from `insert` (and `mapProps` loses its second `whenPayload` argument).
- `insert` / `clear` are plain functions, not `EventCallable` — they can no longer be used as `sample()` targets.
- Peer dependencies `effector`, `effector-react`, `nanoid` removed.
- `react` peer raised to `^17.0.0 || ^18.0.0 || ^19.0.0`.

**Preserved semantics:**

- `insert({ Component, mapProps?, order? })` — render sorted by `order` (default 0), stable insertion order for equal `order` values.
- `clear()` — empties a slot; no notification if the slot is already empty.
- `Slots.X` — memoized component; children without `mapProps` render `<Component />`, with `mapProps` render through a memoized wrapper (`useMemo` on props).
- Slot props typing via `createSlotIdentifier<T>()` unchanged.

## Context (from discovery)

- Files involved: `src/index.tsx` (effector store/events + render), `src/helpers.tsx` (insertSorted, isNil, makeChildWithProps), `src/payload.ts` (effector `Unit`-based types), `src/__tests__/payload.spec-d.tsx`, `src/__tests__/extractWhenPayload.spec-d.ts`, `sandbox.tsx` (uses `createGate` from effector-react), `package.json`, `vitest.config.ts`, `.size-limit.json`, `.clean-publish`, `.github/workflows/tests.yaml`, `README.md`, `CHANGELOG.md`.
- Build: rslib (`make build`), minified ESM, dts. Size budget: 900 B **gzip** (`.size-limit.json`, preset-small-lib measures gzip) — current bundle is 627 B gzip with effector externalized (it never counted against the budget). New store/hook code is what gets added; the goal is to stay within 900 B, not to loosen it.
- Tests: vitest with `typecheck` only (`*.spec-d.ts(x)`), **no runtime tests exist**. Runtime tests require adding `@testing-library/react` + `@testing-library/dom` (RTL v16 peer) + `react`/`react-dom` as explicit devDependencies + a DOM environment (happy-dom), and extending `vitest.config.ts`. Note: `react` currently appears in node_modules only via peer hoisting — once peers shrink, it must be a declared devDependency or CI (`npm ci`) loses it.
- CI: `.github/workflows/tests.yaml` runs `npm ci` + `make prepublish` — **every dependency change requires regenerating `package-lock.json`** or CI fails at install.
- ⚠️ Pre-existing hazard: `src/helpers.tsx:9` uses `Array.prototype.toSpliced` (ES2023 runtime method); rslib `syntax: 'es2020'` downlevels syntax only, so it ships to `dist/` unchanged — crashes on runtimes older than Node 20 / Safari 16.4 / Chrome 110. Must be fixed in the rewrite (Task 1) since the plan widens runtime support claims (React 17 era).
- ⚠️ Pre-existing: `.clean-publish` lists `knip.json` in `files`, but the file doesn't exist — `make publish` path unreliable (fixed in Task 5).
- Reference for style: `@grlt-hub/app-compose` v3 — zero-dependency, structural protocols, `Map`-based registry.

## Development Approach

- **Testing approach**: Regular (code first, then tests in the same task)
- complete each task fully before moving to the next
- make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
  - tests are not optional - they are a required part of the checklist
  - tests cover both success and error scenarios
- **CRITICAL: all tests must pass before starting next task** - no exceptions
- **CRITICAL: update this plan file when scope changes during implementation**
- run tests after each change (`make test`)
- backward compatibility is intentionally broken (major release) — breaking changes must match the list in Overview, nothing beyond it

## Testing Strategy

- **unit tests**: required for every task; runtime specs as `src/**/__tests__/*.spec.ts(x)`, type specs as `*.spec-d.ts(x)` (existing convention)
- **e2e tests**: none in this project — `@testing-library/react` integration tests of the adapter act as the highest-level check
- React 17 fallback hook is tested directly (exported for tests); the native `useSyncExternalStore` path is covered by integration tests on React 19 (installed devDependency)

## Progress Tracking

- mark completed items with `[x]` immediately when done
- add newly discovered tasks with ➕ prefix
- document issues/blockers with ⚠️ prefix
- update plan if implementation deviates from original scope

## What Goes Where

- **Implementation Steps** (`[ ]` checkboxes): code, tests, docs in this repo
- **Post-Completion** (no checkboxes): effector bindings package, consumer migration, npm publish

## Implementation Steps

### Task 1: Zero-dependency core store (`src/store.ts`)

**Files:**
- Create: `src/store.ts`
- Create: `src/__tests__/store.spec.ts`
- Modify: `vitest.config.ts` (enable runtime specs: `include: ['src/**/__tests__/**/*.spec.ts?(x)']`, `environment: 'happy-dom'`, `globals: true` — required for RTL auto-cleanup between tests)
- Modify: `package.json` (devDependencies: `@testing-library/react`, `@testing-library/dom` (RTL v16 peer), `happy-dom`, `react` (pinned, currently only hoisted via peers), `react-dom`)

- [ ] create `createSlotStore<Item>()` in `src/store.ts`: `{ get, insert, clear, subscribe }` — state array + `Set<() => void>` listeners; no React imports, no external imports
- [ ] move `insertSorted` logic into the store's `insert` (sorted by `order ?? 0`, stable for equal order); **reimplement without `toSpliced`** (ES2023 method, ships untranspiled past `syntax: es2020` — use `slice()` + `splice()`); assign ids from a module-level counter (replaces nanoid)
- [ ] `clear()` skips notification when the slot is already empty; `get()` returns the internal array reference (stable until mutation — required by `getSnapshot` contract)
- [ ] `subscribe(listener)` returns an unsubscribe function; `get`/`subscribe` must be stable references (no per-call closures recreated)
- [ ] regenerate `package-lock.json` after devDependency changes (CI runs `npm ci`)
- [ ] write tests: insert ordering (order asc, equal-order stability, default order 0), unique ids, immutability (insert does not mutate the previous array), notification on insert/clear, no notification on empty clear, unsubscribe stops notifications, `get` reference stability between mutations, `insert`/`clear` return `undefined` (plain functions, locking the non-`EventCallable` contract)
- [ ] run tests - must pass before task 2

### Task 2: React subscription hook (`src/use-slot.ts`)

**Files:**
- Create: `src/use-slot.ts`
- Create: `src/__tests__/use-slot.spec.tsx`

- [ ] implement `useSubscriptionFallback(subscribe, getSnapshot)` on `useState` + `useEffect`: re-read snapshot inside the effect before subscribing (closes the render→subscribe race), bail out on identical reference; effect deps `[subscribe, getSnapshot]`, listener calls `getSnapshot()` freshly (no captured value)
- [ ] implement `useSlotSnapshot = (React as any).useSyncExternalStore ?? useSubscriptionFallback` — namespace access only, never a named import (React 17 compatibility); export the fallback separately for tests
- [ ] write tests for the fallback hook (forced, regardless of installed React version — RTL v16 can't run React 17, so the fallback is unit-tested in isolation with stable `subscribe`/`get` refs mirroring real usage): initial snapshot, re-render on store change, no re-render on same reference, update fired between render and effect is not lost, unsubscribe on unmount
- [ ] write integration test that `useSlotSnapshot` re-renders on store change (native path on installed React)
- [ ] run tests - must pass before task 3

### Task 3: Types without effector (`src/payload.ts`)

**Files:**
- Modify: `src/payload.ts`
- Modify: `src/__tests__/payload.spec-d.tsx`
- Delete: `src/__tests__/extractWhenPayload.spec-d.ts`

- [ ] remove `Unit`/`UnitValue` imports and `ExtractWhenPayload`; `Payload<T>` keeps two overloads: with `mapProps: (slotProps: T) => R` (Component receives `R`) and without (Component receives `T`); `EmptyObject` behavior for `void`/`unknown` preserved
- [ ] ⚠️ overload resolution now discriminates solely on `mapProps` presence (the `when?: undefined` discriminant is gone) — resolution is order-sensitive, verify with type tests
- [ ] delete `extractWhenPayload.spec-d.ts` (the `when` feature is removed)
- [ ] update `payload.spec-d.tsx`: drop `when`/`patronum`/`effector` imports and cases; keep/extend inference cases — no-props slot, typed slot props, `mapProps` result inference, rejection of wrong Component prop types; explicitly: (a) no-`mapProps` call resolves to the correct overload, (b) `mapProps: () => {}` → Component receives `EmptyObject` (existing regression case), (c) overload-order sanity
- [ ] run tests (typecheck) - must pass before task 4

### Task 4: Rewrite adapter (`src/index.tsx`, `src/helpers.tsx`)

**Files:**
- Modify: `src/index.tsx`
- Modify: `src/helpers.tsx`
- Create: `src/__tests__/createSlots.spec.tsx`

- [ ] rewrite `createSlots`: per-slot `createSlotStore` instances; `slotsApi[key] = { insert, clear }` as plain functions; `Slots[key]` = `memo` component using `useSlotSnapshot(store.subscribe, store.get)`
- [ ] keep `makeChildWithProps` (memo + `useMemo` on mapped props) and `isNil` in `src/helpers.tsx`; **keep exporting `EmptyObject`** (used by `payload.ts` and `payload.spec-d.tsx`); remove `insertSorted` (moved to store in Task 1) and `Entries` (sole consumer was old `index.tsx`); eliminate every `@ts-expect-error` (target: zero in `src/`)
- [ ] `createSlotIdentifier` unchanged; public exports unchanged: `{ createSlots, createSlotIdentifier }`
- [ ] write integration tests (`@testing-library/react`): render slot → insert → component appears; order respected across multiple inserts; clear empties rendered output; slot props passed to Component; `mapProps` transforms slot props; insert into slot A does not re-render mounted slot B (render counter); insert before mount renders on mount
- [ ] write test pinning current memo/props-identity behavior: slot re-renders when slot-props identity changes (object literal prop), `mapProps` recomputes via `useMemo` on `[props]` — so the rewrite doesn't silently alter it
- [ ] write test for the manual deferred-insertion pattern (callback subscription replacing `when`)
- [ ] run tests - must pass before task 5

### Task 5: Package metadata, sandbox, build budget

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (regenerate)
- Modify: `sandbox.tsx`
- Modify: `.size-limit.json` (only if measured gzip exceeds 900 B)
- Modify: `.clean-publish`

- [ ] `package.json`: version `4.0.0`; remove `effector`, `effector-react`, `nanoid` from peerDependencies; set `react` peer to `^17.0.0 || ^18.0.0 || ^19.0.0`; remove `patronum` from devDependencies; update `description`/`keywords` (drop "powered by Effector", "event-driven")
- [ ] regenerate `package-lock.json` (CI runs `npm ci` — fails hard on lockfile drift); verify no lingering `effector`/`effector-react`/`patronum`/`nanoid` imports remain anywhere after peers vanish from node_modules
- [ ] rewrite `sandbox.tsx` without `createGate`/effector — plain example: typed slot + insert + manual deferred insertion via callback (same task as peer removal, so no broken imports linger)
- [ ] `.clean-publish`: remove the stale `knip.json` entry from `files` (file doesn't exist — breaks `make publish`)
- [ ] run `make build`, measure gzip size via `npx size-limit`; keep the 900 B budget if it fits (current is 627 B gzip and effector was externalized, i.e. never counted — only own store/hook code is added); adjust only if actually exceeded
- [ ] run `make prepublish` (build + size-limit + tests) - must pass before task 6
- [ ] ➕ no new runtime tests in this task (metadata only) — full suite re-run serves as the check

### Task 6: Verify acceptance criteria

- [ ] verify all Overview requirements: zero runtime/peer deps except `react`; `when` removed; semantics list preserved; React 17 path implemented
- [ ] verify edge cases: empty slot renders nothing; double `clear`; insert after clear; multiple slots in one `createSlots`; two independent `createSlots` instances don't interfere
- [ ] grep repo (src/, sandbox.tsx) for `effector|effector-react|patronum|nanoid|@ts-expect-error|toSpliced` — must be zero matches
- [ ] grep `dist/index.js` for `toSpliced` after build — must be absent (ES2023 method would ship untranspiled)
- [ ] run full suite: `make test` (runtime + typecheck), `make build`, `npx size-limit`
- [ ] verify `dist/index.d.ts` exposes no effector types

### Task 7: [Final] Update documentation

- [ ] rewrite `README.md`: remove the peer-deps block (README:112–117 → `react` only), the "Defer insertion until event fires" section (README:244–277) including the `patronum`/`once` note; document manual deferred insertion pattern; add "Migration from 3.x" section (breaking changes list from Overview); note that effector bindings will ship as a separate package
- [ ] add `CHANGELOG.md` entry for 4.0.0 with breaking changes
- [ ] move this plan to `docs/plans/completed/`

## Technical Details

**Core store (per-slot, zero deps):**

```ts
type SlotItem = { id: string; Component: FC; mapProps?: (p: any) => any; order?: number };

const createSlotStore = () => {
  let state: SlotItem[] = [];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  return {
    get: () => state,
    insert: (item) => { state = insertSorted(state, item); notify(); },
    clear: () => { if (state.length === 0) return; state = []; notify(); },
    subscribe: (l) => (listeners.add(l), () => void listeners.delete(l)),
  };
};

// insertSorted: slice() + splice(), NOT toSpliced (ES2023 — ships untranspiled past syntax:es2020)
```

**React 17-compatible subscription:**

```tsx
// namespace access — named import breaks bundling on React 17
const useSlotSnapshot: UseSlotSnapshot =
  (React as any).useSyncExternalStore ?? useSubscriptionFallback;
```

- `getSnapshot` returns `state[key]` array reference — stable until mutation (avoids the `getSnapshot should be cached` infinite loop)
- `store.subscribe` / `store.get` passed as stable method references — no resubscription per render
- React 17 has sync rendering → no tearing; React 18+ uses the native hook
- React 17 nuance: multiple `insert()` calls in one tick outside React handlers = multiple renders (no auto-batching in 17) — same behavior as effector-react v23 on 17, no regression

**Render flow (unchanged shape):** `Slots.X` → snapshot array → map to `<Fragment key={id}>` → bare `<Component />` or memoized `makeChildWithProps` wrapper.

**Processing flow for removed `when`:** users subscribe themselves —

```tsx
userLoaded.watch((payload) => {
  slotsApi.Header.insert({ Component: () => <UserWidget {...payload} /> });
});
```

## Post-Completion

*Items requiring manual intervention or external systems - no checkboxes, informational only*

**Manual verification:**
- smoke-test the built package in a React 17 project (bundler must not fail on `useSyncExternalStore`) — no React 17 fixture in this repo
- verify type inference DX in a consuming TS project (hover types for `insert`/`mapProps`)

**External system updates:**
- **effector bindings package** (separate effort, explicitly out of scope): `when`-style deferred insertion, `sample`-compatible targets, scope support — designed against the public `insert`/`clear` API
- consuming projects must migrate `when` usages to manual subscriptions before upgrading to 4.0.0
- npm publish via `make publish` after release review
