<p align="center">
  <img src="logo.webp" alt="React Slots" width="200" />
</p>

# React Slots

**Build extensible React components with slot-based architecture.** Define extension points where plugins and third-party code can inject content.

## What are slots?

**Slots** are named extension points in a component where content can be injected from outside.

Vue example:

```vue
<!-- Sidebar.vue -->
<aside>
  <nav>Core navigation</nav>
  <slot name="widgets"></slot>
</aside>

<!-- Usage -->
<Sidebar>
  <template #widgets>
    <AnalyticsWidget />
    <UserStatsWidget />
  </template>
</Sidebar>
```

## The problem in React

React doesn't have a built-in slot system. This creates challenges when building **extensible architectures** where different parts of your app (or plugins) need to inject content into predefined locations.

### Example: Admin dashboard with plugins

You're building an admin dashboard. Plugins should be able to add widgets to the sidebar without modifying the core `Sidebar` component:

```tsx
// Sidebar.tsx - core component (shouldn't change when plugins are added)
export const Sidebar = () => (
  <aside>
    <nav>Core navigation</nav>
    {/* 🤔 How do plugins inject widgets here? */}
  </aside>
);

// plugin-analytics/index.ts - separate package
// This plugin wants to add analytics widget to sidebar
// How??? 🤷‍♂️
```

### Standard approaches are awkward

- Collecting everything in parent component - tight coupling, parent must know all plugins
- Context with manual management - lots of boilerplate per extension point
- Passing render functions through props - verbose, non-intuitive API

## The solution

**With `@grlt-hub/react-slots`, define extension points once and inject components from anywhere:**

```tsx
// Sidebar.tsx - define the slot
import { createSlots, createSlotIdentifier } from '@grlt-hub/react-slots';

const { slotsApi, Slots } = createSlots({
  Widgets: createSlotIdentifier(),
} as const);

const Sidebar = () => (
  <aside>
    <nav>Core navigation</nav>
    <Slots.Widgets /> {/* Extension point */}
  </aside>
);

// plugin-analytics/index.ts - inject from anywhere!
slotsApi.Widgets.insert({
  Component: () => <AnalyticsWidget />,
});

// plugin-user-stats/index.ts - another plugin
slotsApi.Widgets.insert({
  Component: () => <UserStatsWidget />,
});

// Result:
// <aside>
//   <nav>Core navigation</nav>
//   <AnalyticsWidget />
//   <UserStatsWidget />
// </aside>
```

No props drilling, no boilerplate - just define slots and inject content from anywhere in your codebase.

## Installation

```sh
npm i @grlt-hub/react-slots
# or
pnpm add @grlt-hub/react-slots
# or
bun add @grlt-hub/react-slots
# or
yarn add @grlt-hub/react-slots
```

**Note:** TypeScript types are included out of the box.

### Peer dependencies

- `react` ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0
- `effector` 23
- `effector-react` 23
- `nanoid` \*

## Quick Start

Here's a minimal working example:

```tsx
import { createSlots, createSlotIdentifier } from '@grlt-hub/react-slots';

// 1. Create slots
const { slotsApi, Slots } = createSlots({
  Footer: createSlotIdentifier(),
} as const);

// 2. Use slot in your component
const App = () => (
  <div>
    <h1>My App</h1>
    <Slots.Footer />
  </div>
);

// 3. Insert content into the slot
slotsApi.Footer.insert({
  Component: () => <p>© 1955–1985–2015 Outatime Corp.</p>,
});

// Result:
// <div>
//   <h1>My App</h1>
//   <p>© 1955–1985–2015 Outatime Corp.</p>
// </div>
```

## How-to Guides

### Pass props to inserted components

```tsx
// Define slot with typed props
const { slotsApi, Slots } = createSlots({
  UserPanel: createSlotIdentifier<{ userId: number }>(),
} as const);

// Use in component
<Slots.UserPanel userId={123} />;

// Insert component - receives props automatically
slotsApi.UserPanel.insert({
  Component: (props) => <UserWidget id={props.userId} />,
});
```

### Transform props with `mapProps`

```tsx
const { slotsApi, Slots } = createSlots({
  UserPanel: createSlotIdentifier<{ userId: number }>(),
} as const);

<Slots.UserPanel userId={123} />;

slotsApi.UserPanel.insert({
  // Transform userId into userName and isAdmin before passing to component
  mapProps: (slotProps) => ({
    userName: getUserName(slotProps.userId),
    isAdmin: checkAdmin(slotProps.userId),
  }),
  Component: (props) => <UserBadge name={props.userName} admin={props.isAdmin} />,
});
```

### Control rendering order

Components are inserted in any order, but rendered according to `order` value (lower numbers first):

```tsx
// This is inserted first, but will render second
slotsApi.Sidebar.insert({
  Component: () => <SecondWidget />,
  order: 2,
});

// This is inserted second, but will render first
slotsApi.Sidebar.insert({
  Component: () => <FirstWidget />,
  order: 1,
});

// Result:
// <>
//   <FirstWidget />  ← order: 1
//   <SecondWidget /> ← order: 2
// </>
```

**Note:** Components with the same `order` value keep their insertion order and all of them are rendered.

### Clear slot content

Remove all components from a slot:

```tsx
// Insert components
slotsApi.Sidebar.insert({
  Component: () => <Widget1 />,
});

slotsApi.Sidebar.insert({
  Component: () => <Widget2 />,
});

// Result after inserts:
// <aside>
//   <Widget1 />
//   <Widget2 />
// </aside>

// Later, clear the slot
slotsApi.Sidebar.clear();

// Result after clear:
// <aside>
//   {/* Sidebar slot is now empty */}
// </aside>
```

### Defer insertion until event fires

Wait for data to load before inserting component. The component won't render until the event fires:

```tsx
import { createEvent } from 'effector';

const userLoaded = createEvent<{ id: number; name: string }>();

// Component will be inserted only after userLoaded fires
slotsApi.Header.insert({
  when: userLoaded,
  mapProps: (slotProps, whenPayload) => ({
    userId: whenPayload.id,
    userName: whenPayload.name,
  }),
  Component: (props) => <UserWidget id={props.userId} name={props.userName} />,
});

// Result before userLoaded fires:
// <header>
//   {/* Header slot is empty, waiting... */}
// </header>

// Later, when data arrives:
userLoaded({ id: 123, name: 'John' });

// Result after userLoaded fires:
// <header>
//   <UserWidget id={123} name="John" />
// </header>
```

**Note:** You can pass an array of events `when: [event1, event2]` - component inserts when **any** of them fires. Use [once](https://patronum.effector.dev/operators/once/) from `patronum` if you need one-time insertion.

## Community

- [Telegram](https://t.me/grlt_hub_app_compose)
