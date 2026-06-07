# CLAUDE.md

This file provides context for AI assistants working on the ESLint plugin (`@grlt-hub/eslint-plugin-react-slots`). It extends the root `CLAUDE.md`.

## Rule conventions

- One directory per rule: `src/rules/<rule-name>/` holds `<rule-name>.ts` and `<rule-name>.test.ts` side by side (no `__tests__/` here).
- Rules are built with `createRule` from `@/shared/create` and match nodes via esquery selectors. Symbol and package names come from `UNITS` / `PACKAGE_NAME` in `@/shared/constants` — never hard-code them.
- `insert` is a method on the slot `api`, not a named import — the app-compose approach (tracking `ImportSpecifier` locals) cannot identify it, and the primary use case is cross-module (a plugin inserting into a slot imported from elsewhere), which no syntactic data-flow can follow. Identification is therefore **type-aware**: `services.getTypeAtLocation(callee).aliasSymbol` must be named `InsertWithProps` / `InsertWithoutProps` (the `payload.ts` aliases, preserved in the rolled-up d.ts) AND declared in a file whose path contains `/react-slots/`. This catches every alias by construction — member call, destructured `insert`, renamed destructuring, re-export — and rejects same-shape `insert`s from other libraries (pinned by the two "shape twin" valid cases; verified RED by removing the gate).
- The path check is `/react-slots/`, NOT `@grlt-hub/react-slots`: TS resolves pnpm workspace symlinks to realpaths (`packages/react-slots/dist/index.d.ts` in this repo's tests), so the scope is not reliably in the path. In consumer installs (npm flat, pnpm `.pnpm`) the path still contains `/react-slots/`.
- Check ordering in the handler is load-bearing for performance: all syntactic guards first (one object-literal argument, no spread/computed keys, key set ⊆ `{filter, mapProps, Component, order}` with `Component` required), then `isCorrectOrder` — and only for misordered shape-matching candidates the type gate. Clean files never touch the checker.
- The shape guard doubles as the false-positive firewall before the type gate and as fixer safety (unknown keys would sort wrong); both bail silently.
- The type gate means consumers MUST enable typed linting (`parserOptions.projectService`); without it `getParserServices` throws the standard typescript-eslint error. Same trade-off as app-compose's type-aware rules.
- Tests use `RuleTester` from `@typescript-eslint/rule-tester` with `projectService.allowDefaultProject` + `tsconfigRootDir: import.meta.dirname`; code samples resolve the real `@grlt-hub/react-slots` (workspace devDep), so its `dist/` must be built before tests run — CI builds first; a fresh clone running only `pnpm test` will fail in this package.
- Code samples are written with the `ts` template tag from `@/shared/tag`. Tag caveat: it dedents every line by the FIRST line's indent, so a multi-line string interpolated into a sample (the app-compose `${commonCode}` pattern) gets its inner lines mangled. Write each sample self-contained at one uniform indent.
- In `invalid` case outputs, the fixer emits properties at column 0 (`{\n<prop>,\n<prop>\n}`) — write expected output property lines at the template's base indent. Formatting the result is the consumer's formatter's job, same as app-compose.
- A new rule must be registered in both `src/index.ts` (`rules`) and `src/ruleset.ts` (`recommended`).
- Rule messages are user-facing docs copy: plain English; the same text appears in the package README — keep them in sync.
- Exception to "no default exports": rule modules and the plugin entry default-export, as the ESLint plugin contract expects.
- `@typescript-eslint/rule-tester` (exact-pinned devDep) must stay aligned with what `@typescript-eslint/utils` (caret dep) resolves to — a patch-level skew installs two copies of the types and `tsc --noEmit` fails on a `RuleModule` private-member mismatch.
