# Change Log

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](http://semver.org).

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
