import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import semver from "semver"

let version = process.argv[2]

if (!version) throw new Error("No tag specified")

if (version.startsWith("v")) {
  version = version.slice(1)
}

if (!semver.valid(version)) throw new Error(`Cannot parse version: "${version}"`)

const pkgPath = join(import.meta.dirname, "..", "package.json")
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))

if (pkg.version !== version) {
  throw new Error(`Package version from tag "${version}" mismatches with the current version "${pkg.version}"`)
}

const tag = String(semver.prerelease(version)?.[0] ?? "latest")
const dryRun = process.env.PUBLISH_DRY_RUN === "true"

console.log(dryRun ? "Dry run: staging version" : "Staging version", version, "with tag", tag)

execFileSync(
  "pnpm",
  [
    "-r",
    "stage",
    "publish",
    "--provenance",
    "--ignore-scripts",
    "--access",
    "public",
    "--no-git-checks",
    "--tag",
    tag,
    ...(dryRun ? ["--dry-run"] : []),
  ],
  { stdio: "inherit" },
)

if (!dryRun) {
  console.log(
    "Staging finished. Review both packages in Staged Packages on https://www.npmjs.com/ and approve each with 2FA. They are not live until approved.",
  )
}
