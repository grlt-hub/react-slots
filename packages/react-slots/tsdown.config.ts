import { defineConfig } from "tsdown"

export default defineConfig({
  target: "es2023",
  format: ["esm", "cjs"],
  platform: "neutral",
  minify: "dce-only",
  hash: false,
  dts: { tsgo: true },
  banner: { js: '"use client"' },
})
