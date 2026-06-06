import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/__tests__/**/*.test.ts?(x)"],
    typecheck: {
      enabled: true,
      ignoreSourceErrors: true,
      include: ["src/**/__tests__/**/*.test-d.ts?(x)"],
    },
    watch: false,
  },
})
