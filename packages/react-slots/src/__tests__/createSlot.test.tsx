import React, { act, useEffect } from "react"
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
})
