# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](http://semver.org).

## Unreleased

### Added

- `createSlot({ Fallback })` — a component rendered while the slot has never received an insert. It receives exactly the slot props of `createSlot<T>` (none when `T` is not specified; `T` is never inferred from the `Fallback` signature). The first `insert` removes it for good: a later `clear` empties the slot but does not bring the fallback back. Emptiness is list-based — the fallback tracks `insert`/`clear`, not what children render. On the server it renders whenever nothing was inserted at render time, mirroring the client pre-insert state. Composes with `presence: true`; the fallback is not probed and never counts toward `useCount`/`usePresence`.

### Fixed

- `filter` freeze is now concurrent-safe: a render attempt React abandons (an interrupted `startTransition`, a suspended attempt) can no longer leak a never-committed element into the frozen child. The freeze cache moved from a render-written ref to render-phase state.
- Hydrating a host that uses `usePresence` no longer triggers the React dev error "The result of getServerSnapshot should be cached" — the server snapshot is identity-cached.

### Changed

- **BREAKING:** React peer range floor raised from `>=16.8.0` to `>=16.14.0` (the range is now `>=16.14.0 <20.0.0`).
- **BREAKING:** minimum supported TypeScript for consumers raised from 4.7 to 6.0. The published types now use the built-in `NoInfer` intrinsic (TS 5.4+) instead of a hand-rolled alias, and annotation-free `filter` narrowing on discriminated-union slot props (inferred type predicates, TS 5.5+) is now inside the supported range. Note: inferred predicates only fire when the check narrows the whole parameter (e.g. a discriminant check); a property-only check such as `(props) => props.user !== null` still requires an explicit `props is ...` guard on any TypeScript version.
- The presence probe's `MutationObserver` now observes `childList` only (`subtree: true` was behaviorally inert: presence derives from the probe span's own child list).
- Published bundles carry a `"use client"` directive (React Server Components boundary — hooks and `Root` are client-side).
- The npm tarball now includes `LICENSE` and `CHANGELOG.md`.
- README rewritten for the current API, including presence limitations (the tarball previously shipped the v3 README).

## v3.1.0

### Added

- Now `when` supports any `Unit` from Effector. (#11)

### Changed

- `Component` return type from `React.JSX.Element` to `React.ReactNode`. (#10)

Big thanks to @TheCoffeeFox for spotting the type improvements!

## v3.0.1

### Fixed

- use `clean-publish`

## 3.0.0

### Changed

- **BREAKING:** `component` field renamed to `Component` (capital C) to enable React hooks usage in inline components without ESLint warnings

- **BREAKING:** API structure changed to target-first approach

  **Before (v2):**

  ```tsx
  slotsApi.insert.into.Description({ component: MyComponent })
  ```

  **After (v3):**

  ```tsx
  slotsApi.Description.insert({ Component: MyComponent })
  ```

  **Benefits:**
  - **Discoverability:** Type `slotsApi.` to see all available slots, then `slotsApi.[SlotName].` to see all actions for that slot
  - **Logical grouping:** All methods for a specific slot are in one place

### Added

- `clear` method to clear all components from a slot

### Migration from v2 to v3

1. Replace `slotsApi.insert.into.[SlotName]` with `slotsApi.[SlotName].insert`
2. Replace `component:` with `Component:` in all insert calls

**Example:**

```tsx
// v2
slotsApi.insert.into.Header({ component: MyComponent })

// v3
slotsApi.Header.insert({ Component: MyComponent })
```

## 2.0.0

### Changed

- renamed `fn` to `mapProps`

### Added

- `when` parameter to defer slot insertion until specified Effector events fire

```tsx
const userLoaded = createEvent<{ id: number }>()

slotsApi.insert.into.Header({
  when: userLoaded, // Wait for event
  mapProps: (slotProps, whenPayload) => ({ userId: whenPayload.id }),
  component: (props) => <UserWidget id={props.userId} />,
})

userLoaded({ id: 123 }) // Component inserted now
```

## 1.1.0

### Added

- react@19 in deps and peerDeps

## 1.0.1

### Fixed

- slots order

## 1.0.0

### Added

- `createSlotIdentifier` fn
- `createSlots` fn
