import React, { act, StrictMode, startTransition, useState } from "react"
import { describe, expect, it } from "vitest"
import { createSlot } from "../createSlot"
import { render } from "./renderer"

const flush = () => act(async () => {})

describe("presence hardening: lifecycle / leak-observable correctness", () => {
  it("500+ Root mount/unmount cycles over rendering+null children stay exact; a fresh mount after the final unmount still reports right", async () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => <i>render</i>, order: 1 })
    slot.api.insert({ Component: () => null, order: 2 })
    slot.api.insert({ Component: () => <b>render2</b>, order: 3 })

    let seenCount = -1
    let seenPresence: readonly boolean[] = []
    const Host = () => {
      seenCount = slot.useCount()
      seenPresence = slot.usePresence()

      return null
    }

    const mounted = (
      <>
        <slot.Root />
        <Host />
      </>
    )
    const unmounted = <Host />

    const { rerender } = render(unmounted)
    await flush()

    const cycles = 520

    for (let i = 0; i < cycles; i++) {
      rerender(mounted)
      await flush()

      expect(seenCount).toBe(2)
      expect(seenPresence).toEqual([true, false, true])

      rerender(unmounted)
      await flush()

      expect(seenCount).toBe(0)
      expect(seenPresence).toEqual([false, false, false])
    }

    const fresh = render(mounted)
    await flush()

    expect(seenCount).toBe(2)
    expect(seenPresence).toEqual([true, false, true])
    expect(fresh.container.querySelectorAll("i, b").length).toBe(2)
  })

  it("500+ insert/clear cycles on a mounted Root: count back to 0 after clear, exact after refill, array length tracks composition, host re-renders per cycle stay CONSTANT", async () => {
    const slot = createSlot({ presence: true })

    let hostRenders = 0
    let seenCount = -1
    let seenPresence: readonly boolean[] = []
    const Host = () => {
      hostRenders += 1
      seenCount = slot.useCount()
      seenPresence = slot.usePresence()

      return null
    }

    render(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()

    expect(seenCount).toBe(0)
    expect(seenPresence).toEqual([])

    const cycles = 520
    const perCycleRenderCounts: number[] = []

    for (let i = 0; i < cycles; i++) {
      const before = hostRenders

      await act(async () => {
        slot.api.insert({ Component: () => <i>a</i>, order: 1 })
        slot.api.insert({ Component: () => null, order: 2 })
        slot.api.insert({ Component: () => <b>c</b>, order: 3 })
      })

      expect(seenCount).toBe(2)
      expect(seenPresence).toEqual([true, false, true])
      expect(seenPresence.length).toBe(3)

      await act(async () => slot.api.clear())

      expect(seenCount).toBe(0)
      expect(seenPresence).toEqual([])
      expect(seenPresence.length).toBe(0)

      perCycleRenderCounts.push(hostRenders - before)
    }

    const first = perCycleRenderCounts[0]
    for (const c of perCycleRenderCounts) expect(c).toBe(first)
  })

  it("two Roots mounted, one repeatedly mounted/unmounted while the other persists: persistent Root readings stay exact (instance-map pruning)", async () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => <i>x</i>, order: 1 })
    slot.api.insert({ Component: () => null, order: 2 })

    let seenCount = -1
    let seenPresence: readonly boolean[] = []
    const Host = () => {
      seenCount = slot.useCount()
      seenPresence = slot.usePresence()

      return null
    }

    const persistent = render(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()
    expect(persistent.container.querySelectorAll("i").length).toBe(1)
    expect(seenCount).toBe(1)
    expect(seenPresence).toEqual([true, false])

    const transient = render(<></>)
    await flush()

    const cycles = 220

    for (let i = 0; i < cycles; i++) {
      transient.rerender(<slot.Root />)
      await flush()

      expect(transient.container.querySelectorAll("i").length).toBe(1)
      expect(persistent.container.querySelectorAll("i").length).toBe(1)
      expect(seenCount).toBe(1)
      expect(seenPresence).toEqual([true, false])

      transient.rerender(<></>)
      await flush()

      expect(transient.container.querySelectorAll("i").length).toBe(0)
      expect(persistent.container.querySelectorAll("i").length).toBe(1)
      expect(seenCount).toBe(1)
      expect(seenPresence).toEqual([true, false])
    }
  })
})

describe("presence hardening: StrictMode", () => {
  it("double-effect mount converges for static + mapped + filtered children", async () => {
    const slot = createSlot<{ pass: boolean }>({ presence: true })

    slot.api.insert({ Component: () => <i>static</i>, order: 1 })
    slot.api.insert({ mapProps: (p) => p, Component: () => <b>mapped</b>, order: 2 })
    slot.api.insert({
      filter: (p) => p.pass,
      mapProps: (p) => p,
      Component: () => <u>filtered</u>,
      order: 3,
    })
    slot.api.insert({ Component: () => null, order: 4 })

    let seenCount = -1
    let seenPresence: readonly boolean[] = []
    const Host = () => {
      seenCount = slot.useCount()
      seenPresence = slot.usePresence()

      return null
    }

    render(
      <StrictMode>
        <slot.Root pass={true} />
        <Host />
      </StrictMode>,
    )
    await flush()

    expect(seenCount).toBe(3)
    expect(seenPresence).toEqual([true, true, true, false])
  })

  it("StrictMode + self-toggle (child flips null<->content from own state): count tracks, no double-counting", async () => {
    const slot = createSlot({ presence: true })
    let setShow: (v: boolean) => void = () => {}

    slot.api.insert({
      Component: () => {
        const [show, set] = useState(false)
        setShow = set

        return show ? <i>on</i> : null
      },
    })

    let seenCount = -1
    let seenPresence: readonly boolean[] = []
    const Host = () => {
      seenCount = slot.useCount()
      seenPresence = slot.usePresence()

      return null
    }

    const { container } = render(
      <StrictMode>
        <slot.Root />
        <Host />
      </StrictMode>,
    )
    await flush()
    expect(seenCount).toBe(0)
    expect(seenPresence).toEqual([false])
    expect(container.querySelectorAll("i").length).toBe(0)

    act(() => setShow(true))
    await flush()
    expect(seenCount).toBe(1)
    expect(seenPresence).toEqual([true])
    expect(container.querySelectorAll("i").length).toBe(1)

    act(() => setShow(false))
    await flush()
    expect(seenCount).toBe(0)
    expect(seenPresence).toEqual([false])
    expect(container.querySelectorAll("i").length).toBe(0)
  })

  it("StrictMode + insert/clear cycles: no stale entries", async () => {
    const slot = createSlot({ presence: true })

    let seenCount = -1
    let seenPresence: readonly boolean[] = []
    const Host = () => {
      seenCount = slot.useCount()
      seenPresence = slot.usePresence()

      return null
    }

    render(
      <StrictMode>
        <slot.Root />
        <Host />
      </StrictMode>,
    )
    await flush()
    expect(seenCount).toBe(0)
    expect(seenPresence).toEqual([])

    for (let i = 0; i < 40; i++) {
      await act(async () => {
        slot.api.insert({ Component: () => <i>a</i>, order: 1 })
        slot.api.insert({ Component: () => null, order: 2 })
      })

      expect(seenCount).toBe(1)
      expect(seenPresence).toEqual([true, false])

      await act(async () => slot.api.clear())

      expect(seenCount).toBe(0)
      expect(seenPresence).toEqual([])
    }
  })
})

describe("presence hardening: transitions / tearing", () => {
  it("startTransition over a Root-props change: every recorded (count, array) pair is internally consistent", async () => {
    const slot = createSlot<{ which: "a" | "b" }>({ presence: true })

    slot.api.insert({
      mapProps: (p) => p,
      Component: (p) => (p.which === "a" ? <i>a</i> : null),
      order: 1,
    })
    slot.api.insert({
      mapProps: (p) => p,
      Component: (p) => (p.which === "b" ? <i>b</i> : null),
      order: 2,
    })
    slot.api.insert({ Component: () => <i>always</i>, order: 3 })

    const pairs: { count: number; array: readonly boolean[] }[] = []
    let setWhich: (v: "a" | "b") => void = () => {}

    const Reader = () => {
      const count = slot.useCount()
      const array = slot.usePresence()
      pairs.push({ count, array })

      return null
    }
    const Host = () => {
      const [which, set] = useState<"a" | "b">("a")
      setWhich = set

      return (
        <>
          <slot.Root which={which} />
          <Reader />
        </>
      )
    }

    render(<Host />)
    await flush()

    for (let i = 0; i < 30; i++) {
      const next = i % 2 === 0 ? "b" : "a"

      await act(async () => {
        startTransition(() => setWhich(next))
      })
    }

    expect(pairs.length).toBeGreaterThan(0)
    for (const { count, array } of pairs) {
      expect(count).toBe(array.filter(Boolean).length)
    }

    const last = pairs[pairs.length - 1]!
    expect(last.array).toEqual([true, false, true])
    expect(last.count).toBe(2)
  })

  it("startTransition + insert during transition: final state exact and pairs consistent", async () => {
    const slot = createSlot<{ which: "a" | "b" }>({ presence: true })

    slot.api.insert({
      mapProps: (p) => p,
      Component: (p) => (p.which === "a" ? <i>a</i> : null),
      order: 1,
    })

    const pairs: { count: number; array: readonly boolean[] }[] = []
    let setWhich: (v: "a" | "b") => void = () => {}

    const Reader = () => {
      const count = slot.useCount()
      const array = slot.usePresence()
      pairs.push({ count, array })

      return null
    }
    const Host = () => {
      const [which, set] = useState<"a" | "b">("a")
      setWhich = set

      return (
        <>
          <slot.Root which={which} />
          <Reader />
        </>
      )
    }

    render(<Host />)
    await flush()
    expect(pairs[pairs.length - 1]!.array).toEqual([true])

    await act(async () => {
      startTransition(() => {
        setWhich("b")
        slot.api.insert({ Component: () => <i>added</i>, order: 2 })
      })
    })

    for (const { count, array } of pairs) {
      expect(count).toBe(array.filter(Boolean).length)
    }

    const last = pairs[pairs.length - 1]!
    expect(last.array).toEqual([false, true])
    expect(last.count).toBe(1)
  })

  it("startTransition wrapping a self-toggling child flip: count and array never disagree across recorded pairs", async () => {
    const slot = createSlot({ presence: true })
    let setShow: (v: boolean) => void = () => {}

    slot.api.insert({
      Component: () => {
        const [show, set] = useState(false)
        setShow = set

        return show ? <i>on</i> : null
      },
      order: 1,
    })
    slot.api.insert({ Component: () => <i>always</i>, order: 2 })

    const pairs: { count: number; array: readonly boolean[] }[] = []
    const Reader = () => {
      const count = slot.useCount()
      const array = slot.usePresence()
      pairs.push({ count, array })

      return null
    }

    render(
      <>
        <slot.Root />
        <Reader />
      </>,
    )
    await flush()

    for (let i = 0; i < 20; i++) {
      const next = i % 2 === 0

      await act(async () => {
        startTransition(() => setShow(next))
      })
    }

    expect(pairs.length).toBeGreaterThan(0)
    for (const { count, array } of pairs) {
      expect(count).toBe(array.filter(Boolean).length)
    }
  })
})
