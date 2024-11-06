# React Slots

Bring the power of slots to your React components effortlessly.

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
