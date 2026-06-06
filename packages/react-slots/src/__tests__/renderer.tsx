import { act, type ReactElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach } from "vitest"

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let mounted: { root: Root; container: HTMLDivElement }[] = []

const render = (element: ReactElement) => {
  const container = document.createElement("div")
  document.body.appendChild(container)

  const root = createRoot(container)

  act(() => root.render(element))
  mounted.push({ root, container })

  const rerender = (next: ReactElement) => act(() => root.render(next))

  return { container, rerender }
}

const texts = (container: HTMLElement, selector: string) =>
  Array.from(container.querySelectorAll(selector)).map((x) => x.textContent)

afterEach(() => {
  for (const { root, container } of mounted) {
    act(() => root.unmount())
    container.remove()
  }

  mounted = []
})

export { render, texts }
