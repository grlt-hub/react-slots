import {
  SandpackCodeEditor,
  SandpackConsole,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from "@codesandbox/sandpack-react"
import { REACT_SLOTS_JS } from "virtual:react-slots-js"
// shared demo helpers, injected into every sandbox:
//   - the dashboard CSS becomes the default stylesheet (the react-ts template auto-imports
//     /styles.css), so examples are styled without an `import "./_style.css"` line
//   - the Widget component is injected so examples can `import { Widget } from "./_widget"`
import sharedStyle from "./shared/_style.css?raw"
import sharedWidget from "./shared/_widget.tsx?raw"
import { useTheme } from "./useTheme"

type Props = {
  /** Single-file example (the entry). Use this OR `files`. */
  code?: string
  /**
   * Multi-file example: a map of path → raw source, e.g. from
   * `import.meta.glob("./example/*.{tsx,ts,css}", { query: "?raw", import: "default", eager: true })`.
   * The file named `index.tsx` (or `App.tsx`) is the entry; everything else (css, extra components)
   * is added as its own editable tab and is importable by its relative path. A file whose name
   * starts with `_` is bundled but hidden (no tab).
   */
  files?: Record<string, string>
  options?: {
    /** Editor/preview height in px. Defaults to a value derived from the entry's line count. */
    editorHeight?: number
    editorWidthPercentage?: number
    showConsole?: boolean
    hideOutput?: boolean
  }
}

const ENTRY = "/App.tsx" // Sandpack react-ts entry; the template's own index.tsx imports it
const basename = (p: string) => p.slice(p.lastIndexOf("/") + 1)
const isEntryFile = (base: string) => base === "index.tsx" || base === "index.ts" || base === "App.tsx"

// Turn `code` / a `files` glob map into Sandpack files keyed by absolute path. A file whose name
// starts with `_` (e.g. `_style.css`) is bundled but hidden — no tab — so styling/boilerplate stays
// out of the reader's way. Import it by its real path: `import "./_style.css"`.
const buildUserFiles = (code: string | undefined, files: Record<string, string>) => {
  let entry = code ?? ""
  const extra: Record<string, { code: string; hidden?: boolean }> = {}
  const visible: string[] = []
  for (const [path, content] of Object.entries(files)) {
    const base = basename(path)
    if (isEntryFile(base)) {
      if (!code) entry = content // a `code` prop wins over a globbed index.tsx
      continue
    }
    const filePath = `/${base}`
    const hidden = base.startsWith("_")
    extra[filePath] = { code: content, hidden }
    if (!hidden) visible.push(filePath)
  }
  return { entry, extra, visible }
}

const SandpackEditor = ({ code, options, files = {} }: Props) => {
  const theme = useTheme()

  const { entry, extra, visible } = buildUserFiles(code, files)

  const lineCount = (entry.match(/\n/g)?.length ?? 0) + 1
  const editorHeight = options?.editorHeight ?? Math.max(lineCount * 20 + 56, 240)
  const editorWidthPercentage = options?.hideOutput ? 100 : (options?.editorWidthPercentage ?? 60)

  return (
    <div className="not-content sandbox">
      <SandpackProvider
        template="react-ts"
        theme={theme}
        files={{
          [ENTRY]: { code: entry },
          // shared Widget (hidden — no tab); an example can override by shipping its own copy
          "/_widget.tsx": { code: sharedWidget, hidden: true },
          ...extra,
          // the react-ts template's index.tsx imports ./styles.css — make it the shared dashboard
          // style so examples are styled by default, no `import "./_style.css"` needed
          "/styles.css": { code: sharedStyle, hidden: true },
          // inject the built library as a node_module so examples can import it for real
          "/node_modules/@grlt-hub/react-slots/index.cjs": { code: REACT_SLOTS_JS, hidden: true },
          "/node_modules/@grlt-hub/react-slots/package.json": {
            code: JSON.stringify({ name: "@grlt-hub/react-slots", main: "index.cjs" }),
            hidden: true,
          },
        }}
        options={{
          initMode: "user-visible",
          initModeObserverOptions: { rootMargin: "1400px 0px" },
          activeFile: ENTRY,
          visibleFiles: [ENTRY, ...visible],
          recompileMode: "delayed",
        }}
        customSetup={{
          dependencies: {
            // the bundle requires the shim path; React 18+ just forwards to its native hook
            "use-sync-external-store": "^1.2.0",
          },
        }}
      >
        <SandpackLayout style={{ height: editorHeight }}>
          <SandpackCodeEditor
            showTabs
            showLineNumbers
            showInlineErrors
            wrapContent
            style={{ height: editorHeight, flexGrow: editorWidthPercentage, flexBasis: 0, minWidth: 0 }}
          />
          {!options?.hideOutput && (
            <SandpackPreview
              showOpenInCodeSandbox={false}
              showRefreshButton
              style={{ height: editorHeight, flexGrow: 100 - editorWidthPercentage, flexBasis: 0, minWidth: 0 }}
            />
          )}
        </SandpackLayout>
        {options?.showConsole && <SandpackConsole showHeader showSyntaxError showResetConsoleButton={false} />}
      </SandpackProvider>
    </div>
  )
}

export default SandpackEditor
