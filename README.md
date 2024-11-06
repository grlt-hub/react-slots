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
