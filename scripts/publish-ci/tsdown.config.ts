import { defineConfig } from "tsdown"

export default defineConfig({
  entry: "src/index.ts",
  target: "node24",
  format: "esm",
  platform: "node",
  dts: false,
  deps: {
    alwaysBundle: ["semver"],
    onlyBundle: ["semver"],
  },
})
