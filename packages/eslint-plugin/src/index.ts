import type { ESLint, Linter } from "eslint"
import { name, version } from "../package.json"
import insertOptionsOrder from "./rules/insert-options-order/insert-options-order"
import { ruleset } from "./ruleset"

// TSESLint-built rules are runtime-compatible with eslint; the cast bridges the create-signature type gap once.
const base = {
  meta: { name, version, namespace: "react-slots" },
  rules: {
    "insert-options-order": insertOptionsOrder,
  },
} as unknown as ESLint.Plugin

const configs: { recommended: Linter.Config } = {
  recommended: { plugins: { "react-slots": base }, rules: ruleset.recommended },
}

const plugin = base as ESLint.Plugin & { configs: typeof configs }

plugin.configs = configs

export default plugin
