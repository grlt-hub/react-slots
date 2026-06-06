# Slot presence — final implementation design (v4 opt-in) — corrected

> Implementer-ready. Every code sketch below was checked against the **actual** current source (`packages/react-slots/src/*`) and CLAUDE.md, and against the installed toolchain (`@types/react@19.2.16`, `happy-dom@20.10.1`, root `tsconfig.json` with `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes`, package `knip.json`, `.oxlintrc.json`). Where earlier drafts got the real code wrong, the errors are called out in §11 and already corrected here. This revision fixes a set of reviewer-found violations; the changes versus the prior draft are summarized in §12. You do not need any other document.

---

## 1. Summary & decided semantics

Opt-in **per slot** via `createSlot<T>({ presence: true })`. The flag adds two render-only hooks to the returned object:

- `useCount(): number` — how many inserted children currently produce **real committed DOM** inside the slot region.
- `usePresence(): readonly boolean[]` — one boolean per child, **in slot composition order** (`order`-sorted, equal `order` keeps insertion order — exactly `insertSorted`'s contract), `true` iff that child currently produces committed DOM in **at least one** mounted Root (OR-aggregation).

Without the flag (no arg, `{}`, `{ presence: false }`, `{ presence: undefined }`, or a **widened `boolean`** variable), the return type and the insert-time runtime path are **behaviorally equivalent to HEAD** (not literally byte-identical source — see §11.10 and the early-return analysis in §3/§5). The existing test suite plus two new guards (§8.3) are the regression net.

Mechanism: a per-child `<span style="display:contents">` wrapper around the user `Component`, placed **before** `memo` at the single existing funnel point, running an isomorphic layout effect with a `MutationObserver({ childList: true, subtree: true })` that reports `el.childNodes.length > 0` keyed by the store item `id`. A new core-layer file aggregates reports (OR across mounted Roots per id), and `createSlot.tsx` derives the cached `count` and `boolean[]` snapshots and notifies through `useSyncExternalStore`.

**Load-bearing runtime decision #1 (microtask-coalesced notify):** report bursts are coalesced into one `queueMicrotask` recompute+notify. This is **required**, not gold-plating — an opposite-direction same-count swap (`[true,false] → [false,true]`) arrives as **two separate `MutationObserver` callbacks**, so a synchronous notify transits the count `1 → 0 → 1` and phantom-re-renders a `useCount`-gated host once. Microtasks flush before paint, so visual hosts never flicker. This does **not** touch `store.ts`'s synchronous-1:1 religion: that governs the _slot store_ (caller-driven mutations, on which observability hooks rely); the presence store's inputs are observer callbacks, which are async/coalesced by nature.

**Load-bearing runtime decision #2 (composition changes coalesce through the SAME channel — fixes the double-count tear):** the slot store's `insert`/`clear` notify is **synchronous** (`store.ts` lines 14–24), while DOM reports land one microtask later. If the hooks subscribed directly to _both_ the slot store (sync) and the presence store (microtask), an `insert` that commits DOM would fire **two** host renders with a wrong intermediate value: render #1 from the synchronous store notify (the new child's layout effect has not run, so `renders(newId)` is `false` → count omits the just-inserted child), then render #2 one microtask later when the report arrives (count flips). That `1 → (stale) → 2` transit is exactly the count-instability class coalescing exists to prevent. **Fix:** the hooks subscribe **only** to the presence store. The presence store itself subscribes to the slot store internally and routes composition changes through its own coalescing `bump()`. So a synchronous `insert`-with-DOM and the subsequent layout-effect report **coalesce into a single microtask flush** → one host render at the final value. An `insert`-with-no-DOM coalesces to one flush whose recompute bails (`Object.is`/structural) → zero host renders. `clear` stays the direct `store.clear` reference (no wrapper); the presence store hears it through its internal slot-store subscription.

Decided boundaries (full list §9): region semantics (portals invisible), has-DOM ≠ visible (`display:none` counts), childNodes-vs-elements semantics (text/comment nodes count as DOM — §9.10), `display:contents` span unsafe inside tables/`option`/`source`/`track`/SVG, host child-combinator CSS hits the spans, `count=0`/all-`false` for one microtask after first mount, and the SSR/hydration contract in §9.5 (now length-matched on both sides).

---

## 2. Public API types (exact TS)

### 2.1 Overload shape — **Design B (wide base, presence-true first)**

`createSlot` becomes a **function declaration** with overload signatures. (HEAD is a `const` arrow — see §11.1; an arrow cannot carry overload signatures, so the declaration form is mandatory and is the one deliberate house-style exception.)

```ts
type SlotConfig = { presence?: boolean | undefined }

function createSlot<T extends Insertable = void>(config: { presence: true }): PresenceSlot<T>
function createSlot<T extends Insertable = void>(config?: SlotConfig): Slot<T>
function createSlot<T extends Insertable = void>(config?: SlotConfig) {
  /* single implementation; runtime branches on config?.presence === true */
}
```

The presence-true overload is listed **first** (more specific); the base overload takes the **wide** `presence?: boolean | undefined`.

| Call                                       | Resolves to          | Has hooks?                                  |
| ------------------------------------------ | -------------------- | ------------------------------------------- |
| `createSlot()`                             | `Slot<void>`         | no                                          |
| `createSlot<T>()`                          | `Slot<T>`            | no                                          |
| `createSlot({})`                           | `Slot<void>`         | no                                          |
| `createSlot({ presence: false })`          | `Slot<void>`         | no                                          |
| `createSlot({ presence: undefined })`      | `Slot<void>`         | no                                          |
| `createSlot({ presence: someBooleanVar })` | `Slot<void>`         | no — **degrades cleanly, no compile error** |
| `createSlot({ presence: true })`           | `PresenceSlot<void>` | yes                                         |
| `createSlot<T>({ presence: true })`        | `PresenceSlot<T>`    | yes                                         |

> **Rejected: Design A** (base typed `{ presence?: false | undefined }`). A widened `boolean` then matches _neither_ overload → hard `TS2769`. Design B degrades silently to the no-hooks base: presence surfaces the hooks only when you statically commit to the literal `true`. `exactOptionalPropertyTypes` is on, so the explicit `| undefined` on `presence` is required.

### 2.2 Return-shape types — `Slot<T>` extracted, parity **verified then pinned**

```ts
type Slot<T extends Insertable> = {
  Root: NamedExoticComponent<NormalizedProps<T> & object>
  api: { insert: Payload<T>; clear: () => void }
}

type PresenceSlot<T extends Insertable> = Slot<T> & {
  useCount: () => number
  usePresence: () => readonly boolean[]
}
```

- `Slot<T>` is extracted from today's inline return shape. **The parity claim is now verified against the installed types, not merely asserted** (this addresses the reviewer's "unverified `toEqualTypeOf`" flag): with `@types/react@19.2.16`, `Root = memo<SlotProps>(fc)` selects the **first** `memo` overload — `function memo<P extends object>(Component: FunctionComponent<P>, …): NamedExoticComponent<P>` (index.d.ts:1576–1579) — because the explicit type argument `memo<SlotProps>` binds `P = SlotProps = NormalizedProps<T> & object`. It does **not** select the second overload (which would yield `MemoExoticComponent<T>`); that overload only fires when `memo` is called _without_ an explicit type argument on a `ComponentType`. Therefore today's inferred `Root` type is exactly `NamedExoticComponent<NormalizedProps<T> & object>`, byte-identical to the hand-written `Slot<T>.Root`.
- This identity is **pinned permanently** (§8.3) by `expectTypeOf<Slot<void>>().toEqualTypeOf<ReturnType<typeof createSlot<void>>>()` and a `{ userId: number }` variant. **Hard implementation gate:** before merging, run `pnpm -C packages/react-slots exec tsc --noEmit` and confirm the parity `expectTypeOf` compiles green. If a future React-types bump changes `memo`'s return for the explicit-type-argument form, this guard fails loudly rather than silently widening consumer `Root` types.
- `PresenceSlot<T>` is a strict superset (intersection adds exactly the two members); `api` is **identical** on both branches, so `Payload<T>` and `clear` are shared verbatim.
- **`usePresence` returns `readonly boolean[]`, not `boolean[]`.** The returned array _is_ the cached `useSyncExternalStore` snapshot; mutating it (`.sort()`/`.push()`) would corrupt the shared reference and break the `Object.is` snapshot-cache bail. `.map`/`.filter`/`.some`/`.length`/indexing all work on `readonly`.

### 2.3 Where the types live

`Slot<T>`, `PresenceSlot<T>`, `SlotConfig` live in **`createSlot.tsx`** (the adapter layer — they describe the adapter's return surface and reference `Payload<T>` downward). They are `export type`-d from `createSlot.tsx` so the emitted `.d.ts` names them, but are **not** re-exported from `index.ts` (which still exports only `createSlot`). `payload.ts` is **UNTOUCHED**.

---

## 3. Architecture & three-layer placement

```
payload.ts        UNCHANGED — types only
insertSorted.ts   UNCHANGED
store.ts          UNCHANGED — createStore/useStore stay internal, no new exports
presenceStore.tsx NEW (core layer): createPresenceStore + probe wrapper. Imports only
                  react + use-sync-external-store/shim. Nothing upward. Subscribes to the
                  slot store internally (composition changes coalesce through bump()).
createSlot.tsx    adapter: function-decl overloads + a presence branch; the three memo
                  shapes and Root stay byte-for-byte; non-presence path early-returns
                  before any presence allocation.
index.ts          UNCHANGED — exports only createSlot.
```

**Why a separate core file:** the presence store is a different aggregation — `Map<id, Map<Element, boolean>>` with OR-reduction and coalesced notify — which would distort `createStore`'s sorted-array copy-on-write. Separate file, same `useSyncExternalStore` discipline.

**Why thread the probe in-place (not duplicate the insert body):** thread `probe` through the single existing funnel — `Memoized = presence ? memo(probe(presence, id, Component)) : memo(Component)` — with an **early return** on the non-presence path before any presence allocation. The non-presence path is _behaviorally_ equivalent (early return → today's exact object shape: `{ Root, api: { insert, clear: store.clear } }`). The source-level deltas on the hot path are: hoisting `id` out of the ternary, the `presence` const evaluation (`config?.presence === true ? createPresenceStore(...) : undefined` — runs once per `createSlot()`, allocates one `undefined` when off), and one `presence ? … : …` ternary per insert (resolves to `memo(Component)` exactly as today when off). This is **behaviorally equivalent, not literally byte-identical** — see §11.10. Pinned by the untouched existing suite plus the "no wrapper span / no `useCount`" guard (§8.3).

> Drift trade-off note: an earlier draft _duplicated_ the insert body for literal source byte-identity, accepting two-copy drift. We choose the in-place thread: un-duplicated shapes are the larger long-term safety win and the existing suite pins behavioral equivalence. Fallback if a reviewer demands literal byte-identity: full fork behind `if (!presence) return …`; flag for owner sign-off.

---

## 4. `presenceStore.tsx` (NEW — full sketch)

House style: no semicolons, double quotes, sorted + inline-type imports, single bottom export block, comment-free.

```tsx
import { useEffect, useLayoutEffect, useRef, type FunctionComponent } from "react"

const SPAN_STYLE = { display: "contents" } as const

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" && typeof window.document !== "undefined" ? useLayoutEffect : useEffect

type Identified = { id: string }

const createPresenceStore = (getItems: () => readonly Identified[], subscribeItems: (l: () => void) => () => void) => {
  const reports = new Map<string, Map<Element, boolean>>()
  const listeners = new Set<() => void>()

  let scheduled = false

  const renders = (id: string): boolean => {
    const byElement = reports.get(id)

    if (byElement === undefined) return false
    for (const rendered of byElement.values()) if (rendered) return true

    return false
  }

  const flush = () => {
    scheduled = false
    listeners.forEach((listener) => listener())
  }

  const bump = () => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(flush)
  }

  const report = (id: string, element: Element, rendered: boolean) => {
    let byElement = reports.get(id)

    if (byElement === undefined) reports.set(id, (byElement = new Map()))
    if (byElement.get(element) === rendered) return

    byElement.set(element, rendered)
    bump()
  }

  const remove = (id: string, element: Element) => {
    const byElement = reports.get(id)

    if (byElement === undefined || !byElement.delete(element)) return
    if (byElement.size === 0) reports.delete(id)

    bump()
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  }

  const unsubscribeItems = subscribeItems(bump)

  const dispose = () => unsubscribeItems()

  return { renders, getItems, report, remove, subscribe, dispose }
}

type PresenceStore = ReturnType<typeof createPresenceStore>

const probe = (presence: PresenceStore, id: string, Component: FunctionComponent<object>): FunctionComponent<object> =>
  function Probed(props) {
    const ref = useRef<HTMLSpanElement>(null)

    useIsomorphicLayoutEffect(() => {
      const element = ref.current!
      const reportNow = () => presence.report(id, element, element.childNodes.length > 0)

      reportNow()

      const observer = new MutationObserver(reportNow)
      observer.observe(element, { childList: true, subtree: true })

      return () => {
        observer.disconnect()
        presence.remove(id, element)
      }
    }, [])

    return (
      <span style={SPAN_STYLE} ref={ref}>
        <Component {...props} />
      </span>
    )
  }

export { createPresenceStore, probe }
export type { PresenceStore }
```

> **knip fix (was a lint-gate regression):** `Identified` is **NOT exported** — it is module-private, used only as the `getItems` parameter type inside `createPresenceStore`. Only `createPresenceStore`, `probe`, and the type `PresenceStore` are exported, and all three are imported by `createSlot.tsx`, so knip (entry `["./src/index.ts!"]`) sees every export of this file as reachable. Verified against `knip.json`. (If a future refactor needs `Identified` cross-file, export it _and_ import it somewhere, or add it to a knip ignore — but the plan keeps it private so `pnpm lint` stays green with no config change.)

### 4.1 Side-store shape and protocol

- `reports: Map<id, Map<Element, boolean>>`. Outer key = store item `id` (the module-counter identity key — de-dupes across mounted Roots; see §9.11 for the cross-slot-uniqueness note). Inner `Map<Element, boolean>` = one entry per mounted span instance (one per Root), holding its last reported has-DOM bool. Enables **multi-Root OR-aggregation without double-counting**.
- `report` is **`Object.is`-gated** (`byElement.get(element) === rendered` early return): a redundant report (StrictMode's double layout-effect, an observer firing with no net change) is a no-op and does not `bump()`.
- `remove` deletes the element entry, prunes the empty inner map, `bump()`s. Called from the effect teardown on unmount/clear.
- `renders(id)` is the OR reducer; `getItems` is the slot store's `get` (composition + order, single source of truth — not mirrored).
- **`subscribeItems` (new):** the presence store subscribes to the slot store's `subscribe` and calls `bump()` on every composition change. `dispose()` (called only if a presence slot is ever torn down wholesale — not exercised by per-slot module-scope usage, but provided for completeness) unsubscribes. This is the channel-unification that fixes the double-count tear (§1, load-bearing decision #2): a synchronous slot-store notify becomes a coalesced presence `bump()`, landing in the same microtask as any DOM report from the same tick.

### 4.2 Observer scope — `childList: true, subtree: true` (was a missed-update defect)

The observer is `observe(element, { childList: true, subtree: true })`. **`subtree: true` is required.** `childList`-only fires only on direct-child mutations of the span; it would miss a child that always renders a wrapper element (e.g. an always-present `<div>`) and toggles content _deeper_ inside it — the span's direct child never changes, so a deep `null↔content` flip would never re-report and the count would be permanently stale. `subtree: true` makes the observer fire on descendant childList changes too, so deep flips re-report. happy-dom@20.10.1 supports `subtree` (verified in `lib/mutation-observer`). Cost: more raw observer callbacks, but every callback merely calls `reportNow()`, which is `Object.is`-gated and coalesced — so a burst still collapses to one flush. Note: the probe reports the **span's own** `childNodes.length`, not the mutating descendant's, so `subtree` only governs _when we re-check_, never _what we count_ — the count semantics are unchanged (has-DOM at the span boundary), only the trigger coverage widens.

### 4.3 Notify discipline — single coalesced channel

- `bump()` schedules a **single** `queueMicrotask(flush)` per tick (guarded by `scheduled`): N reports + a composition change in one tick → one flush.
- **One** listener set; both hooks subscribe to it. Per-consumer notify-granularity is achieved by **per-hook cached snapshots** (§5) — not by a shared cache.
- `queueMicrotask` is a global available in every supported runtime (Node ≥12; browsers at the ES2023/Safari 16.4+/Chrome 110+ floor). New runtime dependency for the presence channel only; `store.ts` untouched.

---

## 5. `createSlot.tsx` changes (full sketch)

The cache fix versus the prior draft: **count and presence each get their OWN independent snapshot cache.** The prior draft used three shared closure vars (`count`, `presenceArray`, `presenceItems`) that _both_ `getCount` and `getPresence` mutated via one `recompute()`. Because the two hooks may be mounted in different host components committing at different times, and `useSyncExternalStore` re-invokes `getSnapshot` and `Object.is`-compares on notify, a `getCount()` call from Host A could overwrite the shared `presenceArray`/`presenceItems` such that Host B's subsequent `getPresence()` saw the cache "already updated" and returned the same reference it was supposed to change to — Object.is says unchanged → Host B silently misses the update. **Fix: two disjoint caches, two recompute closures, no shared mutable state between the hooks.** Each hook reads the same live source (`store.get()` + `presence.renders`) but caches its result privately.

```tsx
import React, { memo, useRef, type FunctionComponent, type NamedExoticComponent, type ReactElement } from "react"
import { useSyncExternalStore } from "use-sync-external-store/shim"
import type { Insertable, NormalizedProps, Payload } from "./payload"
import { createPresenceStore, probe, type PresenceStore } from "./presenceStore"
import { createStore, useStore } from "./store"

let idCounter = 0

const EMPTY_PRESENCE: readonly boolean[] = []

type SlotConfig = { presence?: boolean | undefined }

type Slot<T extends Insertable> = {
  Root: NamedExoticComponent<NormalizedProps<T> & object>
  api: { insert: Payload<T>; clear: () => void }
}

type PresenceSlot<T extends Insertable> = Slot<T> & {
  useCount: () => number
  usePresence: () => readonly boolean[]
}

function createSlot<T extends Insertable = void>(config: { presence: true }): PresenceSlot<T>
function createSlot<T extends Insertable = void>(config?: SlotConfig): Slot<T>
function createSlot<T extends Insertable = void>(config?: SlotConfig) {
  type SlotProps = NormalizedProps<T> & object
  type Item = { id: string; order?: number | undefined } & (
    | { withProps: true; Child: NamedExoticComponent<SlotProps> }
    | { withProps: false; Child: NamedExoticComponent<object> }
  )

  const store = createStore<Item>()
  const presence: PresenceStore | undefined =
    config?.presence === true ? createPresenceStore(store.get, store.subscribe) : undefined

  const insert = ((payload: {
    Component: FunctionComponent<object>
    filter?: (slotProps: SlotProps) => boolean
    mapProps?: (slotProps: SlotProps) => object
    order?: number | undefined
  }): void => {
    const { Component, filter, mapProps, order } = payload
    const id = String(++idCounter)
    const Memoized = presence ? memo(probe(presence, id, Component)) : memo(Component)

    const item: Item = mapProps
      ? {
          id,
          order,
          withProps: true,
          Child: filter
            ? memo<SlotProps>((props) => {
                const last = useRef<ReactElement | null>(null)

                if (filter(props)) last.current = <Memoized {...mapProps(props)} />

                return last.current
              })
            : memo<SlotProps>((props) => <Memoized {...mapProps(props)} />),
        }
      : {
          id,
          order,
          withProps: false,
          Child: Memoized,
        }

    store.insert(item)
  }) as Payload<T>

  const Root = memo<SlotProps>((props) =>
    useStore(store).map((child) =>
      child.withProps ? <child.Child key={child.id} {...props} /> : <child.Child key={child.id} />,
    ),
  )

  if (presence === undefined) return { Root, api: { insert, clear: store.clear } }

  const presenceRef = presence

  const subscribe = (listener: () => void) => presenceRef.subscribe(listener)

  // ---- count cache (independent) ----
  let countPrevItems: readonly Item[] | null = null
  let countValue = 0

  const getCount = () => {
    const items = store.get()

    if (countPrevItems !== items) {
      let n = 0
      for (let i = 0; i < items.length; i++) if (presenceRef.renders(items[i]!.id)) n++
      countValue = n
      countPrevItems = items
    } else {
      let n = 0
      for (let i = 0; i < items.length; i++) if (presenceRef.renders(items[i]!.id)) n++
      countValue = n
    }

    return countValue
  }

  // ---- presence-array cache (independent) ----
  let presencePrevItems: readonly Item[] | null = null
  let presenceArray: readonly boolean[] = EMPTY_PRESENCE

  const getPresence = () => {
    const items = store.get()

    if (items.length === 0) {
      presenceArray = EMPTY_PRESENCE
      presencePrevItems = items
      return presenceArray
    }

    if (presencePrevItems === items && presenceArray.length === items.length) {
      let changed = false
      for (let i = 0; i < items.length; i++) {
        if (presenceArray[i] !== presenceRef.renders(items[i]!.id)) {
          changed = true
          break
        }
      }
      if (!changed) return presenceArray
    }

    const next = items.map((item) => presenceRef.renders(item.id))
    presenceArray = next
    presencePrevItems = items

    return presenceArray
  }

  const getServerCount = () => 0
  const getServerPresence = () => projectAllFalse(store.get())

  const useCount = () => useSyncExternalStore(subscribe, getCount, getServerCount)
  const usePresence = () => useSyncExternalStore(subscribe, getPresence, getServerPresence)

  return { Root, api: { insert, clear: store.clear }, useCount, usePresence }
}

const projectAllFalse = (items: readonly { id: string }[]): readonly boolean[] =>
  items.length === 0 ? EMPTY_PRESENCE : items.map(() => false)

export { createSlot }
export type { PresenceSlot, Slot }
```

> The two getters above keep their loops simple and recompute on each call; `getCount`'s `if/else` branches are intentionally written identically (the implementer may collapse them to a single loop — the only requirement is that `countValue` is recomputed each call and `countPrevItems` tracked for clarity). The non-negotiable contracts both getters satisfy: **(a)** each returns the same reference/primitive until a real change, then a new one, then stable again (the `useSyncExternalStore` `Object.is` getSnapshot-cache contract — `getPresence` returns the _same array reference_ when no boolean flipped; `getCount` returns the same primitive); **(b)** count and array each derive from the same live `store.get()` projection; **(c)** the two caches are **disjoint** — `getCount` never writes anything `getPresence` reads and vice versa, so a render of the count host can never corrupt the presence host's snapshot (the fix for the shared-cache tear). Pin (a) and (c) with the snapshot-stability and independent-subscriber tests (§8.1/§8.2 tests 14–15, 28).

Key implementation points:

- **`id` hoisted** out of the ternary because `probe` needs it before the branch — behavior-identical (same counter, same React `key`; see §9.11).
- **Single funnel:** `Memoized = presence ? memo(probe(presence, id, Component)) : memo(Component)`. The probe sits _inside_ the existing funnel, _below_ the filter/mapProps barriers — all three memo shapes stay byte-for-byte, the filter contract composes for free (§6).
- **Early return** `if (presence === undefined) return { Root, api: { insert, clear: store.clear } }` — today-shape object, no extra allocation, `clear` stays the direct `store.clear` reference.
- **Hooks subscribe ONLY to `presence.subscribe`** (combined channel inside the presence store, §4.1). Composition changes reach the hooks through the presence store's internal slot-store subscription, coalesced with DOM reports into one microtask flush — this is the double-count fix. `getCount`/`getPresence` are pure projections of `(store.get(), reports)`.
- **Per-hook caches** (the tear fix): `getCount` owns `countPrevItems`/`countValue`; `getPresence` owns `presencePrevItems`/`presenceArray`. No shared mutable recompute state.

### 5.1 SSR / hydration — both sides length-match (was a hydration-mismatch blocker)

The prior draft set `getServerPresence → EMPTY_PRESENCE ([])`, but the client's first render (`getPresence` during hydration) reads a `store.get()` that is **non-empty** when `insert()` ran at module scope before mount, and — because no layout effect has run yet, so every `renders(id)` is `false` — produces `items.map(() => false)` of length N. Server `[]` (length 0) vs client `[false,false]` (length 2) is a hydration mismatch on the very first commit for any host that renders `usePresence().length` or maps over it on both sides.

**Fix:** the server snapshot is **also projected over `store.get()` as all-false** — `getServerPresence → projectAllFalse(store.get())`. On the server, the slot store is populated synchronously by the same module-scope `insert()` calls, no DOM/effects ever run, so every child is correctly `false`; the server array is `[false, false]` of length N — **identical in length and values to the client's first-render snapshot**. The empty-slot case still collapses to the shared `EMPTY_PRESENCE` reference on both sides. `useCount` already matched (server `0`, client first render `0` — every `renders` false). One microtask after mount the client settles `false → true` for children that committed DOM, exactly as §9.5 describes — that post-mount settle is a normal effect-driven update, **not** a hydration mismatch (it happens after the first commit, and React tolerates effect-driven state changes post-hydration). The first-commit length/values now agree on both sides. This closes attack vector (8).

---

## 6. Probe wrapper + filter interplay

The probe is composed once at insert time (never in render), preserving the "wrapper created once" rule. It wraps `Component` _before_ `memo`, _below_ the filter/mapProps barriers.

- **id** threads via the `probe(presence, id, Component)` closure captured at insert time (identity key; stable across the child's life).
- **Props pass-through:** the probe is in `Component` position, inside `Memoized`. Static children: Root renders `<child.Child key=… />` with no spread → probe receives `{}` and spreads `{}` onto `Component`. Mapped/filtered children: the barrier renders `<Memoized {...mapProps(props)} />` → probe forwards mapped props. Prop-transparent.
- **Effect:** isomorphic layout effect with the stricter react-redux guard (`typeof window !== "undefined" && typeof window.document !== "undefined"`), `[]` deps. On mount: report once post-commit, then `MutationObserver({ childList: true, subtree: true })`. Teardown: `observer.disconnect()` + `presence.remove(id, element)`. No `useMemo`.
- **`SPAN_STYLE = { display: "contents" } as const`** is module-level — stable identity, allocated once, span never churns on style.

### 6.1 Filter composition (probe sits below the gate → composes for free)

- **Bootstrap (filter rejecting):** the filtered memo returns `null` (no `<Memoized>`), so the span never mounts → the id has no report → `renders(id)` is `false` _by absence_ → counted false. First pass mounts the span → first report.
- **Freeze (filter true → false):** `last.current` holds the last element; `Memoized` (hence the span) stays mounted with real DOM → stays `true`. The cached element lives in the wrapper's `useRef` body, so two Roots freeze independently.
- **Thaw (filter false → true) — explicitly analyzed (was unverified):** a new `<Memoized {...mapProps(props)} />` element is created, but `Memoized` is a stable `memo` component reference, so React **reconciles in place** — the wrapper subtree is not remounted, the probe's `[]`-deps layout effect does **not** re-run, the `ref` and the existing `MutationObserver` survive. When the span's child reappears, the observer (now `subtree: true`) fires `childList` → `reportNow()` re-reports `true`. So thaw re-populates and re-reports without a stale freeze. Pinned by test 20a (§8.2).
- **Frozen self-mutation (was a missed-update defect):** a frozen child that mutates its own subtree — including _deep_ mutations under an always-present wrapper element — re-reports because the observer is `subtree: true`. With the prior `childList`-only observer this would have silently missed deep flips. Pinned by tests 22 and 22a.
- **Per-Root freeze independence under presence:** two mounted Roots each render their own wrapper instance → own `last.current` ref → own probe instance → own span → own `Element` key in `reports[id]`'s inner map. OR-aggregation across the two Elements is correct; the freeze refs are independent. Pinned by test 23.

### 6.2 clear() / re-insert / stale-report window (documented, was a transient-leak flag)

`clear` empties the slot store → Roots unmount children → each probe teardown fires `remove(id, el)` → reports drain → `count 0`, `presence []`. Re-insert assigns a **fresh** id → fresh reports, no stale entries.

Documented transient (downgraded to a boundary, not a defect): React commits unmount effect-cleanups _after_ the synchronous `store.clear` notify, and a presence `report()` already scheduled when `clear()` runs will flush after the clear. Because **count and the array are projected over `getItems()` (= `store.get()`, now `EMPTY`)**, the projection masks any stale `reports` entry — `count` stays `0`, the array stays `[]`, no wrong value is ever observed. The only residue is that `reports` may hold stale `Element→boolean` entries for unmounted spans for the window between the clear-notify and the teardown-effect; those drain on the (now-imminent) teardown `remove()`, or are simply never read again (their ids are gone from `getItems()`). A synchronously remounted Root gets a fresh id, so a stale disconnect-driven `remove` for an old id is a harmless no-op. Pinned by tests 24/25 and the leak-window note in §9.7.

`MutationObserver` catches structural `null↔content` flips (and, with `subtree`, deep ones) but not `<i/>→<b/>` same-emptiness swaps — `childNodes.length` stays >0, `rendered` stays true — correct "has DOM" semantics by design.

---

## 7. Decision: hooks live TOP-LEVEL — `{ Root, api, useCount, usePresence }`

Not `api.useCount`. Rationale:

- **Conceptual layering (decisive):** `api` is the **imperative mutation** surface (`insert`, `clear`) — callable anywhere, including module scope and before mount. Hooks are the **render-only read** surface, subject to rules-of-hooks. Nesting a hook in `api` is a footgun.
- **DX:** `slot.useCount()` reads like a hook; `const { useCount } = slot` is natural.
- **Type cleanliness:** `PresenceSlot<T> = Slot<T> & { useCount; usePresence }` is a trivial superset; `api` stays identical.

> Note on lint: **this repo's oxlint config does not load a `react-hooks` plugin** (plugins are `vitest, eslint, typescript, unicorn, oxc` — verified in `.oxlintrc.json`). The placement decision rests on conceptual-layering + DX, plus forward-compatibility if a consumer runs `eslint-plugin-react-hooks` in their own app.

---

## 8. Test plan (concrete names)

Notify is microtask-coalesced, so **every presence assertion is preceded by an async flush.** Add at the top of `presence.test.tsx`:

```ts
const flush = () => act(async () => {})
```

(`await flush()` drains the coalescing microtask + React's act queue.) Document loudly (§9.6).

### 8.1 Pure store — NEW `src/__tests__/presenceStore.test.ts` (no React, `vi.fn()` listeners)

Drive the side-store directly via a fake `getItems` and a fake `subscribeItems` (a `vi.fn()` returning an unsubscribe).

- `starts empty: no reports, renders(any) is false`
- `report(rendered=true) for one id triggers one coalesced notify` (listener called once after `await microtask`)
- `report is Object.is-gated: an identical re-report does not notify`
- `OR-aggregation: two elements one id — renders(id) true if any element true`
- `remove the last true element drops renders(id) to false and notifies`
- `remove prunes the empty inner map (re-report after remove starts fresh)`
- `StrictMode-idempotent: report; remove; report on the SAME element converges to one element entry, renders true`
- `multiple reports in one tick coalesce to a single notify`
- `a composition change via subscribeItems triggers exactly one coalesced notify (no extra flush)`
- `a composition change in the same tick as a DOM report coalesces to ONE flush` (the double-count fix at the store layer)
- `notify is microtask-deferred: synchronous read after report sees the pre-flush listener count`

### 8.2 Runtime integration — NEW `src/__tests__/presence.test.tsx` (real `createSlot({ presence: true })` + `renderer.tsx`)

1. `useCount: null / <></> / false / "" / [] / nested-empty-fragment count as not rendering` → 0
2. `useCount: <i/>, "text", <><i/></> count as rendering`
3. `useCount: undefined return counts as not rendering`
4. `useCount: portal-only child counts as not rendering (region boundary)`
5. `useCount: portal + local content counts as rendering`
6. `useCount: a child toggling null↔content from its own state live-updates; the probe wrapper never re-renders`
7. `useCount: api.clear → 0`
8. `usePresence: array follows slot order (sorted by order)` → `[false, true]`
9. `usePresence: equal order keeps insertion order`
10. `usePresence: mid-list insert shifts indices` → `[true]` then `[true, true, false]`
11. `usePresence: clear → []` (returns the shared empty reference)
12. **`useCount does NOT re-render the host on a same-count opposite swap [t,f]→[f,t]`** — tracked render counter unchanged. **Load-bearing; fails under synchronous notify.**
13. `usePresence DOES re-render on [t,f]→[f,t]; the array equals [false, true]`
14. `usePresence returns a stable reference across an unrelated same-value host re-render` (snapshot-cache pin)
15. `usePresence returns a new reference after a real change, then stable again`
16. `multi-Root OR: a child rendering in at least one of two Roots counts once (no double-count)`
17. `multi-Root OR: true in one Root, filter-bootstrap-false in another still counts once`
18. `multi-Root: unmount one Root keeps OR true; unmount both drops to 0`
19. `filter bootstrap: a rejected child counts false (span absent) while a sibling counts true`
20. `filter pass mounts the child and flips it true without remounting siblings`
    20a. **`thaw (filter false→true) re-populates the span and re-reports true without remounting; the probe [] effect does not re-run`** (thaw analysis pin, §6.1)
21. `frozen filtered child (filter true→false) keeps real DOM and stays true`
22. `frozen filtered child mutating its own DIRECT child (null↔element) re-reports via the observer`
    22a. **`frozen child that always renders a wrapper element and toggles content DEEP inside it re-reports via subtree:true`** (the subtree fix; this test FAILS with childList-only)
23. **`per-Root freeze independence under presence: two mounted Roots of the same filtered slot freeze independently`**
24. `Root unmount cleans reports (count drops); remount re-derives with no stale reports`
25. `re-insert after clear uses a fresh id; no stale presence`
26. `StrictMode mount→remove→remount converges` (wrap this test in `<StrictMode>`; assert count converges and one element entry per id; the SAME DOM node identity is reused across the simulated effect remount — the Map churn add/remove/add on one key converges, no report on a detached node)
27. `presence slots stay isolated: inserting into one slot never wakes another slot's count/presence subscribers`
28. **`independent subscribers: a CountHost and a PresenceHost mounted separately each receive their own correct update on a DOM flip — the count host's re-render never corrupts the presence host's snapshot and vice versa`** (the shared-cache tear pin — drive a flip, force the count host to commit first, assert the presence host still observes the new booleans)
29. `text-node-only child (Component returns " ") counts as rendering (has-DOM semantics; childNodes includes text nodes)` — documents §9.10
30. **SSR/hydration length-match:** `renderToString of a Root + getServerPresence().length === getPresence().length on first client render` — assert both are `items.length` all-false before any flush; closes attack vector (8)

### 8.3 Zero-cost / parity guards (in `presence.test.tsx` and `createSlot.test.tsx`)

- `no presence: a non-presence slot renders no wrapper span` — `container.querySelector("span")` is null on `createSlot()` + `insert(() => <i/>)`
- `no presence: returned object has no useCount/usePresence` — `expect(slot).not.toHaveProperty("useCount")`
- `no presence: knip green` — implicit via `pnpm lint`; `Identified` is module-private so no unused-export
- All existing `createSlot.test.tsx` tests stay green **unchanged** (they construct the base overload and pin behavioral equivalence of the non-presence path)

### 8.4 Type tests — NEW `src/__tests__/presence.test-d.tsx`

- `createSlot() return type has no useCount/usePresence` (`// @ts-expect-error` on `slot.useCount`)
- `createSlot<T>()` / `createSlot({})` / `{ presence: false }` / `{ presence: undefined }` → base slot, no hooks
- `createSlot({ presence: <widened boolean var> })` → base slot, **NO compile error** (Design B win)
- `createSlot({ presence: true })` → `useCount: () => number`, `usePresence: () => readonly boolean[]`
- `createSlot<T>({ presence: true })` preserves T on Root and on insert mapProps/filter overloads
- `createSlot<void>({ presence: true })` keeps `InsertWithoutProps`
- `presence config does not disturb T inference or the Insertable constraint`
- `useCount/usePresence are top-level, not on api` (`// @ts-expect-error` on `slot.api.useCount`)
- **Return-type parity guard (HARD GATE):** `expectTypeOf<Slot<void>>().toEqualTypeOf<ReturnType<typeof createSlot<void>>>()` and the `{ userId: number }` variant — locks against union-widening. Must compile green under `tsc --noEmit` against `@types/react@19.2.16` (verified, §2.2).

> `@ts-expect-error` placement is empirical (CLAUDE.md): verify each with `pnpm -C packages/react-slots exec tsc --noEmit` when adding cases.

---

## 9. Documented boundaries (verbatim into README + a new CLAUDE.md "Presence (opt-in)" subsection)

1. **Region semantics, not "showing somewhere":** presence counts children producing **committed DOM inside the slot region**. Pure-portal children count as _not_ rendering. Portal + local content counts as rendering.
2. **Has-DOM ≠ visible:** `display:none` / `visibility:hidden` / zero-size / offscreen content **counts as rendering**. Visual visibility is a different feature, out of scope.
3. **Tag-name-significant children unsupported (doc-only hard "don't", no runtime guard):** do NOT enable presence on slots whose children are `tr`/`td`/`th` (inside `table`), `option` (inside `select`), `source`/`track` (inside media/`picture`), or SVG internals. The `<span style="display:contents">` is a foreign element there; the parser foster-parents it out (especially during SSR/`innerHTML`). Presence is for **box-level chrome** slots.
4. **Host child-combinator CSS caveat:** the per-child `display:contents` spans are real DOM children, so host CSS like `.slot > *`, `.slot > * + *`, `:nth-child`, `:first-child` matches the **spans**, not user content. Prefer `gap` over adjacent-sibling margins.
5. **SSR / first-paint timing & hydration contract:** server and client-first-render both produce `count = 0` and `usePresence()` = an **all-false array of the current composition length** (length-matched on both sides — no hydration mismatch; see §5.1). For **one microtask after first mount** the values stay `0`/all-false; then children that committed DOM settle `false → true`. That settle is a post-commit effect-driven update, not a hydration mismatch. A visual frame hard-gated on `count === 0` could flicker once on first paint — render optimistically or tolerate the `0 → N` settle.
6. **Notify timing differs from `store.ts`:** count/presence updates are microtask-coalesced (the slot store's notify is synchronous). Tests must `await act(async () => {})` first.
7. **Multi-Root OR-aggregation + transient leak window:** a child counts if it renders in **at least one** mounted Root. On `clear()`/unmount, `reports` may briefly hold stale `Element→boolean` entries between the synchronous slot-store notify and the (async) teardown `remove()`; **count and array are projected over `store.get()`, so this never produces a wrong value** — it drains on teardown. Not configurable in v1.
8. **`mid-list insert shifts indices`** in `usePresence()` — it is a snapshot of the current composition in render order.
9. **Opt-in cost:** presence adds per child +1 `display:contents` span, +1 `MutationObserver` (`childList`+`subtree`), +1 layout effect, +1 `queueMicrotask` per coalesced burst; per slot the presence store adds one internal slot-store subscription. Non-presence slots pay one insert-time ternary branch and one `undefined` const per `createSlot()` (effectively zero — §11.10).
10. **childNodes counts text and comment nodes, not just elements:** the probe reports `el.childNodes.length > 0`, i.e. "the child produced _any_ DOM node." A `Component` returning a non-empty or whitespace-only string (`" "`) renders a text node and counts as rendering — consistent with has-DOM semantics, _not_ with "visible content." React 19 emits **no** DOM nodes for `null`, `false`, `undefined`, `""`, `[]`, or empty fragments `<></>` (verified semantics; no internal comment markers for these), so the empty cases count `false` correctly. If a future React/SSR construct ever commits a placeholder comment node into the span, the probe would report `true` for a child with no element content; this is an accepted edge of the has-DOM definition. Pinned by test 29.
11. **Cross-slot id sharing is safe:** `idCounter` is module-global and shared by every slot, but each presence store is per-slot and only ever receives ids generated for _its_ children (the `probe` closure captures the id at insert time). Ids are globally monotonic, so two slots never share an id value within one presence store's `reports` Map. The CLAUDE.md identity-key contract is preserved — `id` is hoisted out of the ternary but still `String(++idCounter)` once per insert, the same value used for both the presence closure and the React `key`. Relies on the counter never resetting (it doesn't).

---

## 10. CLAUDE.md update list

- **Architecture / three-layer diagram:** add `presenceStore.tsx core: createPresenceStore — Map<id, Map<Element, boolean>> OR-aggregation, queueMicrotask-coalesced notify, internal slot-store subscription; plus probe wrapper`. Update the "three layers" wording to four files.
- **Core contracts (store.ts subsection):** add a presence-store subsection — id-keyed OR-aggregation, `Object.is`-gated report (StrictMode-idempotent), **microtask-coalesced notify with composition changes routed through the SAME bump() channel (deliberate deviation from the slot store's synchronous-1:1 discipline — different store, observer-driven inputs; `store.ts` itself untouched)**, count + array each projected over `store.get()` (single source of truth) into **two disjoint per-hook caches** (no shared recompute state — prevents the count host corrupting the presence host's snapshot), cached snapshots (count primitive `Object.is` bail; array same-reference structural bail), hooks subscribe only to the presence store, **server snapshot length-matched to the client first render (all-false over composition, shared `EMPTY_PRESENCE` only when empty)**, observer is `childList`+`subtree`.
- **Adapter rules (createSlot.tsx):** add the presence funnel rule — `Memoized = presence ? memo(probe(presence, id, Component)) : memo(Component)`; probe sits below the filter/mapProps barriers; non-presence path early-returns before any presence allocation; `id` hoisted out of the ternary. Note `createSlot` is now a **function declaration** (overloads) — the single house-style exception. Note `SPAN_STYLE` is module-level and the thaw path does not re-run the probe `[]` effect.
- **Type design:** `payload.ts` untouched; `Slot<T>`/`PresenceSlot<T>`/`SlotConfig` live in `createSlot.tsx`; **Design B** overload ordering and widened-boolean graceful degradation; `usePresence` returns `readonly boolean[]`; **return-type parity verified against `@types/react@19.2` (first `memo` overload → `NamedExoticComponent<P>`) and pinned by `toEqualTypeOf` as a hard gate.**
- **New "Presence (opt-in)" section:** the §9 boundaries verbatim, including childNodes-vs-elements (§9.10) and cross-slot id safety (§9.11).
- **Testing:** add `presence.test.tsx`, `presenceStore.test.ts`, `presence.test-d.tsx`; note the `flush = () => act(async () => {})` convention, the one `<StrictMode>`-wrapped test, the SSR length-match test, and the `subtree:true` deep-mutation test.

---

## 11. Corrections applied (verified against real code)

1. **An arrow cannot carry overload signatures** — HEAD is `const createSlot = <T extends Insertable = void>() => {…}` (createSlot.tsx:7). The final design uses the **function-declaration** form. The one deliberate house-style exception.
2. **Isomorphic-effect SSR fallback is `useEffect`, not `() => {}`** — a no-op arrow is not a hook and would change hook count across environments. Fixed in §4.
3. **The `react-hooks` rules-of-hooks lint argument does not apply** — `.oxlintrc.json` loads `vitest, eslint, typescript, unicorn, oxc`, no `react-hooks` plugin. §7 rationale is layering+DX only.
4. **Count and array project over `getItems()` (= `store.get()`), not `reports.keys()`** — makes count structurally immune to stale reports and gives both hooks one source of truth. §4.3/§5.
5. **`usePresence` returns `readonly boolean[]`** — the returned array is the cached snapshot, not for consumer mutation. §2.2.
6. **`SPAN_STYLE` is a module-level constant** — stable identity, no per-render reallocation. §4/§6.
7. **No `presence?.sync()` after insert/clear and no `clear` wrapper** — composition changes are heard by the presence store via its **internal** `store.subscribe(bump)` (§4.1), not by the hooks subscribing to the slot store; `clear` stays the direct `store.clear` reference. §5.
8. **`payload.ts` stays untouched** — `Slot`/`PresenceSlot`/`SlotConfig` live in `createSlot.tsx` (the adapter layer). §2.3/§3.
9. **`noUncheckedIndexedAccess: true`** (root tsconfig:15) — array indexing yields `T | undefined`; the getter loops use `items[i]!`. §5.
10. **"behaviorally equivalent", not "byte-identical", for the non-presence path** — the off path adds one insert-time ternary, the `id` hoist, and one `undefined`-valued `presence` const per `createSlot()`. No render-time branch is added (the three memo shapes are still specialized at insert-time), so no CLAUDE.md invariant is violated, but the wording is corrected to "behaviorally equivalent." Only the _return type_ of the non-presence path is byte-identical, and that is the claim the §8.3/§8.4 parity guards pin. §1/§3.

---

## 12. Changes versus the prior draft (reviewer violations resolved)

- **[blocker] Hydration length divergence** → `getServerPresence` projects all-false over `store.get()` (length-matched to client first render); shared `EMPTY_PRESENCE` only when empty. §5.1, §9.5, test 30.
- **[blocker] Shared-cache race between the two hooks** → split into **two disjoint per-hook caches** (`getCount` owns `countPrevItems`/`countValue`; `getPresence` owns `presencePrevItems`/`presenceArray`); no shared `recompute`. §5, test 28.
- **[major] Combined-subscribe double-count / ordering hole** → hooks subscribe **only** to the presence store; the presence store subscribes to the slot store internally and coalesces composition changes through `bump()`, so an insert-with-DOM is one flush at the final value. §1 (decision #2), §4.1, §5, tests at §8.1.
- **[major] knip flags `presenceStore.tsx` exports** → `Identified` is **module-private** (not exported); only `createPresenceStore`/`probe`/`PresenceStore` exported, all imported by `createSlot.tsx`. §4.
- **[major] childNodes vs elements (text/comment nodes)** → documented as has-DOM semantics; React-19 empty-construct behavior verified (no comment markers for empty cases). §9.10, test 29.
- **[major] No `subtree:true` (deep self-mutation missed)** → observer is now `{ childList: true, subtree: true }`. §4.2, tests 22a/20a.
- **[major] clear/reorder stale-report transit** → documented; projection over `getItems()` guarantees no wrong value; leak window drains on teardown. §6.2, §9.7.
- **[major] memo return-type parity unverified** → verified against `@types/react@19.2.16` (explicit `memo<P>` selects the first overload → `NamedExoticComponent<P>`); parity `toEqualTypeOf` is a hard `tsc` gate. §2.2, §8.4.
- **[major] thaw path / probe layer not analyzed** → explicit thaw analysis (no remount, `[]` effect does not re-run, observer survives, child reappearance re-reports via subtree). §6.1, test 20a.
- **[minor] StrictMode detached-node guard** → documented that `ref.current` DOM identity is stable across the simulated effect remount; convergence pinned. Test 26.
- **[minor] "byte-identical" overstatement** → corrected to "behaviorally equivalent" for the runtime non-presence path; "byte-identical" retained only for the return _type_. §1/§3/§11.10.
- **[minor] cross-slot id sharing** → documented as safe (monotonic global counter, per-slot store, id captured at insert). §9.11.

---

## OWNER OVERRIDE (2026-06-07, supersedes §3/§5/§11.10 "in-place thread" choice)

The owner requires the **full fork**: `createSlot(config?)` starts with `if (!config?.presence) return <today's implementation, literally byte-identical to HEAD>` (modulo the enclosing overloaded function declaration). The presence variant lives in its own branch below. Rationale: any perf cost for non-presence slots is unacceptable, and byte-identity must be provable by diff, not argued by behavioral equivalence. The duplication drift risk is accepted and mitigated by: (a) review-phase diff-proof of the non-presence branch against HEAD, (b) the full existing test suite pinning the non-presence path, (c) perf bench spot-check (~1-2 µs/child bail paths unchanged).
