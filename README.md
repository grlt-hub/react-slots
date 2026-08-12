# @grlt-hub/react-slots

> Declarative slot system for React. Declare named extension points (slots) in your components and inject content into them from anywhere in the codebase — plugins, separate packages, lazy-loaded modules — without editing the component that declares the slot.

- Repository: https://github.com/grlt-hub/react-slots
- npm: https://www.npmjs.com/package/@grlt-hub/react-slots
- License: MIT
- Current major: v5. The v3 API (`createSlots`, `createSlotIdentifier`, `when`, effector peer dependencies) is gone; v5 has a single factory `createSlot` and no effector.

## Install

```sh
npm i @grlt-hub/react-slots@5
# or
pnpm add @grlt-hub/react-slots@5
# or
bun add @grlt-hub/react-slots@5
# or
yarn add @grlt-hub/react-slots@5
```

Until 5.0.0 reaches the `latest` tag, pre-releases are published under the `beta` tag: `npm i @grlt-hub/react-slots@beta`.

## Facts

- Runtime is ~2 KB gzipped. The only dependency is `use-sync-external-store` (shim), so React 16.14 – 19 are all supported: `peerDependencies: react >=16.14.0 <20.0.0`.
- TypeScript types ship with the package; minimum supported TypeScript for consumers is 6.0. The types rely on chained inference between object-literal members (`filter` narrows → `mapProps` receives the narrowed type and shapes → `Component` props, TS 4.7+), the built-in `NoInfer` intrinsic (TS 5.4+), and inferred type predicates for annotation-free `filter` narrowing (TS 5.5+).
- Published as ESM + CJS with correct `exports`; bundles carry a `"use client"` directive (safe to import from React Server Components projects — `Root` and hooks are client-side).
- SSR-safe: rendering `Root` on the server works; presence hooks return `0` / all-`false` on the server and correct themselves after hydration.
- Sole export: `createSlot`.

## Core concept

A slot is created at module level, outside React:

```tsx
import { createSlot } from "@grlt-hub/react-slots"

const widgets = createSlot()
```

`createSlot()` returns:

- `Root` — a React component. Place it where injected content should appear. It renders all inserted components, in order.
- `api.insert(options)` — inject a component into the slot. Callable from anywhere (plugin entry points, module top level, effects), before or after `Root` mounts. Every insert triggers a re-render of mounted `Root`s.
- `api.clear()` — remove all inserted components.

```tsx
// host component — knows nothing about what fills the slot
const Sidebar = () => (
  <aside>
    <nav>Core navigation</nav>
    <widgets.Root />
  </aside>
)

// plugin-analytics/index.ts — separate package, injects from outside
widgets.api.insert({ Component: () => <AnalyticsWidget /> })

// plugin-user-stats/index.ts — another plugin
widgets.api.insert({ Component: () => <UserStatsWidget /> })

// Result:
// <aside>
//   <nav>Core navigation</nav>
//   <AnalyticsWidget />
//   <UserStatsWidget />
// </aside>
```

Every inserted `Component` is automatically wrapped in `React.memo`. `Root` may be mounted in several places at once; each mount renders the same inserted list.

## insert options

Canonical option order is `filter → mapProps → Component → order` (enforced by the ESLint plugin; the order is load-bearing for TypeScript inference, see below).

| Option      | Required | Purpose                                                            |
| ----------- | -------- | ------------------------------------------------------------------ |
| `filter`    | no       | Gate re-renders based on slot props (freeze semantics, see below)  |
| `mapProps`  | no*      | Transform slot props into the inserted component's props           |
| `Component` | yes      | The component to render; auto-memoized                             |
| `order`     | no       | Render position: ascending, default `0`, ties keep insertion order |

\* `mapProps` is required whenever `filter` is used, and it is the only way slot props reach an inserted component.

## Typed slot props

Type the slot with a type argument; `Root` then requires those props:

```tsx
const widgets = createSlot<{ stars: number; issues: number }>()

<widgets.Root stars={1240} issues={24} />
```

Slot props reach an inserted component **only through `mapProps`**:

```tsx
// reshape
widgets.api.insert({
  mapProps: (props) => ({ value: props.issues }),
  Component: Issues, // receives { value: number }
})

// pass through as-is
widgets.api.insert({
  mapProps: (props) => props,
  Component: (props) => <Stars value={props.stars} />,
})

// ignore slot props entirely — mapProps omitted, Component gets no props
widgets.api.insert({ Component: () => <StaticBanner /> })
```

For an untyped slot (`createSlot()` with no type argument) the types forbid `filter` and `mapProps` — only `Component` and `order` are accepted.

The slot-props type `T` must be a plain object without `key`/`ref` fields (or `void`).

## Ordering

Components render sorted by `order`, ascending; missing `order` counts as `0`; equal values keep insertion order (stable):

```tsx
widgets.api.insert({ Component: PullRequests, order: 1 })
widgets.api.insert({ Component: Issues, order: 2 })
widgets.api.insert({ Component: Stars, order: 0 })
// renders: Stars, PullRequests, Issues
```

## Filtering (freeze semantics)

`filter` gates whether an inserted component _reacts to slot-prop changes_. When slot props change:

- `filter(props)` returns `true` → the component re-renders with `mapProps(props)`.
- `filter(props)` returns `false` → the component keeps its **last accepted render** (frozen output). It is not unmounted.

If `filter` rejects on the very first render, nothing renders until it first passes.

```tsx
const widgets = createSlot<{ stars: number }>()

widgets.api.insert({
  filter: (props) => props.stars % 2 === 0,
  mapProps: (props) => props,
  Component: (props) => <Stars value={props.stars} />,
})

// <widgets.Root stars={10} /> → renders 10
// stars becomes 11 → still shows 10 (frozen)
// stars becomes 12 → updates to 12
```

`filter` supports type-predicate narrowing — when written as a type guard, `mapProps` receives the narrowed type:

```tsx
slot.api.insert({
  filter: (props): props is { user: User } => props.user !== null,
  mapProps: (props) => ({ name: props.user.name }), // props.user is User here
  Component: (props) => <Badge name={props.name} />,
})
```

On discriminated-union slot props the explicit annotation is unnecessary — a plain lambda narrows via inferred type predicates when the check narrows the parameter itself:

```tsx
const slot = createSlot<{ kind: "a"; a: number } | { kind: "b" }>()

slot.api.insert({
  filter: (props) => props.kind === "a",
  mapProps: (props) => ({ n: props.a }), // props narrowed to { kind: "a"; a: number }
  Component: (props) => <N value={props.n} />,
})
```

This only works when the whole parameter is narrowed (discriminant check, `instanceof`, etc.). A check that narrows only a property — `(props) => props.user !== null` on a non-union type — never produces a predicate; write the explicit `props is ...` guard there.

Caveat: narrowing (explicit or inferred) only kicks in when `filter` is written **above** `mapProps` in the object literal. Reversed order silently falls into the boolean overload and narrowing is lost — the ESLint rule `insert-options-order` exists to catch this.

The freeze is concurrent-safe: render attempts React abandons (interrupted transitions, suspended attempts) cannot leak a never-committed element into the frozen output.

## Fallback

`createSlot({ Fallback })` renders a fallback while the slot has never received an insert:

```tsx
const widgets = createSlot<{ stars: number }>({
  Fallback: (props) => <Skeleton width={props.stars > 100 ? "lg" : "sm"} />,
})
```

Semantics:

- `Fallback` receives exactly the slot props of `createSlot<T>` (none when `T` is not given). `T` is never inferred from the `Fallback` signature — it comes only from the explicit type argument.
- The first `insert` removes the fallback **permanently**: a later `clear()` empties the slot but does not bring the fallback back (one-shot latch).
- Emptiness is list-based: the fallback tracks `insert`/`clear`, not what the inserted children actually render. A slot whose only child renders `null` shows nothing, not the fallback.
- On the server it renders whenever nothing was inserted at render time.
- Composes with `presence: true`; the fallback is not probed and never counts toward `useCount`/`usePresence`.
- The fallback component is auto-memoized.

## Presence: useCount / usePresence

`createSlot({ presence: true })` additionally returns two hooks:

```tsx
const widgets = createSlot({ presence: true })

const Heading = () => {
  const count = widgets.useCount() // number of inserted components currently rendering real DOM content
  return count > 0 ? <h2>Widgets</h2> : null
}

const Debug = () => {
  const flags = widgets.usePresence() // readonly boolean[], one per inserted component, in render order
  // ...
}
```

Semantics:

- "Present" means the inserted component currently renders at least one DOM node. A mounted component that returns `null` (or whose subtree collapses to nothing) counts as absent. This is what makes `useCount` reliable for "render a heading only when the slot renders DOM content".
- Implementation: each inserted component is wrapped in a `<span style="display: contents">` probe; a `MutationObserver` on the span's child list reports presence changes. `display: contents` removes the span from layout, so styling is unaffected.
- Updates are batched in a microtask; the returned array has stable identity when nothing changed.
- If `Root` is mounted in several places, a component is "present" when any mount renders its content.
- SSR/hydration: on the server `useCount` returns `0` and `usePresence` returns all-`false`; real values appear after hydration (probes are DOM-based). Hydration does not trigger React's "getServerSnapshot should be cached" error — server snapshots are identity-cached.
- Presence costs extra (probe span + observer per inserted item) — that is why it is opt-in.

Limitations:

- Tag-name-significant children. The probe wraps every inserted child in a `<span style="display: contents">`. A `span` is invalid inside content-model-strict parents: `<table>`/`<tbody>`/`<tr>` (children must be `tr`/`td`), `<select>` (`option`), `<picture>`/`<audio>`/`<video>` (`source`), and anything inside SVG (wrong namespace). Consequences: React `validateDOMNesting` warnings, broken table/select rendering, hydration mismatch risk. Do not enable `presence: true` on slots whose children must be such elements (`tr`, `td`, `option`, `source`, SVG elements). This is a deliberate design boundary.
- Portal-only children. A child that renders everything through `createPortal` leaves its probe span empty and counts as absent even though its content is on screen. Deliberate: presence has region semantics — "is there DOM in the slot's region", not "is it showing somewhere".
- Has-DOM, not visibility. A child whose DOM node exists but is invisible (`display: none`, zero-size, off-screen) still counts as present.
- `display: contents` requires ~2018+ browsers (Chrome 65+, Safari 11.1+).

Without `presence: true` these hooks do not exist on the slot object.

## clear()

`api.clear()` removes all inserted components (empty render). It does not restore `Fallback` (see above). Inserting after `clear` works normally.

## Full example

```tsx
import { createSlot } from "@grlt-hub/react-slots"

// slot.ts
export const widgets = createSlot<{ stars: number }>({
  presence: true,
  Fallback: () => <p>No widgets yet</p>,
})

// host.tsx
const Dashboard = () => {
  const count = widgets.useCount()
  return (
    <aside>
      {count > 0 && <h2>Widgets ({count})</h2>}
      <widgets.Root stars={1240} />
    </aside>
  )
}

// plugin.ts — anywhere, any time
widgets.api.insert({
  filter: (props) => props.stars > 0,
  mapProps: (props) => ({ value: props.stars }),
  Component: (props) => <Stars value={props.value} />,
  order: 1,
})
```

## Why imperative insert is fine

`insert` mutates an external store that `Root` subscribes to via `useSyncExternalStore` — the same pattern as Redux, Zustand, or any external-store integration React officially supports. The imperative call site is the point: plugins register themselves at module load, without the host rendering tree knowing about them.

## ESLint plugin: @grlt-hub/eslint-plugin-react-slots

- npm: https://www.npmjs.com/package/@grlt-hub/eslint-plugin-react-slots
- Requires ESLint 9+ (or 10), TypeScript 5+ (or 6), and typed linting (`parserOptions.projectService`).

```js
// eslint.config.js (flat config)
import reactSlots from "@grlt-hub/eslint-plugin-react-slots"
import tseslint from "typescript-eslint"

export default tseslint.config(reactSlots.configs.recommended)
```

Rules:

- `insert-options-order` (warn in `recommended`, auto-fixable) — enforces `filter → mapProps → Component → order` in `insert` calls. Type-aware: it identifies `insert` by its type, so it works through aliases, destructuring, and re-exports, and never fires on an `insert` from another library. The order matters because `filter`'s type-predicate narrowing only fires when `filter` is written above `mapProps`.

## Migration note (v3 → v5)

v3 concepts and their v5 equivalents:

- `createSlots({ X: createSlotIdentifier() })` → one `createSlot()` per slot; no registry object.
- `slotsApi.X.insert(...)` → `slot.api.insert(...)`; `<Slots.X />` → `<slot.Root />`.
- `when` (effector-based deferred insertion) → removed; call `insert` when your condition is met.
- effector / effector-react / nanoid peer dependencies → removed entirely.
