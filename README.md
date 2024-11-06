# React Slots

Bring the power of slots to your React components effortlessly.

## Table of Contents

- [Motivation](#motivation)
- [How does this library solve this problem?](#how-does-this-library-solve-this-problem)
- [Example](#example)
- [Installation](#installation)
- [How-to Guides](#how-to-guides)
  - [How to Pass Props to Components Inserted into a Slot](#how-to-pass-props-to-components-inserted-into-a-slot)
  - [How to Insert Multiple Components into a Slot](#how-to-insert-multiple-components-into-a-slot)
  - [How to Manage the Order of Components in a Slot](#how-to-manage-the-order-of-components-in-a-slot)
- [Community](#community)

## Motivation

In modern React applications, building reusable and **flexible** components is key to scaling efficiently. However, as the complexity of components increases, the need for a slot-based architecture becomes apparent. The concept of slots, familiar to developers from frameworks like Svelte and Vue, allows for seamless content injection and greater customization of component behavior. But in React, this pattern isn’t natively supported and often leads to verbose or suboptimal solutions.

## How does this library solve this problem?

`react-slots` introduces a streamlined way to implement slots, bringing familiar concepts into the React ecosystem with minimal effort. It provides developers with a clear and consistent API to define and use slots, enhancing flexibility while reducing boilerplate code. The library ensures components remain decoupled, making it easier to manage nested or complex content structures.

## Example

This example demonstrates how to create and use slots in React using the `@grlt-hub/react-slots` library.

### Code Breakdown

1. **Creating Slot Identifiers**

```ts
import { createSlots, createSlotIdentifier } from '@grlt-hub/react-slots';

const slots = {
  Bottom: createSlotIdentifier(),
} as const;
```

We import `createSlots` and `createSlotIdentifier` from the library. Then, we define a slots object, where each key represents a unique slot. In this case, we create a slot named Bottom.

2. **Creating the Slot API**

```ts
const { slotsApi: footerSlots, Slots: FooterSlots } = createSlots(slots);
```

`createSlots` takes the `slots` object and returns two values:

- `slotsApi` (renamed to `footerSlots`): an API for managing slot content.
- `Slots` (renamed to `FooterSlots`): a component used to render the slot content in the specified location.

3. **Defining the Footer Component**

```tsx
const Footer = () => (
  <footer>
    Hello
    <FooterSlots.Bottom />
  </footer>
);
```

Using `footerSlots.insert.into.Bottom`, we insert content into the `Bottom` slot. Here, we add a component that renders `<code>World</code>`.

### Result

After executing the code, the rendered output will be:

```html
<footer>
  Hello
  <code>World</code>
</footer>
```

This way, the `@grlt-hub/react-slots` library provides an efficient way to define and use slots in React components, making content injection simple and flexible.

## Installation

```sh
npm i @grlt-hub/react-slots
# or
yarn add @grlt-hub/react-slots
# or
pnpm add @grlt-hub/react-slots
```

## How-to Guides

### How to Pass Props to Components Inserted into a Slot

In this guide, we'll walk through how to define and pass props to components inserted into a slot using `@grlt-hub/react-slots`.

#### Step 1: Define a Slot with Props

You can specify the props a slot should accept by providing a type to `createSlotIdentifier`. For example, if you want a slot that requires a text prop, you can define it like this:

```ts
import { createSlotIdentifier } from '@grlt-hub/react-slots';

const slots = {
  Bottom: createSlotIdentifier<{ text: string }>(),
} as const;
```

This type definition ensures that any usage of `<FooterSlots.Bottom />` must include a `text` prop.

#### Step 2: Use the Slot in Your Component

When you use the slot component in your layout, you must pass the required props directly:

```tsx
const Footer = () => (
  <footer>
    Footer content
    <FooterSlots.Bottom text='Hello from the slot!' />
  </footer>
);
```

The `text` prop passed here will be provided to any component inserted into the `Bottom` slot.

#### Step 3: Insert a Component into the Slot

You use `footerSlots.insert.into.Bottom` to insert a component. The component will automatically receive the props passed to `<FooterSlots.Bottom />`:

```tsx
footerSlots.insert.into.Bottom({
  fn: ({ text }) => ({ doubleText: `${text} ${text}` }),
  component: ({ doubleText }) => <p>{doubleText}</p>,
});
```

- `fn`: This function is optional. If provided, it receives the props from `<FooterSlots.Bottom />` (e.g.,` { text }`) and allows you to transform them before passing them to `component`. In the example above, `fn` takes `text` and creates a new prop `doubleText`, which repeats the `text` value twice.
- **Without** `fn`: If `fn` is not provided, the props from `<FooterSlots.Bottom />` are passed directly to component without any transformation, one-to-one.
- `component`: This function receives either the transformed props (if `fn` is used) or the original props and renders the component accordingly.

This flexibility allows you to choose whether to modify props or pass them through unchanged, depending on your use case.

### How to Insert Multiple Components into a Slot

Inserting multiple components into a slot is straightforward. You can call `footerSlots.insert.into.Bottom` multiple times to add different components. The components will be added in the order in which they are inserted.

#### Example

Here's how you can insert multiple components into the `Bottom` slot:

```tsx
footerSlots.insert.into.Bottom({
  component: () => <p>First Component</p>,
});

footerSlots.insert.into.Bottom({
  component: () => <p>Second Component</p>,
});
```

In this example:

- The first call to `footerSlots.insert.into.Bottom` inserts a component that renders `<p>First Component</p>`.
- The second call inserts a component that renders `<p>Second Component</p>`.

The components will appear in the order they are inserted, so the rendered output will look like this:

```html
<footer>First Component Second Component</footer>
```

### How to Manage the Order of Components in a Slot

You can control the order in which components are rendered within a slot using the optional `order` property. By default, components are added in the order they are inserted. However, you can specify a custom order to rearrange them.

#### Example

Let's build on the previous example and introduce the order property:

```tsx
footerSlots.insert.into.Bottom({
  component: () => <p>First Component</p>,
});

footerSlots.insert.into.Bottom({
  component: () => <p>Second Component</p>,
  order: 0,
});
```

- In this case, the first call inserts `<p>First Component</p>` without an `order` property, so it gets the default position.
- The second call inserts `<p>Second Component</p>` and specifies `order: 0`. This causes the "Second Component" to be rendered before the "First Component".

With the order property applied, the rendered output will look like this:

```html
<footer>Second Component First Component</footer>
```

#### How the `order` Property Works

- **Type**: `order` is always a number.
- **Default Behavior**: If `order` is not provided, the components are rendered in the order they are inserted.
- **Custom Order**: Components with a lower `order` value are rendered before those with a higher value. If multiple components have the same `order` value, they maintain the order of insertion.

## Community

- [Discord](https://discord.gg/Q4DFKnxp)
- [Telegram](https://t.me/grlt_hub_app_compose)
