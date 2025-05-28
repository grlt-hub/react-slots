import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    typecheck: {
      enabled: true,
      ignoreSourceErrors: true,
      include: ['src/**/__tests__/**/*.spec-d.ts?(x)'],
    },
    watch: false,
  },
});
