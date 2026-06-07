# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](http://semver.org).

## Unreleased

### Fixed

- `filter` freeze is now concurrent-safe: a render attempt React abandons (an interrupted `startTransition`, a suspended attempt) can no longer leak a never-committed element into the frozen child. The freeze cache moved from a render-written ref to render-phase state.
- Hydrating a host that uses `usePresence` no longer triggers the React dev error "The result of getServerSnapshot should be cached" — the server snapshot is identity-cached.

### Changed

- The presence probe's `MutationObserver` now observes `childList` only (`subtree: true` was behaviorally inert: presence derives from the probe span's own child list).
- Published bundles carry a `"use client"` directive (React Server Components boundary — hooks and `Root` are client-side).
- The npm tarball now includes `LICENSE` and `CHANGELOG.md`.

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
