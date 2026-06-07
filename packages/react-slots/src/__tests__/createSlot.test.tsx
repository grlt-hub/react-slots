import React, { act, startTransition, Suspense, useEffect, useState } from "react"
import { flushSync } from "react-dom"
import { describe, expect, it } from "vitest"
import { createSlot } from "../createSlot"
import { render, texts } from "./renderer"

describe("createSlot", () => {
  it("renders nothing while the slot is empty", () => {
    const slot = createSlot()

    const { container } = render(<slot.Root />)

    expect(container.innerHTML).toBe("")
  })

  it("renders a component inserted before mount", () => {
    const slot = createSlot()

    slot.api.insert({ Component: () => <i>early</i> })

    const { container } = render(<slot.Root />)

    expect(texts(container, "i")).toEqual(["early"])
  })

  it("renders a component inserted after mount", () => {
    const slot = createSlot()

    const { container } = render(<slot.Root />)

    act(() => {
      slot.api.insert({ Component: () => <i>late</i> })
    })

    expect(texts(container, "i")).toEqual(["late"])
  })

  it("renders children sorted by order", () => {
    const slot = createSlot()

    slot.api.insert({ Component: () => <i>second</i>, order: 2 })
    slot.api.insert({ Component: () => <i>first</i>, order: 1 })

    const { container } = render(<slot.Root />)

    expect(texts(container, "i")).toEqual(["first", "second"])
  })

  it("does not pass Root props to Component without mapProps", () => {
    const slot = createSlot<{ userId: number }>()

    slot.api.insert({ Component: (props) => <b>{Object.keys(props).length}</b> })

    const { container } = render(<slot.Root userId={123} />)

    expect(texts(container, "b")).toEqual(["0"])
  })

  it("passes slot props through an explicit identity mapProps", () => {
    const slot = createSlot<{ userId: number }>()

    slot.api.insert({
      mapProps: (slotProps) => slotProps,
      Component: (props) => <b>{props.userId}</b>,
    })

    const { container } = render(<slot.Root userId={123} />)

    expect(texts(container, "b")).toEqual(["123"])
  })

  it("never re-renders a child without mapProps, no matter how Root props churn", () => {
    const slot = createSlot<{ tick: number }>()
    let renders = 0

    slot.api.insert({
      Component: () => {
        renders += 1

        return <i>static</i>
      },
    })

    const { rerender } = render(<slot.Root tick={1} />)

    const before = renders

    rerender(<slot.Root tick={2} />)
    rerender(<slot.Root tick={3} />)
    rerender(<slot.Root tick={4} />)

    expect(renders).toBe(before)
  })

  it("transforms slot props with mapProps", () => {
    const slot = createSlot<{ userId: number }>()

    slot.api.insert({
      mapProps: (slotProps) => ({ label: `user-${slotProps.userId}` }),
      Component: (props) => <b>{props.label}</b>,
    })

    const { container } = render(<slot.Root userId={123} />)

    expect(texts(container, "b")).toEqual(["user-123"])
  })

  it("re-renders children when slot props change", () => {
    const slot = createSlot<{ value: string }>()

    slot.api.insert({
      mapProps: (slotProps) => slotProps,
      Component: (props) => <b>{props.value}</b>,
    })

    const { container, rerender } = render(<slot.Root value="a" />)

    rerender(<slot.Root value="b" />)

    expect(texts(container, "b")).toEqual(["b"])
  })

  it("clear empties the slot", () => {
    const slot = createSlot()

    slot.api.insert({ Component: () => <i>gone</i> })

    const { container } = render(<slot.Root />)

    act(() => {
      slot.api.clear()
    })

    expect(container.innerHTML).toBe("")
  })

  it("inserting a sibling does not re-render existing children", () => {
    const slot = createSlot()
    let renders = 0

    slot.api.insert({
      Component: () => {
        renders += 1

        return <i>first</i>
      },
    })

    render(<slot.Root />)

    const before = renders

    act(() => {
      slot.api.insert({ Component: () => <i>second</i> })
    })

    expect(renders).toBe(before)
  })

  it("inserting a sibling in the middle does not remount existing children", () => {
    const slot = createSlot()
    let mounts = 0

    const Tracked = () => {
      useEffect(() => {
        mounts += 1
      }, [])

      return <i>tracked</i>
    }

    slot.api.insert({ Component: Tracked, order: 2 })

    const { container } = render(<slot.Root />)

    act(() => {
      slot.api.insert({ Component: () => <i>early</i>, order: 1 })
    })

    expect(texts(container, "i")).toEqual(["early", "tracked"])
    expect(mounts).toBe(1)
  })

  it("inserting a sibling does not re-render existing mapped children", () => {
    const slot = createSlot<{ tick: number }>()
    let renders = 0

    slot.api.insert({
      mapProps: (slotProps) => slotProps,
      Component: () => {
        renders += 1

        return <i>first</i>
      },
    })

    render(<slot.Root tick={1} />)

    const before = renders

    act(() => {
      slot.api.insert({ mapProps: (slotProps) => slotProps, Component: () => <i>second</i> })
    })

    expect(renders).toBe(before)
  })

  it("inserting a sibling in the middle does not remount existing mapped children", () => {
    const slot = createSlot<{ tick: number }>()
    let mounts = 0

    const Tracked = () => {
      useEffect(() => {
        mounts += 1
      }, [])

      return <i>tracked</i>
    }

    slot.api.insert({ mapProps: (slotProps) => slotProps, Component: Tracked, order: 2 })

    const { container } = render(<slot.Root tick={1} />)

    act(() => {
      slot.api.insert({ Component: () => <i>early</i>, order: 1 })
    })

    expect(texts(container, "i")).toEqual(["early", "tracked"])
    expect(mounts).toBe(1)
  })

  it("does not call mapProps of existing children when a sibling is inserted", () => {
    const slot = createSlot<{ tick: number }>()
    let calls = 0

    slot.api.insert({
      mapProps: (slotProps) => {
        calls += 1

        return slotProps
      },
      Component: () => <i>mapped</i>,
    })

    const { container } = render(<slot.Root tick={1} />)

    const before = calls

    act(() => {
      slot.api.insert({ Component: () => <i>sibling</i> })
    })

    expect(texts(container, "i")).toEqual(["mapped", "sibling"])
    expect(calls).toBe(before)
  })

  it("re-rendering the host with same prop values does not re-render children", () => {
    const slot = createSlot<{ value: string }>()
    let renders = 0

    slot.api.insert({
      mapProps: (slotProps) => slotProps,
      Component: (props) => {
        renders += 1

        return <b>{props.value}</b>
      },
    })

    const { rerender } = render(<slot.Root value="same" />)

    const before = renders

    rerender(<slot.Root value="same" />)

    expect(renders).toBe(before)
  })

  it("does not re-render Component when a prop dropped by mapProps changes", () => {
    const slot = createSlot<{ kept: string; dropped: number }>()
    let renders = 0

    slot.api.insert({
      mapProps: (slotProps) => ({ kept: slotProps.kept }),
      Component: (props) => {
        renders += 1

        return <b>{props.kept}</b>
      },
    })

    const { rerender } = render(<slot.Root kept="x" dropped={1} />)

    const before = renders

    rerender(<slot.Root kept="x" dropped={2} />)

    expect(renders).toBe(before)
  })

  it("shields Component from unstable host props when mapProps narrows to stable values", () => {
    const slot = createSlot<{ data: { id: number } }>()
    let renders = 0

    slot.api.insert({
      mapProps: (slotProps) => ({ id: slotProps.data.id }),
      Component: (props) => {
        renders += 1

        return <b>{props.id}</b>
      },
    })

    const { rerender } = render(<slot.Root data={{ id: 1 }} />)

    const before = renders

    rerender(<slot.Root data={{ id: 1 }} />)

    expect(renders).toBe(before)
  })

  it("supports Component returning any ReactNode: null, string, array", () => {
    const slot = createSlot()

    slot.api.insert({ Component: () => null, order: 1 })
    slot.api.insert({ Component: () => "text", order: 2 })
    slot.api.insert({ Component: () => [<i key="a">a</i>, <i key="b">b</i>], order: 3 })

    const { container } = render(<slot.Root />)

    expect(container.textContent).toBe("textab")
    expect(texts(container, "i")).toEqual(["a", "b"])
  })

  it("slots are isolated from each other", () => {
    const first = createSlot()
    const second = createSlot()

    first.api.insert({ Component: () => <i>first</i> })

    const { container } = render(<second.Root />)

    expect(container.innerHTML).toBe("")
  })

  it("renders nothing for a child whose filter has rejected from the start, while siblings render", () => {
    const slot = createSlot<{ pass: boolean }>()

    slot.api.insert({
      filter: (slotProps) => slotProps.pass,
      mapProps: () => ({}),
      Component: () => <i>gated</i>,
      order: 1,
    })
    slot.api.insert({ Component: () => <i>plain</i>, order: 2 })

    const { container } = render(<slot.Root pass={false} />)

    expect(texts(container, "i")).toEqual(["plain"])
  })

  it("mounts the child once filter passes, without remounting siblings", () => {
    const slot = createSlot<{ pass: boolean }>()
    let mounts = 0

    const Tracked = () => {
      useEffect(() => {
        mounts += 1
      }, [])

      return <i>sibling</i>
    }

    slot.api.insert({
      filter: (slotProps) => slotProps.pass,
      mapProps: () => ({}),
      Component: () => <i>gated</i>,
      order: 1,
    })
    slot.api.insert({ Component: Tracked, order: 2 })

    const { container, rerender } = render(<slot.Root pass={false} />)

    expect(texts(container, "i")).toEqual(["sibling"])

    rerender(<slot.Root pass={true} />)

    expect(texts(container, "i")).toEqual(["gated", "sibling"])
    expect(mounts).toBe(1)
  })

  it("keeps the child mounted with the last passed props when filter turns false", () => {
    const slot = createSlot<{ value: string; pass: boolean }>()
    let mounts = 0

    slot.api.insert({
      filter: (slotProps) => slotProps.pass,
      mapProps: (slotProps) => ({ value: slotProps.value }),
      Component: (props) => {
        useEffect(() => {
          mounts += 1
        }, [])

        return <b>{props.value}</b>
      },
    })

    const { container, rerender } = render(<slot.Root value="a" pass={true} />)

    expect(texts(container, "b")).toEqual(["a"])

    rerender(<slot.Root value="b" pass={false} />)

    expect(texts(container, "b")).toEqual(["a"])
    expect(mounts).toBe(1)
  })

  it("thaws the frozen child when filter passes again, updating props without remount", () => {
    const slot = createSlot<{ value: string; pass: boolean }>()
    let mounts = 0

    slot.api.insert({
      filter: (slotProps) => slotProps.pass,
      mapProps: (slotProps) => ({ value: slotProps.value }),
      Component: (props) => {
        useEffect(() => {
          mounts += 1
        }, [])

        return <b>{props.value}</b>
      },
    })

    const { container, rerender } = render(<slot.Root value="a" pass={true} />)

    rerender(<slot.Root value="b" pass={false} />)

    expect(texts(container, "b")).toEqual(["a"])

    rerender(<slot.Root value="b" pass={true} />)

    expect(texts(container, "b")).toEqual(["b"])
    expect(mounts).toBe(1)
  })

  it("calls filter again when raw props change", () => {
    const slot = createSlot<{ tick: number }>()
    let calls = 0

    slot.api.insert({
      filter: () => {
        calls += 1

        return true
      },
      mapProps: (slotProps) => slotProps,
      Component: () => <i>gated</i>,
    })

    const { rerender } = render(<slot.Root tick={1} />)

    const before = calls

    rerender(<slot.Root tick={2} />)

    expect(calls).toBe(before + 1)
  })

  it("does not call filter on a same-value host re-render", () => {
    const slot = createSlot<{ tick: number }>()
    let calls = 0

    slot.api.insert({
      filter: () => {
        calls += 1

        return true
      },
      mapProps: (slotProps) => slotProps,
      Component: () => <i>gated</i>,
    })

    const { rerender } = render(<slot.Root tick={1} />)

    const before = calls

    rerender(<slot.Root tick={1} />)

    expect(calls).toBe(before)
  })

  it("does not call filter of existing children when a sibling is inserted", () => {
    const slot = createSlot<{ tick: number }>()
    let calls = 0

    slot.api.insert({
      filter: () => {
        calls += 1

        return true
      },
      mapProps: (slotProps) => slotProps,
      Component: () => <i>gated</i>,
    })

    render(<slot.Root tick={1} />)

    const before = calls

    act(() => {
      slot.api.insert({ Component: () => <i>sibling</i> })
    })

    expect(calls).toBe(before)
  })

  it("does not call mapProps while filter rejects, calls it once per passed update", () => {
    const slot = createSlot<{ tick: number; pass: boolean }>()
    let calls = 0

    slot.api.insert({
      filter: (slotProps) => slotProps.pass,
      mapProps: (slotProps) => {
        calls += 1

        return { tick: slotProps.tick }
      },
      Component: (props) => <b>{props.tick}</b>,
    })

    const { rerender } = render(<slot.Root tick={1} pass={false} />)

    expect(calls).toBe(0)

    rerender(<slot.Root tick={2} pass={false} />)

    expect(calls).toBe(0)

    rerender(<slot.Root tick={3} pass={true} />)

    expect(calls).toBe(1)
  })

  it("freezes Component while filter rejects, even as raw props change", () => {
    const slot = createSlot<{ value: string; pass: boolean }>()
    let renders = 0

    slot.api.insert({
      filter: (slotProps) => slotProps.pass,
      mapProps: (slotProps) => ({ value: slotProps.value }),
      Component: (props) => {
        renders += 1

        return <b>{props.value}</b>
      },
    })

    const { container, rerender } = render(<slot.Root value="a" pass={true} />)

    const before = renders

    rerender(<slot.Root value="b" pass={false} />)
    rerender(<slot.Root value="c" pass={false} />)

    expect(renders).toBe(before)
    expect(texts(container, "b")).toEqual(["a"])
  })

  it("keeps freeze state independent across two mounted Roots of the same slot", () => {
    const slot = createSlot<{ value: string; pass: boolean }>()

    slot.api.insert({
      filter: (slotProps) => slotProps.pass,
      mapProps: (slotProps) => ({ value: slotProps.value }),
      Component: (props) => <b>{props.value}</b>,
    })

    const first = render(<slot.Root value="first" pass={true} />)
    const second = render(<slot.Root value="second" pass={false} />)

    expect(texts(first.container, "b")).toEqual(["first"])
    expect(texts(second.container, "b")).toEqual([])

    second.rerender(<slot.Root value="second" pass={true} />)

    expect(texts(first.container, "b")).toEqual(["first"])
    expect(texts(second.container, "b")).toEqual(["second"])
  })

  it("store outlives Root unmount: remount renders the children again", () => {
    const slot = createSlot<{ value: string }>()

    slot.api.insert({ Component: () => <i>static</i>, order: 1 })
    slot.api.insert({
      filter: (slotProps) => slotProps.value !== "",
      mapProps: (slotProps) => ({ value: slotProps.value }),
      Component: (props) => <b>{props.value}</b>,
      order: 2,
    })

    const { container, rerender } = render(<slot.Root value="a" />)

    expect(texts(container, "i")).toEqual(["static"])
    expect(texts(container, "b")).toEqual(["a"])

    rerender(<u>off</u>)

    expect(texts(container, "i")).toEqual([])
    expect(texts(container, "b")).toEqual([])

    rerender(<slot.Root value="b" />)

    expect(texts(container, "i")).toEqual(["static"])
    expect(texts(container, "b")).toEqual(["b"])
  })

  it("remounted Root re-bootstraps a filtered child: frozen content does not survive remount", () => {
    const slot = createSlot<{ value: string; pass: boolean }>()
    let mounts = 0

    slot.api.insert({
      filter: (slotProps) => slotProps.pass,
      mapProps: (slotProps) => ({ value: slotProps.value }),
      Component: (props) => {
        useEffect(() => {
          mounts += 1
        }, [])

        return <b>{props.value}</b>
      },
    })

    const { container, rerender } = render(<slot.Root value="a" pass={true} />)

    expect(texts(container, "b")).toEqual(["a"])
    expect(mounts).toBe(1)

    rerender(<u>off</u>)
    rerender(<slot.Root value="b" pass={false} />)

    expect(texts(container, "b")).toEqual([])

    rerender(<slot.Root value="c" pass={true} />)

    expect(texts(container, "b")).toEqual(["c"])
    expect(mounts).toBe(2)
  })

  it("a render attempt React abandons does not poison the freeze cache", async () => {
    const slot = createSlot<{ value: string; pass: boolean }>()

    slot.api.insert({
      filter: (slotProps) => slotProps.pass,
      mapProps: (slotProps) => ({ value: slotProps.value }),
      Component: (props) => <b>{props.value}</b>,
    })

    const gate = new Promise<void>(() => {})
    const MaybeSuspend = ({ on }: { on: boolean }) => {
      if (on) throw gate

      return null
    }

    let drive!: (next: { value: string; pass: boolean; suspend: boolean }) => void
    const Host = () => {
      const [state, set] = useState({ value: "a", pass: true, suspend: false })

      drive = set

      return (
        <Suspense fallback={null}>
          <slot.Root value={state.value} pass={state.pass} />
          <MaybeSuspend on={state.suspend} />
        </Suspense>
      )
    }

    const { container } = render(<Host />)

    expect(texts(container, "b")).toEqual(["a"])

    await act(async () => {
      startTransition(() => drive({ value: "b", pass: true, suspend: true }))
    })

    expect(texts(container, "b")).toEqual(["a"])

    await act(async () => {
      drive({ value: "c", pass: false, suspend: false })
    })

    expect(texts(container, "b")).toEqual(["a"])
  })

  it("frozen siblings with identical filters never tear when an urgent update interrupts a time-sliced transition", async () => {
    const slot = createSlot<{ tick: number; kind: "pass" | "drop" }>()

    const busy = () => {
      const end = performance.now() + 0.2

      while (performance.now() < end) {}
    }

    for (let i = 0; i < 100; i++) {
      slot.api.insert({
        filter: (slotProps) => {
          busy()

          return slotProps.kind === "pass"
        },
        mapProps: (slotProps) => ({ tick: slotProps.tick }),
        Component: (props) => <b>{props.tick}</b>,
        order: i,
      })
    }

    let drive!: (next: { tick: number; kind: "pass" | "drop" }) => void
    const Host = () => {
      const [state, set] = useState<{ tick: number; kind: "pass" | "drop" }>({ tick: 1, kind: "pass" })

      drive = set

      return <slot.Root tick={state.tick} kind={state.kind} />
    }

    const { container } = render(<Host />)

    expect(new Set(texts(container, "b"))).toEqual(new Set(["1"]))

    globalThis.IS_REACT_ACT_ENVIRONMENT = false

    try {
      startTransition(() => drive({ tick: 5, kind: "pass" }))
      await new Promise((resolve) => setTimeout(resolve, 8))
      flushSync(() => drive({ tick: 3, kind: "drop" }))
      await new Promise((resolve) => setTimeout(resolve, 80))
    } finally {
      globalThis.IS_REACT_ACT_ENVIRONMENT = true
    }

    expect(texts(container, "b")).toHaveLength(100)
    expect(new Set(texts(container, "b")).size).toBe(1)
  })

  it("mapProps receives only props that passed filter", () => {
    const slot = createSlot<{ kind: "str"; text: string } | { kind: "num"; value: number }>()
    const seen: string[] = []

    slot.api.insert({
      filter: (slotProps) => slotProps.kind === "str",
      mapProps: (slotProps) => {
        seen.push(slotProps.kind)

        return { text: slotProps.text }
      },
      Component: (props) => <b>{props.text}</b>,
    })

    const { container, rerender } = render(<slot.Root kind="num" value={1} />)

    expect(seen).toEqual([])

    rerender(<slot.Root kind="str" text="hello" />)

    expect(seen).toEqual(["str"])
    expect(texts(container, "b")).toEqual(["hello"])
  })
})
