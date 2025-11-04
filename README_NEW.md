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
export const Sidebar = () => {
  return (
    <aside>
      <nav>Core navigation</nav>
      {/* 🤔 How do plugins inject widgets here? */}
    </aside>
  );
};

// plugin-analytics/index.ts - separate package
// This plugin wants to add analytics widget to sidebar
// How??? 🤷‍♂️
```

### Standard approaches are awkward

- Collecting everything in parent component - tight coupling, parent must know all plugins
- Context with manual management - lots of boilerplate per extension point
- Passing render functions through props - verbose, non-intuitive API

## The solution

**With `react-slots`, define extension points once and inject components from anywhere:**

```tsx
// Sidebar.tsx - define the slot
import { createSlots, createSlotIdentifier } from '@grlt-hub/react-slots';

export const { slotsApi, Slots } = createSlots({
  Widgets: createSlotIdentifier(),
} as const);

export const Sidebar = () => {
  return (
    <aside>
      <nav>Core navigation</nav>
      <Slots.Widgets /> {/* Extension point */}
    </aside>
  );
};

// plugin-analytics/index.ts - inject from anywhere!
import { slotsApi } from './Sidebar';

slotsApi.insert.into.Widgets({
  component: () => <AnalyticsWidget />,
});

// plugin-user-stats/index.ts - another plugin
import { slotsApi } from './Sidebar';

slotsApi.insert.into.Widgets({
  component: () => <UserStatsWidget />,
});
```

### Result

```tsx
<aside>
  <nav>Core navigation</nav>
  <AnalyticsWidget />
  <UserStatsWidget />
</aside>
```

No props drilling, no boilerplate - just define slots and inject content from anywhere in your codebase.

## Installation

```sh
npm i @grlt-hub/react-slots
# or
pnpm add @grlt-hub/react-slots
# or
bun add @grlt-hub/react-slots
```

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
slotsApi.insert.into.Footer({
  component: () => <p>© 2024 My Company</p>,
});

// Result:
// <div>
//   <h1>My App</h1>
//   <p>© 2024 My Company</p>
// </div>
```
