import { execFileSync } from "node:child_process"
import { readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import semver from "semver"

let version = process.argv[2]

if (!version) throw new Error("No tag specified")

if (version.startsWith("v")) {
  version = version.slice(1)
}

if (!semver.valid(version)) throw new Error(`Cannot parse version: "${version}"`)

const pkgPath = join(import.meta.dirname, "../../..", "package.json")
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))

if (pkg.version !== version) {
  throw new Error(`Package version from tag "${version}" mismatches with the current version "${pkg.version}"`)
}

const tarball = process.argv[3]

if (!tarball) throw new Error("No package tarball specified")
if (!tarball.endsWith(".tgz")) throw new Error(`Expected a .tgz file: "${tarball}"`)

const tarballPath = resolve(tarball)

if (!statSync(tarballPath).isFile()) throw new Error(`Not a file: "${tarball}"`)

const archivePkg = JSON.parse(execFileSync("tar", ["-xOf", tarballPath, "package/package.json"], { encoding: "utf-8" }))

if (archivePkg.version !== version) {
  throw new Error(`Package version from tag "${version}" mismatches with the archive version "${archivePkg.version}"`)
}

const tag = semver.prerelease(version)?.[0] ?? "latest"

console.log("Staging archive", tarball, "with version", version, "and tag", tag)

execFileSync(
  "npm",
  ["stage", "publish", tarballPath, "--provenance", "--access", "public", "--ignore-scripts", "--tag", String(tag)],
  { stdio: "inherit" },
)
