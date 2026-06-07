import React, { act } from "react"
import { hydrateRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createSlot } from "../createSlot"
import "./renderer"

const flush = () => act(async () => {})

let hydrated: { root: Root; container: HTMLDivElement }[] = []

afterEach(() => {
  for (const { root, container } of hydrated) {
    act(() => root.unmount())
    container.remove()
  }

  hydrated = []
})

describe("presence hydration", () => {
  it("hydrating a presence host stays silent: getServerSnapshot is identity-cached, no mismatch, settle still lands", async () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => <i>real</i>, order: 1 })
    slot.api.insert({ Component: () => null, order: 2 })

    const Host = () => {
      const count = slot.useCount()
      const presence = slot.usePresence()

      return (
        <>
          <b>{count}</b>
          <s>{presence.join(",")}</s>
          <slot.Root />
        </>
      )
    }

    const container = document.createElement("div")

    document.body.appendChild(container)
    container.innerHTML = renderToString(<Host />)

    expect(container.querySelector("b")!.textContent).toBe("0")
    expect(container.querySelector("s")!.textContent).toBe("false,false")

    const errors = vi.spyOn(console, "error")

    try {
      await act(async () => {
        hydrated.push({ root: hydrateRoot(container, <Host />), container })
      })
      await flush()

      expect(errors).not.toHaveBeenCalled()
    } finally {
      errors.mockRestore()
    }

    expect(container.querySelector("b")!.textContent).toBe("1")
    expect(container.querySelector("s")!.textContent).toBe("true,false")
  })
})
