import type { TSESLint } from "@typescript-eslint/utils"
import type { ESLint, Linter } from "eslint"
import { defineConfig } from "eslint/config"
import { describe, expectTypeOf, it } from "vitest"
import plugin from "./index"

describe("plugin public types", () => {
  it("type-checks for eslint defineConfig consumers", () => {
    expectTypeOf(plugin).toMatchTypeOf<ESLint.Plugin>()
    expectTypeOf(plugin.configs.recommended).toMatchTypeOf<Linter.Config>()

    void defineConfig(plugin.configs.recommended)
  })

  it("type-checks for typescript-eslint tseslint.config consumers", () => {
    // Plugins[string] is Omit<Plugin, "configs"> — exactly what tseslint.config accepts in a `plugins:` record
    expectTypeOf(plugin).toMatchTypeOf<TSESLint.FlatConfig.Plugins[string]>()
    expectTypeOf(plugin.configs.recommended).toMatchTypeOf<TSESLint.FlatConfig.Config>()
  })
})
