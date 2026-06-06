import React, { act, useState, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { createSlot } from "../createSlot"

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const flush = () => act(async () => {})

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))

const microtask = () => Promise.resolve()

const withoutAct = async (body: () => Promise<void>) => {
  const previous = globalThis.IS_REACT_ACT_ENVIRONMENT

  globalThis.IS_REACT_ACT_ENVIRONMENT = false

  try {
    await body()
  } finally {
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous
  }
}

let mounted: { root: Root; container: HTMLElement }[] = []

const mountInBody = (element: ReactNode) => {
  const container = document.createElement("div")

  document.body.appendChild(container)

  const root = createRoot(container)

  act(() => root.render(element as React.ReactElement))
  mounted.push({ root, container })

  return container
}

const mountNoAct = (element: ReactNode) => {
  const container = document.createElement("div")

  document.body.appendChild(container)

  const root = createRoot(container)

  root.render(element as React.ReactElement)
  mounted.push({ root, container })

  return container
}

afterEach(() => {
  for (const { root, container } of mounted) {
    act(() => root.unmount())
    container.remove()
  }

  mounted = []
})

describe("presence browser pins: pre-paint settlement", () => {
  it("post-mount self-toggle null->content settles in the host DOM before the next paint (rAF sees the fresh count)", async () => {
    await withoutAct(async () => {
      const slot = createSlot({ presence: true })

      let setShow: (v: boolean) => void = () => {}
      const Child = () => {
        const [show, set] = useState(false)

        setShow = set

        return show ? <i>on</i> : null
      }

      slot.api.insert({ Component: Child })

      const Host = () => <section data-count={slot.useCount()} />

      const container = mountNoAct(
        <>
          <slot.Root />
          <Host />
        </>,
      )

      await nextFrame()
      await nextFrame()

      const section = container.querySelector("section")!

      expect(section.getAttribute("data-count")).toBe("0")

      setShow(true)
      await microtask()

      expect(section.getAttribute("data-count")).toBe("0")

      await nextFrame()

      expect(section.getAttribute("data-count")).toBe("1")
    })
  })

  it("reverse flip content->null settles before the next paint (rAF sees count back to 0)", async () => {
    await withoutAct(async () => {
      const slot = createSlot({ presence: true })

      let setShow: (v: boolean) => void = () => {}
      const Child = () => {
        const [show, set] = useState(true)

        setShow = set

        return show ? <i>on</i> : null
      }

      slot.api.insert({ Component: Child })

      const Host = () => <section data-count={slot.useCount()} />

      const container = mountNoAct(
        <>
          <slot.Root />
          <Host />
        </>,
      )

      await nextFrame()
      await nextFrame()

      const section = container.querySelector("section")!

      expect(section.getAttribute("data-count")).toBe("1")

      setShow(false)
      await nextFrame()

      expect(section.getAttribute("data-count")).toBe("0")
    })
  })

  it("observer liveness: after a content change the count is fully settled by the very next rAF boundary", async () => {
    await withoutAct(async () => {
      const slot = createSlot({ presence: true })

      let setN: (v: number) => void = () => {}
      const Child = () => {
        const [n, set] = useState(0)

        setN = set

        return n > 0 ? <i>{n}</i> : null
      }

      slot.api.insert({ Component: Child })

      const Host = () => <section data-count={slot.useCount()} />

      const container = mountNoAct(
        <>
          <slot.Root />
          <Host />
        </>,
      )

      await nextFrame()
      await nextFrame()

      const section = container.querySelector("section")!

      for (const target of [3, 0, 7, 0, 2]) {
        setN(target)
        await nextFrame()

        const expected = target > 0 ? 1 : 0

        expect(Number(section.getAttribute("data-count"))).toBe(expected)
      }
    })
  })
})

describe("presence browser pins: layout transparency of the probe span (display:contents)", () => {
  it("inside a 2-column grid: probed children land in distinct columns with the gap respected, and the span generates no box", async () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => <div style={{ width: 40, height: 20 }}>a</div>, order: 1 })
    slot.api.insert({ Component: () => <div style={{ width: 40, height: 20 }}>b</div>, order: 2 })

    const Host = () => (
      <div
        data-grid
        style={{
          display: "grid",
          gridTemplateColumns: "100px 100px",
          columnGap: "20px",
          width: "220px",
        }}
      >
        <slot.Root />
      </div>
    )

    const container = mountInBody(<Host />)
    await flush()

    const grid = container.querySelector("[data-grid]") as HTMLElement
    const childDivs = Array.from(grid.querySelectorAll("div"))

    expect(childDivs.length).toBe(2)

    const a = childDivs[0]!.getBoundingClientRect()
    const b = childDivs[1]!.getBoundingClientRect()

    expect(a.width).toBeGreaterThan(0)
    expect(a.height).toBeGreaterThan(0)
    expect(b.width).toBeGreaterThan(0)
    expect(b.height).toBeGreaterThan(0)

    expect(a.left).toBeLessThan(b.left)
    expect(b.left - a.left).toBeGreaterThanOrEqual(110)

    expect(Math.abs(a.top - b.top)).toBeLessThan(1)

    const spans = Array.from(grid.querySelectorAll("span"))

    expect(spans.length).toBe(2)

    for (const span of spans) {
      expect(getComputedStyle(span).display).toBe("contents")

      const r = span.getBoundingClientRect()

      expect(r.width).toBe(0)
      expect(r.height).toBe(0)
    }
  })

  it("inside a flex row: probed children flow side by side with gap, span is layout-transparent", async () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => <div style={{ width: 30, height: 15 }}>x</div>, order: 1 })
    slot.api.insert({ Component: () => <div style={{ width: 30, height: 15 }}>y</div>, order: 2 })

    const Host = () => (
      <div data-flex style={{ display: "flex", flexDirection: "row", gap: "16px", alignItems: "flex-start" }}>
        <slot.Root />
      </div>
    )

    const container = mountInBody(<Host />)
    await flush()

    const row = container.querySelector("[data-flex]") as HTMLElement
    const childDivs = Array.from(row.querySelectorAll("div"))

    expect(childDivs.length).toBe(2)

    const x = childDivs[0]!.getBoundingClientRect()
    const y = childDivs[1]!.getBoundingClientRect()

    expect(x.width).toBeGreaterThan(0)
    expect(y.width).toBeGreaterThan(0)

    expect(y.left).toBeGreaterThanOrEqual(x.right + 15)
    expect(Math.abs(x.top - y.top)).toBeLessThan(1)

    const spans = Array.from(row.querySelectorAll("span"))

    expect(spans.length).toBe(2)

    for (const span of spans) {
      expect(getComputedStyle(span).display).toBe("contents")

      const r = span.getBoundingClientRect()

      expect(r.width).toBe(0)
      expect(r.height).toBe(0)
    }
  })
})

describe("presence browser pins: fps harness", () => {
  it("a 1000-child mapped+filtered slot under a per-frame host tick keeps frame pacing regular for ~120 frames", async () => {
    await withoutAct(async () => {
      type ChildProps = { tick: number; kind: "pass" | "drop"; label: string }
      const slot = createSlot<ChildProps>({ presence: true })

      const Leaf = ({ label }: { label: string }) => <li>{label}</li>

      const COUNT = 1000

      for (let i = 0; i < COUNT; i++) {
        const label = `item-${i}`

        if (i % 2 === 0) {
          slot.api.insert<{ label: string }>({
            Component: Leaf,
            mapProps: () => ({ label }),
            order: i,
          })
        } else {
          slot.api.insert<{ label: string }>({
            Component: Leaf,
            filter: (p) => p.kind === "pass",
            mapProps: () => ({ label }),
            order: i,
          })
        }
      }

      let bump: () => void = () => {}
      const Host = () => {
        const [tick, setTick] = useState(0)

        bump = () => setTick((t) => t + 1)

        return (
          <ul>
            <slot.Root tick={tick} kind="pass" label="host" />
          </ul>
        )
      }

      const container = mountNoAct(<Host />)

      for (let i = 0; i < 60 && container.querySelectorAll("li").length < COUNT; i++) await nextFrame()

      expect(container.querySelectorAll("li").length).toBe(COUNT)

      const FRAMES = 120
      const deltas: number[] = []

      await new Promise<void>((resolve) => {
        let frames = 0
        let last = 0

        const loop = () => {
          const now = performance.now()

          deltas.push(now - last)
          last = now
          bump()
          frames++

          if (frames >= FRAMES) {
            resolve()

            return
          }

          requestAnimationFrame(loop)
        }

        requestAnimationFrame(() => {
          last = performance.now()
          requestAnimationFrame(loop)
        })
      })

      const sorted = [...deltas].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]!
      const p95 = sorted[Math.floor(sorted.length * 0.95)]!

      expect(deltas.length).toBe(FRAMES)
      expect(median).toBeGreaterThan(0)
      expect(p95).toBeLessThan(Math.max(2 * median, 20))
      expect(deltas.filter((d) => d > 33).length).toBe(0)
    })
  })
})
