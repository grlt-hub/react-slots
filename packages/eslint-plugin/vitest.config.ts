import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    setupFiles: ["src/setup.ts"],
    watch: false,
    typecheck: { enabled: true },
  },

  resolve: { alias: { "@": "./src" } },
})
