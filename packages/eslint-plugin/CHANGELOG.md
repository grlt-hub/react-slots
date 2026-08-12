# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](http://semver.org).

## Unreleased

### Fixed

- Public types now use ESLint's own types: the plugin object is `ESLint.Plugin` and `configs.recommended` satisfies `Linter.Config`, so the exports type-check under both eslint's `defineConfig` and typescript-eslint's `tseslint.config` (previously the `TSESLint`-flavored types made `defineConfig` consumers see a type error).

## v5.0.0

### Added

- Initial release with the `insert-options-order` rule: options of `insert` must be ordered `filter -> mapProps -> Component -> order` (auto-fixable).
