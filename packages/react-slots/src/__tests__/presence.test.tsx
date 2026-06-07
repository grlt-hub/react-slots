import React, { act, StrictMode, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { createSlot } from "../createSlot"
import { render } from "./renderer"

const flush = () => act(async () => {})

describe("presence", () => {
  it('useCount: null / <></> / false / "" / [] / nested-empty-fragment count as not rendering', async () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => null, order: 1 })
    slot.api.insert({ Component: () => <></>, order: 2 })
    slot.api.insert({ Component: () => false as unknown as ReactNode, order: 3 })
    slot.api.insert({ Component: () => "", order: 4 })
    slot.api.insert({ Component: () => [] as unknown as ReactNode, order: 5 })
    slot.api.insert({
      Component: () => (
        <>
          <></>
        </>
      ),
      order: 6,
    })

    let seen = -1
    const Host = () => {
      seen = slot.useCount()

      return null
    }

    render(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()

    expect(seen).toBe(0)
  })

  it('useCount: <i/>, "text", <><i/></> count as rendering', async () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => <i>x</i>, order: 1 })
    slot.api.insert({ Component: () => "text", order: 2 })
    slot.api.insert({
      Component: () => (
        <>
          <i>y</i>
        </>
      ),
      order: 3,
    })

    let seen = -1
    const Host = () => {
      seen = slot.useCount()

      return null
    }

    render(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()

    expect(seen).toBe(3)
  })

  it("useCount: undefined return counts as not rendering", async () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => undefined })

    let seen = -1
    const Host = () => {
      seen = slot.useCount()

      return null
    }

    render(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()

    expect(seen).toBe(0)
  })

  it("useCount: portal-only child counts as not rendering (region boundary)", async () => {
    const slot = createSlot({ presence: true })
    const target = document.createElement("div")
    document.body.appendChild(target)

    slot.api.insert({ Component: () => createPortal(<i>elsewhere</i>, target) })

    let seen = -1
    const Host = () => {
      seen = slot.useCount()

      return null
    }

    render(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()

    expect(seen).toBe(0)
    target.remove()
  })

  it("useCount: portal + local content counts as rendering", async () => {
    const slot = createSlot({ presence: true })
    const target = document.createElement("div")
    document.body.appendChild(target)

    slot.api.insert({
      Component: () => (
        <>
          <i>local</i>
          {createPortal(<i>elsewhere</i>, target)}
        </>
      ),
    })

    let seen = -1
    const Host = () => {
      seen = slot.useCount()

      return null
    }

    render(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()

    expect(seen).toBe(1)
    target.remove()
  })

  it("useCount: a child toggling null↔content from its own state live-updates; the probe wrapper never re-renders", async () => {
    const slot = createSlot({ presence: true })
    let setShow: (v: boolean) => void = () => {}

    slot.api.insert({
      Component: () => {
        const [show, set] = useState(false)
        setShow = set

        return show ? <i>on</i> : null
      },
    })

    let seen = -1
    const Host = () => {
      seen = slot.useCount()

      return null
    }

    render(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()
    expect(seen).toBe(0)

    act(() => setShow(true))
    await flush()
    expect(seen).toBe(1)

    act(() => setShow(false))
    await flush()
    expect(seen).toBe(0)
  })

  it("useCount: api.clear → 0", async () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => <i>x</i> })

    let seen = -1
    const Host = () => {
      seen = slot.useCount()

      return null
    }

    render(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()
    expect(seen).toBe(1)

    act(() => slot.api.clear())
    await flush()

    expect(seen).toBe(0)
  })

  it("usePresence: array follows slot order (sorted by order)", async () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => null, order: 1 })
    slot.api.insert({ Component: () => <i>x</i>, order: 2 })

    let seen: readonly boolean[] = []
    const Host = () => {
      seen = slot.usePresence()

      return null
    }

    render(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()

    expect(seen).toEqual([false, true])
  })

  it("usePresence: equal order keeps insertion order", async () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => <i>a</i> })
    slot.api.insert({ Component: () => null })
    slot.api.insert({ Component: () => <i>c</i> })

    let seen: readonly boolean[] = []
    const Host = () => {
      seen = slot.usePresence()

      return null
    }

    render(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()

    expect(seen).toEqual([true, false, true])
  })

  it("usePresence: mid-list insert shifts indices", async () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => <i>a</i>, order: 1 })

    let seen: readonly boolean[] = []
    const Host = () => {
      seen = slot.usePresence()

      return null
    }

    render(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()
    expect(seen).toEqual([true])

    act(() => {
      slot.api.insert({ Component: () => <i>b</i>, order: 2 })
      slot.api.insert({ Component: () => null, order: 3 })
    })
    await flush()

    expect(seen).toEqual([true, true, false])
  })

  it("usePresence: clear → [] (returns the shared empty reference)", async () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => <i>x</i> })

    let seen: readonly boolean[] = [true]
    const Host = () => {
      seen = slot.usePresence()

      return null
    }

    render(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()

    act(() => slot.api.clear())
    await flush()

    expect(seen).toEqual([])
  })

  it("useCount does NOT re-render the host on a same-count opposite swap [t,f]→[f,t]", async () => {
    const slot = createSlot({ presence: true })
    let setWhich: (v: "a" | "b") => void = () => {}

    const ChildA = () => {
      const [which, set] = useState<"a" | "b">("a")
      setWhich = set

      return which === "a" ? <i>a</i> : null
    }
    const ChildB = () => {
      const [which, set] = useState<"a" | "b">("a")
      const orig = setWhich
      setWhich = (v) => {
        orig(v)
        set(v)
      }

      return which === "b" ? <i>b</i> : null
    }

    slot.api.insert({ Component: ChildA, order: 1 })
    slot.api.insert({ Component: ChildB, order: 2 })

    let countRenders = 0
    let seenCount = -1
    const CountHost = React.memo(() => {
      countRenders += 1
      seenCount = slot.useCount()

      return null
    })

    render(
      <>
        <slot.Root />
        <CountHost />
      </>,
    )
    await flush()
    expect(seenCount).toBe(1)

    const before = countRenders

    act(() => setWhich("b"))
    await flush()

    expect(seenCount).toBe(1)
    expect(countRenders).toBe(before)
  })

  it("usePresence DOES re-render on [t,f]→[f,t]; the array equals [false, true]", async () => {
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

    let seen: readonly boolean[] = []
    const Host = () => {
      seen = slot.usePresence()

      return null
    }

    const { rerender } = render(
      <>
        <slot.Root which="a" />
        <Host />
      </>,
    )
    await flush()
    expect(seen).toEqual([true, false])

    rerender(
      <>
        <slot.Root which="b" />
        <Host />
      </>,
    )
    await flush()

    expect(seen).toEqual([false, true])
  })

  it("usePresence returns a stable reference across an unrelated same-value host re-render", async () => {
    const slot = createSlot<{ tick: number }>({ presence: true })

    slot.api.insert({ Component: () => <i>x</i> })

    const refs: (readonly boolean[])[] = []
    const Host = () => {
      refs.push(slot.usePresence())

      return null
    }

    const { rerender } = render(
      <>
        <slot.Root tick={1} />
        <Host />
      </>,
    )
    await flush()

    rerender(
      <>
        <slot.Root tick={1} />
        <Host />
      </>,
    )
    await flush()

    expect(refs[refs.length - 1]).toBe(refs[refs.length - 2])
  })

  it("usePresence returns a new reference after a real change, then stable again", async () => {
    const slot = createSlot({ presence: true })
    let setShow: (v: boolean) => void = () => {}

    slot.api.insert({
      Component: () => {
        const [show, set] = useState(false)
        setShow = set

        return show ? <i>on</i> : null
      },
    })

    const refs: (readonly boolean[])[] = []
    const Host = () => {
      refs.push(slot.usePresence())

      return null
    }

    render(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()

    const first = refs[refs.length - 1]

    act(() => setShow(true))
    await flush()

    const second = refs[refs.length - 1]

    expect(second).not.toBe(first)
    expect(second).toEqual([true])
  })

  it("multi-Root OR: a child rendering in at least one of two Roots counts once (no double-count)", async () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => <i>x</i> })

    let seen = -1
    const Host = () => {
      seen = slot.useCount()

      return null
    }

    render(
      <>
        <slot.Root />
        <slot.Root />
        <Host />
      </>,
    )
    await flush()

    expect(seen).toBe(1)
  })

  it("multi-Root OR: true in one Root, filter-bootstrap-false in another still counts once", async () => {
    const slot = createSlot<{ pass: boolean }>({ presence: true })

    slot.api.insert({
      filter: (p) => p.pass,
      mapProps: () => ({}),
      Component: () => <i>gated</i>,
    })

    let seen = -1
    const Host = () => {
      seen = slot.useCount()

      return null
    }

    render(
      <>
        <slot.Root pass={true} />
        <slot.Root pass={false} />
        <Host />
      </>,
    )
    await flush()

    expect(seen).toBe(1)
  })

  it("multi-Root: unmount one Root keeps OR true; unmount both drops to 0", async () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => <i>x</i> })

    let seen = -1
    const Host = () => {
      seen = slot.useCount()

      return null
    }

    const { rerender } = render(
      <>
        <slot.Root />
        <slot.Root />
        <Host />
      </>,
    )
    await flush()
    expect(seen).toBe(1)

    rerender(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()
    expect(seen).toBe(1)

    rerender(<Host />)
    await flush()

    expect(seen).toBe(0)
  })

  it("filter bootstrap: a rejected child counts false (span absent) while a sibling counts true", async () => {
    const slot = createSlot<{ pass: boolean }>({ presence: true })

    slot.api.insert({
      filter: (p) => p.pass,
      mapProps: () => ({}),
      Component: () => <i>gated</i>,
      order: 1,
    })
    slot.api.insert({ Component: () => <i>plain</i>, order: 2 })

    let seen: readonly boolean[] = []
    const Host = () => {
      seen = slot.usePresence()

      return null
    }

    render(
      <>
        <slot.Root pass={false} />
        <Host />
      </>,
    )
    await flush()

    expect(seen).toEqual([false, true])
  })

  it("filter pass mounts the child and flips it true without remounting siblings", async () => {
    const slot = createSlot<{ pass: boolean }>({ presence: true })

    slot.api.insert({
      filter: (p) => p.pass,
      mapProps: () => ({}),
      Component: () => <i>gated</i>,
      order: 1,
    })
    slot.api.insert({ Component: () => <i>plain</i>, order: 2 })

    let seen: readonly boolean[] = []
    const Host = () => {
      seen = slot.usePresence()

      return null
    }

    const { rerender } = render(
      <>
        <slot.Root pass={false} />
        <Host />
      </>,
    )
    await flush()
    expect(seen).toEqual([false, true])

    rerender(
      <>
        <slot.Root pass={true} />
        <Host />
      </>,
    )
    await flush()

    expect(seen).toEqual([true, true])
  })

  it("thaw (filter false→true) re-populates the span and re-reports true without remounting; the probe [] effect does not re-run", async () => {
    const slot = createSlot<{ pass: boolean }>({ presence: true })
    let effectRuns = 0

    slot.api.insert({
      filter: (p) => p.pass,
      mapProps: (p) => p,
      Component: () => {
        React.useEffect(() => {
          effectRuns += 1
        }, [])

        return <i>gated</i>
      },
    })

    let seen: readonly boolean[] = []
    const Host = () => {
      seen = slot.usePresence()

      return null
    }

    const { rerender } = render(
      <>
        <slot.Root pass={true} />
        <Host />
      </>,
    )
    await flush()
    expect(seen).toEqual([true])
    expect(effectRuns).toBe(1)

    rerender(
      <>
        <slot.Root pass={false} />
        <Host />
      </>,
    )
    await flush()
    expect(seen).toEqual([true])

    rerender(
      <>
        <slot.Root pass={true} />
        <Host />
      </>,
    )
    await flush()

    expect(seen).toEqual([true])
    expect(effectRuns).toBe(1)
  })

  it("frozen filtered child (filter true→false) keeps real DOM and stays true", async () => {
    const slot = createSlot<{ pass: boolean }>({ presence: true })

    slot.api.insert({
      filter: (p) => p.pass,
      mapProps: (p) => p,
      Component: () => <i>gated</i>,
    })

    let seen: readonly boolean[] = []
    const Host = () => {
      seen = slot.usePresence()

      return null
    }

    const { rerender } = render(
      <>
        <slot.Root pass={true} />
        <Host />
      </>,
    )
    await flush()
    expect(seen).toEqual([true])

    rerender(
      <>
        <slot.Root pass={false} />
        <Host />
      </>,
    )
    await flush()

    expect(seen).toEqual([true])
  })

  it("frozen filtered child mutating its own DIRECT child (null↔element) re-reports via the observer", async () => {
    const slot = createSlot({ presence: true })
    let setInner: (v: boolean) => void = () => {}

    slot.api.insert({
      Component: () => {
        const [inner, set] = useState(true)
        setInner = set

        return inner ? <i>on</i> : null
      },
    })

    let seen: readonly boolean[] = []
    const Host = () => {
      seen = slot.usePresence()

      return null
    }

    render(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()
    expect(seen).toEqual([true])

    act(() => setInner(false))
    await flush()
    expect(seen).toEqual([false])

    act(() => setInner(true))
    await flush()
    expect(seen).toEqual([true])
  })

  it("toggling content DEEP inside an always-present wrapper element keeps presence true and never phantom-re-renders the host", async () => {
    const slot = createSlot({ presence: true })
    let setDeep: (v: boolean) => void = () => {}

    slot.api.insert({
      Component: () => {
        const [deep, set] = useState(false)
        setDeep = set

        return <div>{deep ? <span>deep</span> : null}</div>
      },
    })

    let seen: readonly boolean[] = []
    let renders = 0
    const Host = () => {
      renders += 1
      seen = slot.usePresence()

      return null
    }

    render(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()
    expect(seen).toEqual([true])

    const before = renders

    act(() => setDeep(true))
    await flush()

    expect(seen).toEqual([true])
    expect(renders).toBe(before)
  })

  it("per-Root freeze independence under presence: two mounted Roots of the same filtered slot freeze independently", async () => {
    const slot = createSlot<{ pass: boolean }>({ presence: true })

    slot.api.insert({
      filter: (p) => p.pass,
      mapProps: (p) => p,
      Component: () => <i>gated</i>,
    })

    let seen: readonly boolean[] = []
    const Host = () => {
      seen = slot.usePresence()

      return null
    }

    const a = render(<slot.Root pass={true} />)
    const b = render(
      <>
        <slot.Root pass={false} />
        <Host />
      </>,
    )
    await flush()

    expect(a.container.querySelectorAll("i").length).toBe(1)
    expect(b.container.querySelectorAll("i").length).toBe(0)
    expect(seen).toEqual([true])
  })

  it("Root unmount cleans reports (count drops); remount re-derives with no stale reports", async () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => <i>x</i> })

    let seen = -1
    const Host = () => {
      seen = slot.useCount()

      return null
    }

    const { rerender } = render(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()
    expect(seen).toBe(1)

    rerender(<Host />)
    await flush()
    expect(seen).toBe(0)

    rerender(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()

    expect(seen).toBe(1)
  })

  it("re-insert after clear uses a fresh id; no stale presence", async () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => <i>x</i> })

    let seen: readonly boolean[] = []
    const Host = () => {
      seen = slot.usePresence()

      return null
    }

    render(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()
    expect(seen).toEqual([true])

    act(() => slot.api.clear())
    await flush()
    expect(seen).toEqual([])

    act(() => slot.api.insert({ Component: () => null }))
    await flush()

    expect(seen).toEqual([false])
  })

  it("StrictMode mount→remove→remount converges", async () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => <i>x</i> })

    let seen = -1
    const Host = () => {
      seen = slot.useCount()

      return null
    }

    render(
      <StrictMode>
        <slot.Root />
        <Host />
      </StrictMode>,
    )
    await flush()

    expect(seen).toBe(1)
  })

  it("presence slots stay isolated: inserting into one slot never wakes another slot's count/presence subscribers", async () => {
    const a = createSlot({ presence: true })
    const b = createSlot({ presence: true })

    a.api.insert({ Component: () => <i>a</i> })

    let bRenders = 0
    let seenB = -1
    const HostB = () => {
      bRenders += 1
      seenB = b.useCount()

      return null
    }

    render(
      <>
        <a.Root />
        <b.Root />
        <HostB />
      </>,
    )
    await flush()
    expect(seenB).toBe(0)

    const before = bRenders

    act(() => a.api.insert({ Component: () => <i>a2</i> }))
    await flush()

    expect(bRenders).toBe(before)
    expect(seenB).toBe(0)
  })

  it("independent subscribers: a CountHost and a PresenceHost each receive their own correct update on a DOM flip", async () => {
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
    const CountHost = () => {
      seenCount = slot.useCount()

      return null
    }
    const PresenceHost = () => {
      seenPresence = slot.usePresence()

      return null
    }

    render(
      <>
        <slot.Root />
        <CountHost />
        <PresenceHost />
      </>,
    )
    await flush()
    expect(seenCount).toBe(0)
    expect(seenPresence).toEqual([false])

    act(() => setShow(true))
    await flush()

    expect(seenCount).toBe(1)
    expect(seenPresence).toEqual([true])
  })

  it('text-node-only child (Component returns " ") counts as rendering', async () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => " " })

    let seen = -1
    const Host = () => {
      seen = slot.useCount()

      return null
    }

    render(
      <>
        <slot.Root />
        <Host />
      </>,
    )
    await flush()

    expect(seen).toBe(1)
  })

  it("SSR/hydration length-match: server snapshot is all-false over composition, count 0", () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => <i>a</i> })
    slot.api.insert({ Component: () => <i>b</i> })

    let serverPresence: readonly boolean[] = []
    let serverCount = -1
    const Host = () => {
      serverPresence = slot.usePresence()
      serverCount = slot.useCount()

      return null
    }

    renderToString(
      <>
        <slot.Root />
        <Host />
      </>,
    )

    expect(serverPresence).toEqual([false, false])
    expect(serverPresence.length).toBe(2)
    expect(serverCount).toBe(0)
  })
})

describe("presence zero-cost / parity guards", () => {
  it("no presence: a non-presence slot renders no wrapper span", () => {
    const slot = createSlot()

    slot.api.insert({ Component: () => <i>x</i> })

    const { container } = render(<slot.Root />)

    expect(container.querySelector("span")).toBeNull()
  })

  it("no presence: returned object has no useCount/usePresence", () => {
    const slot = createSlot()

    expect(slot).not.toHaveProperty("useCount")
    expect(slot).not.toHaveProperty("usePresence")
  })

  it("presence: a presence slot renders a wrapper span", () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({ Component: () => <i>x</i> })

    const { container } = render(<slot.Root />)

    expect(container.querySelector("span")).not.toBeNull()
  })
})
