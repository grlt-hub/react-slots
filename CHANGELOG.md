# Change Log

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](http://semver.org).

## 3.0.0

### Changed

- **BREAKING:** API structure changed to target-first approach for better DX

**Before (v2):**

```tsx
slotsApi.insert.into.Description({ component: MyComponent });
```

**After (v3):**

```tsx
slotsApi.Description.insert({ component: MyComponent });
```

**Benefits:**

- **Discoverability:** Type `slotsApi.` to see all available slots, then `slotsApi.[SlotName].` to see all actions for that slot
- **Logical grouping:** All methods for a specific slot are in one place

### Added

- `clear` method to clear all components from a slot

## 2.0.0

### Changed

- renamed `fn` to `mapProps`

### Added

- `when` parameter to defer slot insertion until specified Effector events fire

```tsx
const userLoaded = createEvent<{ id: number }>();

slotsApi.insert.into.Header({
  when: userLoaded, // Wait for event
  mapProps: (slotProps, whenPayload) => ({ userId: whenPayload.id }),
  component: (props) => <UserWidget id={props.userId} />,
});

userLoaded({ id: 123 }); // Component inserted now
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
