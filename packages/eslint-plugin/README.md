# @grlt-hub/eslint-plugin-react-slots

ESLint plugin that enforces [React-Slots](https://github.com/grlt-hub/react-slots) conventions in TypeScript code.

[![npm version](https://img.shields.io/npm/v/%40grlt-hub%2Feslint-plugin-react-slots?color=orange)](https://www.npmjs.com/package/@grlt-hub/eslint-plugin-react-slots)
![npm license](https://img.shields.io/npm/l/%40grlt-hub%2Feslint-plugin-react-slots?color=blue)
[![npm provenance](https://img.shields.io/badge/provenance-yes-brightgreen?logo=npm)](https://www.npmjs.com/package/@grlt-hub/eslint-plugin-react-slots)

[React-Slots](https://github.com/grlt-hub/react-slots)

## Installation

```bash
npm install --save-dev --save-exact @grlt-hub/eslint-plugin-react-slots
```

Requires ESLint 9+, TypeScript 5+, and [typed linting](https://typescript-eslint.io/getting-started/typed-linting/) (`parserOptions.projectService`) — the rule identifies `insert` by its type, so it works through any alias: a member call, a destructured `insert`, or a slot imported from another module.

## Usage

Add the recommended preset to your flat config:

```js
import reactSlots from "@grlt-hub/eslint-plugin-react-slots"
import tseslint from "typescript-eslint"

export default tseslint.config(reactSlots.configs.recommended)
```

Or wire the plugin manually:

```js
{
  plugins: { "react-slots": reactSlots },
  rules: {
    "react-slots/insert-options-order": "warn",
  },
}
```

## Rules

- ⚠️ — set to `warn` in the `recommended` config
- 🔧 — auto-fixable

| Name                                          | Description                        | ⚠️  | 🔧  |
| --------------------------------------------- | ---------------------------------- | --- | --- |
| [insert-options-order](#insert-options-order) | Enforce options order for `insert` | ⚠️  | 🔧  |

### insert-options-order

Options of `insert` must be ordered `filter -> mapProps -> Component -> order`. Missing options are fine — the rule only checks the relative order of the options that are present.

```js
// ✗ wrong
slots.Header.insert({
  Component: (props) => <UserBadge name={props.userName} />,
  mapProps: (slotProps) => ({ userName: getUserName(slotProps.userId) }),
})

// ✓ correct
slots.Header.insert({
  mapProps: (slotProps) => ({ userName: getUserName(slotProps.userId) }),
  Component: (props) => <UserBadge name={props.userName} />,
})
```

The order is load-bearing for types, not just style: with `mapProps` written above `filter`, TypeScript's type-predicate inference for `filter` does not fire — the call silently falls into the boolean overload and narrowing is lost without any error.

The rule is type-aware: it only fires on `insert` that comes from a slot created via `createSlot` — an `insert` from any other library is left alone.
