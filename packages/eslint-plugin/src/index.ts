import type { TSESLint } from "@typescript-eslint/utils"
import { name, version } from "../package.json"
import insertOptionsOrder from "./rules/insert-options-order/insert-options-order"
import { ruleset } from "./ruleset"

const base = {
  meta: { name, version, namespace: "react-slots" },
  rules: {
    "insert-options-order": insertOptionsOrder,
  },
}

const configs = {
  recommended: { plugins: { "react-slots": base as TSESLint.FlatConfig.Plugin }, rules: ruleset.recommended },
}

const plugin = base as typeof base & { configs: typeof configs }

plugin.configs = configs

export default plugin
