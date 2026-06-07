import { playwright } from "@vitest/browser-playwright"
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          globals: true,
          environment: "happy-dom",
          include: ["src/**/__tests__/**/*.test.ts?(x)"],
          exclude: [...configDefaults.exclude, "src/**/__tests__/**/*.browser.test.ts?(x)"],
          typecheck: {
            enabled: true,
            ignoreSourceErrors: true,
            include: ["src/**/__tests__/**/*.test-d.ts?(x)"],
          },
          watch: false,
        },
      },
      {
        test: {
          name: "browser",
          include: ["src/**/__tests__/**/*.test.ts?(x)"],
          exclude: [...configDefaults.exclude, "src/**/__tests__/**/*.bench.browser.test.ts?(x)"],
          watch: false,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }, { browser: "webkit" }],
          },
        },
      },
      {
        test: {
          name: "bench-chromium",
          include: ["src/**/__tests__/**/*.bench.browser.test.ts?(x)"],
          watch: false,
          testTimeout: 120_000,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
      {
        test: {
          name: "bench-webkit",
          include: ["src/**/__tests__/**/*.bench.browser.test.ts?(x)"],
          watch: false,
          testTimeout: 120_000,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "webkit" }],
          },
        },
      },
    ],
  },
})
