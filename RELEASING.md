# Releasing

Both public packages share a version and are released from `v*` tags.

1. Run `pnpm release` from an up-to-date checkout. It updates versions, commits,
   creates the version tag, and pushes the release.
2. Open [GitHub Actions](https://github.com/grlt-hub/react-slots/actions) and approve
   the `Release` environment.
3. Wait for the workflow to build, lint, test, and stage both packages on npm.
   A successful workflow means staging finished, not that the versions are live.
4. Open **Staged Packages** on [npmjs.com](https://www.npmjs.com/). Review and approve
   `@grlt-hub/react-slots` and `@grlt-hub/eslint-plugin-react-slots` with 2FA.
   Alternatively, use `pnpm stage approve <stage-id>` locally for each stage ID
   printed in the workflow logs. Approval publishes the uploaded artifact and
   preserves its CI provenance without rebuilding it.

Stable releases use `latest`; prereleases use their first prerelease identifier
(for example, `5.1.0-beta.1` uses `beta`). Each package must be approved; staging
the workspace does not make approval or publication atomic across packages.

Each package's npm Trusted Publisher must reference `grlt-hub/react-slots`,
workflow `publish.yml`, and environment `Release`. Allow only `npm stage publish`,
disable direct `npm publish`, and require 2FA without bypass-2FA tokens.

For a local packaging check, build the packages first, then run
`PUBLISH_DRY_RUN=true pnpm publish-ci v<current-version>`.
The dry run does not upload packages and does not verify GitHub OIDC or provenance
generation. Already published versions may be skipped by recursive publishing.
