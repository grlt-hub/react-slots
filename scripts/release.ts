import { versionBump } from "bumpp"

try {
  const result = await versionBump({
    files: ["package.json", "packages/*/package.json"],
    commit: true,
    tag: true,
    push: true,
  })

  console.log(
    `Release ${result.newVersion} pushed. Approve the Release environment at https://github.com/grlt-hub/react-slots/actions, then review and approve both packages in Staged Packages on https://www.npmjs.com/ with 2FA.`,
  )
} catch (err) {
  console.error(err)
}
