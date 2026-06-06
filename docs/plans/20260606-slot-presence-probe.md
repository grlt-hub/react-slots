# Slot presence probe — research findings (pre-design)

**Status: research complete, verified by passing tests. API design NOT started (brainstorm interrupted). No library code changed.**

Next step when resuming: design the public API (open questions at the bottom), then plan, then implement.

## The question

Can a host know — reactively — whether the children inserted into a slot are actually rendering anything right now, even when they return `null` / `undefined` / `<></>` / `[]`? A third-party claim said this is fundamentally impossible without a cooperative `useSlotPresence(visible)` self-report protocol (children opt in via context).

## Verdict (dialectic: thesis vs antithesis agents + empirical verification)

The claim's **diagnosis is correct**, its **prescription is overstated**:

- TRUE: a child's render output is unobservable at the React element/fiber layer (no legal API; refs give `null` for null renders; `findDOMNode` removed in React 19, which is inside our peer range `>=16.8 <20`).
- TRUE: insert-count + slot-container DOM cannot be combined into truth — `[portal, null]` and `[null, null]` produce the identical probe vector `(count=2, DOM=0)` with different truths (1 vs 0). Information-theoretic dead end.
- FALSE: "the only solution is cooperative self-report". The render output **is** legally observable at the **committed-DOM layer**, post-commit, per child — because the library already controls a wrapper around every inserted child (`createSlot.tsx`, insert-time memo wrapper).
- NUANCE: there are two different truths. "Has DOM in the slot region" (right for frame/section-header hosts) vs "plugin is showing something somewhere" (right for analytics; includes portals). The probe answers the first with zero cooperation; only the second needs opt-in self-report, and only for portal-only children.

## The mechanism (proven)

Per-child wrapper added at insert time (where the memo wrapper is already created):

```tsx
const Probed = (props) => {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = ref.current!
    const report = () => presence.report(el, el.childNodes.length > 0)
    report() // after first commit

    const observer = new MutationObserver(report)
    observer.observe(el, { childList: true }) // catches null ↔ content thereafter

    return () => {
      observer.disconnect()
      presence.remove(el)
    }
  }, [])

  return (
    <span style={{ display: "contents" }} ref={ref}>
      <Component {...props} />
    </span>
  )
}
```

Two load-bearing tricks:

1. `display: contents` — the span generates no box; children participate in the parent's layout (grid/flex unaffected), but `childNodes` is honest, so emptiness is a structural check with no layout dependency (works even in happy-dom).
2. `MutationObserver` instead of effects — when the child flips `null → content` from its **own** state, the memoized wrapper does not re-render and its effects do not re-run; the observer catches the DOM mutation anyway. Pinned by a render-counter assertion in the PoC.

Presence side-store: `Map<Element, boolean>` keyed by the wrapper element (no id plumbing needed), recompute count, notify only on count change, host reads via `useSyncExternalStore(subscribe, get, get)` — same shape as `store.ts`/`useStore.ts`.

## Implementation notes: SSR warning & effect phase

A classic trap that applies exactly to a DOM probe: the **SSR warning**. On server render `useLayoutEffect` does not run (no effects do), but React 16/17/18 loudly complains to the console:

```
Warning: useLayoutEffect does nothing on the server...
```

(React 19 dropped this warning, but our peer range starts at 16.8.)

Standard cure — an isomorphic alias that picks the hook by environment:

```ts
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect
```

This is what react-redux, framer-motion, and half the ecosystem do. For the probe it means: the measurement itself still only happens on the client (there are no DOM effects on the server), but without the alias every SSR render of the slot sprays warnings. (Detail: react-redux's check is stricter — `typeof window !== "undefined" && typeof window.document !== "undefined" && typeof window.document.createElement !== "undefined"` — guarding against server environments that define a bare `window`.)

Second nuance, on measuring in the layout phase specifically: `useLayoutEffect` fires **after DOM commit but before the frame is painted** — for a DOM probe that's the right moment (nodes are already in place, the user hasn't seen anything yet, the host can react without a flicker; a setState during the layout phase flushes synchronously pre-paint). But if the reaction to the measurement is **not visual** (analytics, debugging), plain `useEffect` is enough — and cheaper for the main thread.

## Verified behavior matrix (all green, vitest + happy-dom + src/**tests**/renderer.tsx, against the real `createSlot` with zero library changes)

| Child returns                                  | Probe says    | Correct?                                                                              |
| ---------------------------------------------- | ------------- | ------------------------------------------------------------------------------------- |
| `null`                                         | not rendering | yes                                                                                   |
| `undefined`                                    | not rendering | yes (React 18+; on 16/17 React itself throws on undefined returns, probe-independent) |
| `<></>`                                        | not rendering | yes                                                                                   |
| `<><></><></></>`                              | not rendering | yes                                                                                   |
| `false`, `""`, `[]`                            | not rendering | yes                                                                                   |
| `<i/>`, `"text"`, `<><i/></>`                  | rendering     | yes                                                                                   |
| portal-only (`createPortal(...)`)              | not rendering | the single blind spot — correct for region semantics, wrong for "showing somewhere"   |
| portal + local content                         | rendering     | yes (local part lands in wrapper)                                                     |
| child toggles `null ↔ <b/>` from its own state | live updates  | yes — wrapper render count unchanged (MutationObserver did the work)                  |
| `api.clear()` / unmount                        | count → 0     | yes (cleanup in effect teardown)                                                      |

## Boundaries (honest)

- **Portal-only children** are invisible to the probe. If "showing somewhere" semantics is ever needed (analytics), that's an opt-in self-report override on top — explicitly out of scope for a first iteration unless decided otherwise.
- **"Has DOM" ≠ "visually visible"**: `display:none` content counts as rendering. Visual visibility would need `checkVisibility()`/IntersectionObserver on the same wrapper element — different question, different feature.
- **SSR**: observer + effects are client-only; count is 0 until after hydration (no hydration mismatch — same as `useStore.ts` 3rd-arg pattern — but a visual "jump" if the host gates a frame on it). A synchronously-SSR-correct alternative is a declarative `isVisible` predicate at insert; trades automation for cooperation.

## Costs / perf-invariant interplay

- +1 DOM element (`display:contents` span), +1 MutationObserver, +1 layout effect per child → must be **opt-in per slot**; non-opted slots keep the exact current code path (CLAUDE.md adapter rules: wrapper created once at insert, no render-time allocation, memo barriers untouched).
- Presence notify must be count-change-gated (not per-report) to avoid phantom host re-renders.
- StrictMode double-effects: protocol is idempotent because the Map is keyed by element and `report` is `Object.is`-gated.

## Open design questions (where the brainstorm stopped — resume here)

1. API shape: `createSlot({ presence: true })`? Phantom-typed variant? Separate `createProbedSlot`? How does the host read — `slot.usePresence()` hook on the returned object? (`src/index.ts` currently exports **only** `createSlot` — deliberate.)
2. What does the host read: `count: number`, `boolean`, or per-item map? (YAGNI suggests boolean or count.)
3. Naming: presence vs probe vs rendered; avoid colliding with the claim-document's `useSlotPresence` (self-report) terminology — ours is measurement, not self-report.
4. Include portal self-report override in v1? (Lean no — YAGNI; document the blind spot.)
5. `display:contents` caveat to document: historical a11y bugs in old browsers (runtime floor ES2023 / Safari 16.4+ / Chrome 110+ makes this mostly moot); CSS child selectors (`> *`, `:nth-child`) over slot children will see the spans.
6. Effect phase: `useIsomorphicLayoutEffect` (pre-paint, flicker-free for visual hosts — frames/headers) vs plain `useEffect` (cheaper, enough for non-visual reactions — analytics/debug). One hardcoded choice or configurable? See "Implementation notes: SSR warning & effect phase". Either way the isomorphic alias is mandatory — peer range includes React 16/17/18, which warn on `useLayoutEffect` during SSR.

## Appendix: the exact passing PoC test file

Recreate as `src/__tests__/__probe_poc.test.tsx`, run `pnpm exec vitest run src/__tests__/__probe_poc.test.tsx`, delete after.

Note: the PoC uses bare `useLayoutEffect` — fine in a client-only test, but production code must use the isomorphic alias (see "Implementation notes: SSR warning & effect phase").

```tsx
import React, { act, useLayoutEffect, useRef, useState, type FunctionComponent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useSyncExternalStore } from "use-sync-external-store/shim"
import { expect, it } from "vitest"
import { createSlot } from "../createSlot"
import { render } from "./renderer"

const createPresence = () => {
  const map = new Map<Element, boolean>()
  const listeners = new Set<() => void>()
  let count = 0

  const recompute = () => {
    let next = 0
    for (const rendered of map.values()) if (rendered) next++
    if (next === count) return
    count = next
    listeners.forEach((listener) => listener())
  }

  return {
    report(el: Element, rendered: boolean) {
      if (map.get(el) === rendered) return
      map.set(el, rendered)
      recompute()
    },
    remove(el: Element) {
      map.delete(el)
      recompute()
    },
    get: () => count,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}

type Presence = ReturnType<typeof createPresence>

let probeRenders = 0

const probe = (presence: Presence, Component: FunctionComponent): FunctionComponent => {
  return function Probed(props) {
    probeRenders++
    const ref = useRef<HTMLSpanElement>(null)

    useLayoutEffect(() => {
      const el = ref.current!
      const report = () => presence.report(el, el.childNodes.length > 0)
      report()

      const observer = new MutationObserver(report)
      observer.observe(el, { childList: true })

      return () => {
        observer.disconnect()
        presence.remove(el)
      }
    }, [])

    return (
      <span style={{ display: "contents" }} ref={ref}>
        <Component {...props} />
      </span>
    )
  }
}

const Host = ({ presence, children }: { presence: Presence; children: ReactNode }) => {
  const visible = useSyncExternalStore(presence.subscribe, presence.get, presence.get)
  return <section data-count={visible}>{children}</section>
}

const count = (container: HTMLElement) => container.querySelector("section")!.getAttribute("data-count")

const flush = () => act(async () => {})

it("null / <></> / false / '' / [] are counted as not rendering — zero cooperation from children", () => {
  const slot = createSlot()
  const presence = createPresence()

  slot.api.insert({ Component: probe(presence, () => null) })
  slot.api.insert({ Component: probe(presence, () => <></>) })
  slot.api.insert({ Component: probe(presence, () => false) })
  slot.api.insert({ Component: probe(presence, () => "") })
  slot.api.insert({ Component: probe(presence, () => []) })

  const { container } = render(
    <Host presence={presence}>
      <slot.Slot />
    </Host>,
  )

  expect(count(container)).toBe("0")

  act(() => slot.api.insert({ Component: probe(presence, () => <i>real</i>) }))
  expect(count(container)).toBe("1")

  act(() => slot.api.insert({ Component: probe(presence, () => "text") }))
  expect(count(container)).toBe("2")
})

it("portal-only child counts as not rendering in the slot region (known semantic boundary)", () => {
  const slot = createSlot()
  const presence = createPresence()
  const portalTarget = document.createElement("div")
  document.body.appendChild(portalTarget)

  slot.api.insert({ Component: probe(presence, () => createPortal(<b>banner</b>, portalTarget)) })

  const { container } = render(
    <Host presence={presence}>
      <slot.Slot />
    </Host>,
  )

  expect(portalTarget.textContent).toBe("banner")
  expect(count(container)).toBe("0")

  portalTarget.remove()
})

it("live-tracks a child toggling null ↔ content from its OWN state, wrapper never re-renders", async () => {
  const slot = createSlot()
  const presence = createPresence()

  let setOn: (on: boolean) => void
  const Dynamic = () => {
    const [on, set] = useState(false)
    setOn = set
    return on ? <b>now visible</b> : null
  }

  slot.api.insert({ Component: probe(presence, Dynamic) })

  const { container } = render(
    <Host presence={presence}>
      <slot.Slot />
    </Host>,
  )

  expect(count(container)).toBe("0")
  const rendersBefore = probeRenders

  await act(async () => setOn!(true))
  await flush()
  expect(count(container)).toBe("1")

  await act(async () => setOn!(false))
  await flush()
  expect(count(container)).toBe("0")

  expect(probeRenders).toBe(rendersBefore)
})

it("unmount cleans the count (clear → 0)", () => {
  const slot = createSlot()
  const presence = createPresence()

  slot.api.insert({ Component: probe(presence, () => <i>shown</i>) })

  const { container } = render(
    <Host presence={presence}>
      <slot.Slot />
    </Host>,
  )

  expect(count(container)).toBe("1")

  act(() => slot.api.clear())
  expect(count(container)).toBe("0")
})
```

Plus a second file verified `undefined`, nested empty fragments, fragment-with-content, and portal+local-content mixed (matrix above).
