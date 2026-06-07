# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@grlt-hub/react-slots` v4 — a slot system for React (named extension points where plugins inject components). Effector-free rewrite (branch `4.0.0`): the only runtime dependency is `use-sync-external-store`, the only peer is `react >=16.8.0 <20.0.0`. Toolchain, monorepo layout, and code style mirror the sibling project `@grlt-hub/app-compose`.

## Monorepo layout

pnpm workspace (`packages/*`), structured like app-compose:

- **Root** — private `@grlt-hub/react-slots-dev`: shared toolchain in devDependencies (typescript, tsdown, vitest + @vitest/browser + @vitest/browser-playwright + playwright, knip, oxlint, oxfmt), base `tsconfig.json`, `.oxfmtrc.json`, scripts delegate via `pnpm -r`.
- **`packages/react-slots`** — the published library: own runtime/peer deps plus package-specific devDeps (react, react-dom, happy-dom, @types/\*), own `tsconfig.json` (extends root), `tsdown.config.ts`, `vitest.config.ts`, `knip.json`, `.oxlintrc.json`, README, CHANGELOG, LICENSE (a copy of the root one — npm auto-includes LICENSE only from the package dir; CHANGELOG ships via `files`). `tsdown.config.ts` prepends a `"use client"` banner to both JS bundles (RSC boundary — a react-server build has no `useSyncExternalStore`, so hooks/Root would otherwise die deep in the shim; audit F6); the banner must NOT leak into the d.ts.

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

Package manager is pnpm (pinned via `packageManager`). pnpm settings live in `pnpm-workspace.yaml` (`minimumReleaseAge: 4320` — new package versions younger than 3 days won't install). Gotcha: **optional** deps blocked by that gate (platform binaries like `@rolldown/*`) are skipped _silently_ and surface later as "Cannot find native binding" — fix via `minimumReleaseAgeExclude`, don't lower the gate. Current excludes are temporary (safe to drop after 2026-06-07).

Knip quirks in the workspace: shared binaries/deps live at root, so the package `knip.json` needs `ignoreBinaries` and `ignoreDependencies: ["vitest"]`; config files are covered by `ignore: ["*.config.ts"]` (same as app-compose).

## Architecture

Four files in `packages/react-slots/src/` (paths below are relative to the package), each one file, dependencies point strictly downward:

```
payload.ts        types only: Payload<T> insert signatures, NormalizedProps, EmptyObject
createSlot.tsx    adapter: createSlot<T>(config?) → { Root, api: { insert, clear } }
                  (+ { useCount, usePresence } when config.presence === true). Also owns
                  Slot<T>/PresenceSlot<T>/SlotConfig types (not re-exported from index).
store.ts          core: createStore — persistent sorted list + Set of listeners;
                  plus useStore — useSyncExternalStore shim bridge (3rd arg = SSR snapshot)
presenceStore.tsx core (presence only): createPresenceStore — Map<id, Map<Element, boolean>>
                  OR-aggregation, queueMicrotask-coalesced notify, internal slot-store
                  subscription routing composition changes through the SAME bump() channel;
                  plus the probe wrapper (display:contents span + MutationObserver). Imports
                  only react + use-sync-external-store/shim; nothing upward.
insertSorted.ts   pure upper-bound insert into a sorted immutable list
```

### Core contracts (store.ts) — every line is load-bearing for React

These invariants exist because `useSyncExternalStore` compares snapshots with `Object.is` and requires `getSnapshot` results to be cached. Breaking any of them causes infinite render loops, stale UIs, or phantom re-renders — and they're all pinned by tests in `store.test.ts`:

- `get()` returns the same reference between mutations; every mutation produces a new array (copy-on-write via `insertSorted`).
- Empty state is the single shared `EMPTY` constant (initial and after `clear`).
- `clear()` on an empty store is a no-op and does **not** notify.
- Sorting is stable: equal `order` (default 0) keeps insertion order — `findIndex` with strict `>` is the upper-bound that guarantees it.
- `notify` is synchronous and 1:1 with mutations. Do not batch (React 18+ auto-batches; planned observability hooks rely on 1:1).

`toSpliced` in `insertSorted.ts` is deliberate: runtime floor is ES2023 (Node 20+ / Safari 16.4+ / Chrome 110+); tsconfig/tsdown targets are aligned to it.

### Core contracts (presenceStore.tsx) — presence-only, opt-in

These govern the **presence store**, a different store from `store.ts` (different aggregation, observer-driven inputs). The slot store stays untouched; presence is layered above it.

- **id-keyed OR-aggregation:** `reports: Map<id, Map<Element, boolean>>` — outer key is the store item `id`, inner map holds one has-DOM bool per mounted span instance (one per Root). `renders(id)` is `true` iff any element reports `true` (multi-Root OR, no double-count).
- **`Object.is`-gated report:** a redundant report (StrictMode's double layout-effect, an observer firing with no net change) is a no-op and does not `bump()`. StrictMode-idempotent.
- **microtask-coalesced notify** with composition changes routed through the SAME `bump()` channel — a **deliberate deviation** from the slot store's synchronous-1:1 discipline. Different store, observer-driven inputs; `store.ts` itself is untouched. The presence store subscribes to the slot store internally and coalesces a synchronous composition notify with same-tick DOM reports into one `queueMicrotask(flush)` → one host render at the final value (fixes the double-count tear: an insert-with-DOM never transits a stale intermediate count). An opposite-direction same-count swap (`[t,f]→[f,t]`) arrives as two observer callbacks but coalesces to one flush — `useCount`-gated hosts never phantom-re-render (load-bearing; pinned).
- **count + array each projected over `store.get()`** (the slot store is the single source of composition + order — not mirrored). Projection over `getItems()` makes both hooks structurally immune to stale `reports` entries during the clear/unmount teardown window (the count/array can never show a wrong value).
- **two disjoint per-hook snapshot caches** (no shared recompute state): `getCount` owns its loop (primitive, `Object.is` bail); `getPresence` owns `presencePrevItems`/`presenceArray` (same-reference structural bail — returns the same array until a boolean flips). Disjoint so a count-host render can never corrupt the presence-host's snapshot. `usePresence` returns `readonly boolean[]` — the cached snapshot, never mutate it.
- **hooks subscribe ONLY to the presence store** (not the slot store) — that is what routes composition changes through the coalescing channel.
- **server snapshot length-matched to the client first render:** `getServerCount → 0`; `getServerPresence` projects all-false over the current composition length (shared `EMPTY_PRESENCE` when empty) behind its **own items-identity cache** — React calls `getServerSnapshot` more than once per hydration and compares with `Object.is`; an uncached fresh array fires the dev error "The result of getServerSnapshot should be cached" on every SSR consumer (audit F2). The cache is disjoint from `getPresence`'s (same disjointness rule as the client caches). Hydration-safe: server `[false,…]` of length N equals the client's first-render snapshot (no effect has run yet). The post-mount `false → true` settle is an effect-driven update, not a hydration mismatch.
- **observer is `{ childList: true }`** — has-DOM is the span's **own** `childNodes.length > 0`, and any change to the span's own child list IS a `childList` mutation on the span itself, so `childList` alone observes every value-changing mutation. `subtree: true` was proven inert and removed (audit F3/M13): a deep `null↔content` flip under an always-present wrapper element cannot change the span's own child list, and the same-value re-report it would trigger is swallowed by the `Object.is` gate — it only made the observer fire a no-op on every deep mutation of user content. Do not re-add it without a test that fails without it (the audit could not construct one).

### Adapter rules (createSlot.tsx) — performance-first, by explicit owner instruction

- The child `memo` wrapper is created **once at insert-time**, never inside render. (3.x created it in render — every host re-render remounted children; that bug must not return.)
- **Props flow ONLY through explicit `mapProps`** (decided after 4.0.0-alpha.0; matches 3.x runtime). Without `mapProps` the Component receives **no props** (typed `EmptyObject`) and the host renders it without spreading — so Root props churn can never re-render it. Cheap-by-default: static children (the dominant slot payload) are physically cut off, not merely memo-shielded. Want all slot props? Write `mapProps: (p) => p` explicitly.
- Three distinct memo shapes, specialized at insert-time (never branch inside render):
  - without `mapProps`: `Child = memo(Component)` rendered as `<child.Child key={id} />` — no props, no spread, never re-renders from the host (`withProps: false` discriminant in the store item);
  - with `mapProps`: double barrier `memo(props => <Memoized {...mapProps(props)} />)` where `Memoized = memo(Component)`. Outer memo gates by raw host props (skips `mapProps` calls); inner gates by mapped **values** — so a change in a prop that `mapProps` drops never reaches `Component`, and unstable host props are shielded when `mapProps` narrows to stable values. Guarantee: `Component` re-renders ⟺ its mapped-prop values changed (library-side maximum; unstable values flowing _through_ `mapProps` can only be fixed by the host). This shape must stay byte-for-byte as is — adding `filter` support here would tax every mapped child;
  - with `filter` + `mapProps`: the double-barrier wrapper grows an update gate in its body — `if (props !== last.props && filter(props)) setLast({ props, element: <Memoized {...mapProps(props)} /> }); return last.element` over render-phase `useState` (see freeze mechanics below).
- `filter` is an update gate BEFORE `mapProps` (`raw props → filter → mapProps → inner memo → Component`), **not** conditional render: false drops the update — `mapProps` is not called and the child stays mounted with the last props that passed (freeze). Bootstrap is gated too: until any props pass, the child renders `null`; the first pass is the mount. That bootstrap rule is what makes the type guard sound — `mapProps` must never see un-narrowed props, including on first render.
- Freeze mechanics: the cached element lives in **render-phase state** — `useState<{ props, element }>` initialized at mount (`element: null` while bootstrap rejects) and updated via `setLast` _during render_ on each passing update (React's sanctioned derive-from-previous-render pattern). Per-mount state, NOT an insert-time closure (two mounted Roots of the same slot must freeze independently). NOT a `useRef` written during render: React may abandon a render attempt (interrupted transition, suspended attempt), and a ref write survives the abandonment — the next rejected render would then commit an element whose props the host never committed (freeze-cache poisoning, audit F1; pinned twice — the deterministic Suspense-abandoned-transition test, where only the FINAL assertion after the urgent rejected update discriminates old/new, and the time-sliced-interruption tear test, whose siblings-uniform assertion is race-proof on correct code; both verified RED against the ref version). Render-phase state is discarded together with the abandoned attempt, so the freeze always equals the last **committed** pass. The `props !== last.props` identity gate keeps `filter` at exactly one call per wrapper render — the synchronous restart pass after `setLast` sees `props === last.props` and skips both `filter` and `mapProps` (call-counter pins stay exact). The freeze is still an element-identity bail — returning the same cached element reference makes React skip reconciling the `Memoized` subtree. Do NOT move the gate into memo's second argument: a comparator can't gate the first render, which is a hole in the narrowing guarantee.
- The outer memo stays default shallow on raw props, so the skip guarantees extend to `filter` for free: a same-value host re-render and a sibling insert never even _call_ `filter`.
- Filter cost (measured, bench:browser 2026-06-07): freeze-on-reject stays **cheaper** than the plain mapped flow (≈0.7–0.82× — frozen renders return the cached element by identity, skipping `mapProps` and the inner memo compare). Filter-pass tax over plain `mapProps` is ≈**1.04–1.05×** dev — the render-phase `setLast` restart, the price of the F1 fix (the old ref-based freeze measured ≈1.00 dev but 1.05–1.09 prod per the audit, and was unsound under interruptible lanes). Do not claim "0–5%".
- No `useMemo` inside the wrapper: `memo` already gates re-renders, so by the time the wrapper re-renders its props have changed and a cache would always miss.
- `mapProps` must be pure. `filter` must be pure.
- The static branch types `Child` as `NamedExoticComponent<object>`, NOT `<EmptyObject>` — `Record<string, never>` has an index signature, so TS checks even the JSX `key` attribute against it and errors.
- Item `id` comes from a module-level counter at insert time and is used as the React `key`: it's an _identity_ key stored in state (stable across reorders), not a position/index key.
- Per-slot stores: inserting into one slot must never wake subscribers of another.
- **Presence (opt-in) is a FULL FORK by owner decision:** `createSlot(config?)` opens with `if (!config?.presence) return <non-presence impl>`. The two fork bodies must stay **byte-identical to each other** modulo the one enclosing-block indentation level oxfmt owns (provable by diff; at the presence commit the non-presence body was byte-identical to pre-presence HEAD — later shared fixes, e.g. the F1 freeze state, land in both forks symmetrically). Non-presence slots pay **zero** render-path cost and allocate nothing presence-related. `createSlot` is now a **function declaration** (overloads) — the single deliberate house-style exception (an arrow can't carry overload signatures).
- **Presence funnel:** in the presence branch the probe threads through the single existing funnel — `Memoized = memo(probe(presence, id, Component))` (vs `memo(Component)` non-presence). The probe sits **inside** `Memoized`, **below** the filter/mapProps barriers, so all three memo shapes stay byte-for-byte and the filter contract (bootstrap/freeze/thaw, per-Root independence) composes for free. `id` is hoisted out of the ternary because `probe` needs it before the branch (same `String(++idCounter)`, same React `key`). `SPAN_STYLE = { display: "contents" } as const` is module-level (stable identity). The thaw path reconciles in place — the probe's `[]`-deps layout effect does not re-run, the `MutationObserver` survives.

The re-render guarantees (sibling insert doesn't re-render existing children — both branches; mid-list insert doesn't remount; same-value host re-render bails; sibling insert doesn't even _call_ `mapProps` of existing children) and the filter contract (bootstrap-null while rejecting; freeze on true → false — DOM and mount counter; thaw on the next pass — new props land without remount; `filter`/`mapProps` call counters; Component render counter frozen under raw-prop churn; per-Root freeze independence; `mapProps` only ever sees passed props; store outlives Root unmount and a remounted Root re-bootstraps filtered children — the freeze cache is per-mount render-phase state, never per-insert closure state; an abandoned render attempt never poisons the freeze) are pinned in `createSlot.test.tsx` via render/mount/call counters — treat those tests as the spec. Note the mapProps-skip pin needs a call counter, not a render counter: without the outer memo, `mapProps` would run on every wrapper re-render while the inner `Memoized` still bails on equal values — render counters can't see that regression.

### Type design (payload.ts)

- `Payload<T>` is conditional: slots without props (`createSlot()`, `void` → `EmptyObject`) get a single signature with `mapProps?: never` and `filter?: never` (both forbidden); slots with props get three overloads — guard (`filter` as a type guard, required), boolean (`filter` optional), no-props (discriminated by `mapProps?: undefined`, `filter?: never`). (`createSlot<unknown>()` doesn't exist — `unknown` fails the `Insertable` constraint; the `unknown extends T` branch in `NormalizedProps` is defensive only, unreachable through the public API.)
- `filter` overloads (semantics of effector's `sample({ filter, fn })`): the guard overload is `<S extends NormalizedProps<T>, R>` with `filter: (p) => p is S` and `mapProps: (slotProps: S) => R` — narrowing reaches `mapProps` and flows on to `Component`. Inferred type predicates (TS 5.5+) mean a bare lambda on a discriminated union (`(p) => p.kind === "str"`) narrows without a manual `p is`. Everything else falls softly into the boolean overload (`filter?: ((p) => boolean) | undefined`): boolean filters, lambdas that narrow only a property of a non-union type (wide input, no error wall), and explicit `filter: undefined` (the `| undefined` matters under `exactOptionalPropertyTypes`). `filter` without `mapProps` is rejected — a static child has nothing to filter.
- **Convention: `filter` is written above `mapProps` in insert literals.** With `mapProps` first, `S` inference doesn't fire — the call silently falls into the boolean overload and narrowing is lost without any error. Pinned by a convention test in `createSlot.test-d.tsx`.
- `Insertable = (object & { key?: never; ref?: never }) | void` constrains both `T` (createSlot) and `R` (mapProps result): rejects primitives (spread of a primitive crashes at runtime) and React-reserved `key`/`ref` (silently swallowed from spreads; `key` would clobber the slot's own keying). Do NOT replace with a conditional helper referencing the parameter itself — that's a circular constraint (TS2313).
- `order?: number | undefined` (explicit `| undefined`) on every insert signature — consumers with `exactOptionalPropertyTypes` pass `order` from their own optional params.
- `NormalizedProps` is deliberately **distributive**: `void`/`undefined` members of a union normalize to `EmptyObject` (`{ x } | undefined` → `{ x } | EmptyObject`). JSX never passes `undefined` — the host delivers `{}` at minimum — so `EmptyObject` is the honest "no props" member; a raw `undefined` in the type would produce dead guards in `mapProps` and collapse to a required `{ x }` on the Root side via `& object`. Both sides (`Root` props and `mapProps` input) are typed from the same `NormalizedProps<T>` — never let them diverge.
- `Component` returns `ReactNode`, **not** `JSX.Element` (CHANGELOG #10 — allows `() => null`, strings, arrays). Pinned by a runtime test.
- The phantom type lives directly on `createSlot<T>()`; there is no identifier/config-object indirection.
- `mapProps: cond ? fn : undefined` (union) deliberately does NOT typecheck: `mapProps` presence is a _discriminant_ that statically decides `Component`'s props type. Supporting the union would require a third overload typing `Component` as `(props: NormalizedProps<R> | EmptyObject)` — defensive two-shape components, exactly what the explicit-mapProps design removed. Workaround is explicit branching (each branch types precisely); a third overload can be added later as a non-breaking minor if forwarding wrappers create real demand.
- **Presence types (`createSlot.tsx`, NOT `payload.ts` — `payload.ts` is untouched):** `Slot<T>`/`PresenceSlot<T>`/`SlotConfig` live in the adapter (they describe its return surface and reference `Payload<T>` downward), `export type`-d so the emitted `.d.ts` names them, but **not** re-exported from `index.ts` (still only `createSlot`). **Design B overload ordering:** `createSlot(config: { presence: true }): PresenceSlot<T>` is listed **first** (more specific); the base overload takes the **wide** `presence?: boolean | undefined`, so a widened `boolean` variable degrades cleanly to the no-hooks base with **no compile error** (vs Design A's hard `TS2769`). `PresenceSlot<T> = Slot<T> & { useCount; usePresence }` — strict superset, `api` identical. `usePresence` returns `readonly boolean[]`. Return-type **parity** of the base path with `Slot<T>` is verified against `@types/react@19.2` (explicit `memo<P>` selects the first overload → `NamedExoticComponent<P>`, not `MemoExoticComponent`) and pinned as a **hard gate** by `expectTypeOf<Slot<void>>().toEqualTypeOf<ReturnType<typeof createSlot<void>>>()` (and a `{ userId }` variant) — fails loudly if a React-types bump widens it.
- `@ts-expect-error` placement in test-d files is empirical: TS attributes overload failures either to a property line or to the call expression depending on how many properties fail per overload — verify with `pnpm exec tsc --noEmit` when adding cases.
- **Minimum TypeScript (audit §6): 4.7** for the core surface (exports-map `types` resolution; the emitted d.ts holds under `skipLibCheck: false` down to 4.7), **5.5+** for inferred type-predicate narrowing — the documented bare-lambda `filter` pattern fails loudly (TS2339) on older TS; the migration is an explicit `p is S`.

### Presence (opt-in) — documented boundaries

Opt-in per slot via `createSlot({ presence: true })`, adding `useCount(): number` and `usePresence(): readonly boolean[]` (composition-ordered, OR across mounted Roots). Boundaries (the spec; pinned by `presence.test.tsx`):

1. **Region semantics, not "showing somewhere":** counts children producing **committed DOM inside the slot region**. Pure-portal children count as _not_ rendering; portal + local content counts as rendering.
2. **Has-DOM ≠ visible:** `display:none`/`visibility:hidden`/zero-size/offscreen content **counts**. Visual visibility is a different feature, out of scope.
3. **Tag-name-significant children unsupported (doc-only "don't", no runtime guard):** do NOT enable presence on slots whose children are `tr`/`td`/`th` (in `table`), `option` (in `select`), `source`/`track`, or SVG internals — the `display:contents` span is a foreign element the parser foster-parents out. Presence is for **box-level chrome** slots.
4. **Host child-combinator CSS caveat:** the per-child spans are real DOM children, so `.slot > *`, `+`, `:nth-child` match the **spans**, not user content. Prefer `gap` over adjacent-sibling margins.
5. **SSR/first-paint:** server and client-first-render both produce `count = 0` and an **all-false array of the current composition length** (length-matched — no hydration mismatch). For one microtask after first mount the values stay `0`/all-false, then settle `false → true` (effect-driven, not a mismatch). A frame hard-gated on `count === 0` may flicker once — render optimistically or tolerate the `0 → N` settle.
6. **Notify timing differs from `store.ts`:** updates are microtask-coalesced. Presence tests must `await act(async () => {})` first (the `flush` helper).
7. **Multi-Root OR + transient leak window:** a child counts if it renders in **at least one** mounted Root. On `clear()`/unmount, `reports` may briefly hold stale entries between the synchronous slot-store notify and the async teardown `remove()`; **count/array are projected over `store.get()`, so this never yields a wrong value** — it drains on teardown.
8. **`usePresence()` mid-list insert shifts indices** — it is a snapshot of the current composition in render order.
9. **Opt-in cost:** per child +1 `display:contents` span, +1 `MutationObserver` (childList only), +1 layout effect, +1 `queueMicrotask` per coalesced burst; per slot one internal slot-store subscription. Non-presence slots pay nothing (full fork). Measured (bench:browser 2026-06-07): presence tax on full-flow mapped churn ≈**1.7–1.85×** (chromium/webkit, dev; the audit confirmed 1.71–1.87× on prod React), constant in N; on stable-mapped churn (children bail at the inner memo — the dominant payload) ≈1.03–1.06×. Do not quote the older "≈1.5×" figure — it came from happy-dom and is refuted by both this bench and the audit (F4).
10. **childNodes counts text and comment nodes, not just elements:** the probe reports `el.childNodes.length > 0` ("produced _any_ DOM node"). A `Component` returning `" "` renders a text node → counts true (has-DOM, not "visible content"). React 19 emits **no** DOM for `null`/`false`/`undefined`/`""`/`[]`/`<></>` → those count false correctly. If a future construct commits a placeholder comment node, the probe would report true — an accepted edge of the has-DOM definition.
11. **Cross-slot id sharing is safe:** `idCounter` is module-global but each presence store is per-slot and only ever receives ids generated for _its_ children (the `probe` closure captures the id at insert). Globally monotonic ids → no two slots share an id within one presence store's `reports`. Relies on the counter never resetting (it doesn't).

## Testing

- Runtime tests: `src/__tests__/*.test.ts(x)`; type tests: `*.test-d.ts(x)` (vitest typecheck, runs as part of `make test`).
- **No @testing-library** (deliberate): render tests use `src/__tests__/renderer.tsx` — a ~35-line helper over `react-dom/client` `createRoot` + `act` from `react`. It registers `afterEach` cleanup on import; test files need no setup/teardown. Wrap store mutations in `act(...)` explicitly.
- Environment: happy-dom (vitest config), `IS_REACT_ACT_ENVIRONMENT` is set by the renderer helper.
- **Presence tests:** `presenceStore.test.ts` (pure store, `vi.fn()` listeners + fake `getItems`/`subscribeItems`, drained via `queueMicrotask`), `presence.test.tsx` (real `createSlot({ presence: true })` + `renderer.tsx`), `presence.test-d.tsx` (overload return types, parity hard gate). Presence notify is microtask-coalesced, so **every presence assertion is preceded by `const flush = () => act(async () => {})` / `await flush()`**. One test is wrapped in `<StrictMode>` (idempotency); the SSR length-match test uses `renderToString` from `react-dom/server` to exercise the server snapshot; the deep-mutation test (`<div>{deep ? <span/> : null}</div>`) pins the has-DOM boundary — deep flips under a persistent wrapper never change presence AND never phantom-re-render the host (render counter; the value alone is structurally unable to flip, so the counter is what makes the pin falsifiable; observer is childList-only — `subtree` was proven inert by mutation testing and removed, audit F3). `presence.hydration.test.tsx` pins `renderToString` → `hydrateRoot` staying silent (identity-cached `getServerPresence`, no mismatch, the `0 → N` settle still lands); it lives in its own file because React's uncached-`getServerSnapshot` error is once-per-page — in a shared file an earlier consumer of the flag would blind the pin.

## Style & conventions

- oxfmt formats (no prettier): no semicolons, double quotes, sorted imports, 120 cols. Run `make fmt` after edits.
- Code is comment-free by owner preference; names and tests carry the explanation.
- Exports go in a single `export { ... }` block at file bottom; inline `type` imports (`import { x, type Y }`).
- `src/index.ts` exports **only** `createSlot`. `createStore`/`useStore` are internal.
