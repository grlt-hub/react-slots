import type { TSESLint } from "@typescript-eslint/utils"

const recommended = {
  "react-slots/insert-options-order": "warn",
} satisfies TSESLint.Linter.RulesRecord

export const ruleset = { recommended }
