import type { Linter } from "eslint"

const recommended = {
  "react-slots/insert-options-order": "warn",
} satisfies Linter.RulesRecord

export const ruleset = { recommended }
