# Releasing

1. Open [Prepare Release](https://github.com/grlt-hub/react-slots/actions/workflows/prepare-release.yml) → **Run workflow**.
2. Select `main` or `alpha`, then choose the release type (default: `patch`) or enter an exact version without `v`.
3. Run the workflow. It updates all package versions and opens a PR from `release/*` into the selected branch.
4. Review the versions, update package changelogs, wait for CI, and merge the PR.
5. Wait for [Publish](https://github.com/grlt-hub/react-slots/actions/workflows/publish.yml). Approve the GitHub `Release` environment if prompted. CI builds and tests both packages and stages them on npm with provenance.
6. After staging succeeds, the release bot automatically creates and pushes the git tag `v<version>` at the merge commit. The packages are still awaiting npm approval.
7. Open **Staged Packages** in the [npm](https://www.npmjs.com/) user menu. Check the versions and npm tags, then approve both packages with 2FA to publish them:

   - `@grlt-hub/react-slots`
   - `@grlt-hub/eslint-plugin-react-slots`

8. Verify the published versions and tags on both packages' npm pages.

The npm tag depends on the version, not the branch: `5.0.5` → `latest`, `5.1.0-alpha.0` → `alpha`, `5.1.0-beta.0` → `beta`.
