import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

// Expose the built library to the browser sandbox: the bundled CJS is injected as a node_module so
// examples can `import { createSlot } from "@grlt-hub/react-slots"` and run for real in Sandpack.
const distDir = fileURLToPath(new URL("../packages/react-slots/dist/", import.meta.url))

const buildJs = () => `export const REACT_SLOTS_JS = ${JSON.stringify(readFileSync(distDir + "index.cjs", "utf-8"))}`

const reactSlotsPlugin = () => {
  const modules = {
    "\0virtual:react-slots-js": { code: buildJs(), virtualId: "virtual:react-slots-js" },
  }

  const virtualToResolved = Object.fromEntries(
    Object.entries(modules).map(([resolved, { virtualId }]) => [virtualId, resolved]),
  )

  return {
    name: "react-slots-sandbox",
    resolveId(id) {
      return virtualToResolved[id]
    },
    load(id) {
      return modules[id]?.code
    },
  }
}

export { reactSlotsPlugin }
