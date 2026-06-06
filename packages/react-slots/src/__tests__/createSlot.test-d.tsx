import React, { type ComponentProps } from "react"
import { describe, expectTypeOf, it } from "vitest"
import type { EmptyObject } from "../payload"
import { createSlot } from "../createSlot"

describe("createSlot types", () => {
  it("types Slot props from T", () => {
    const slot = createSlot<{ userId: number }>()

    expectTypeOf<ComponentProps<typeof slot.Root>>().toMatchTypeOf<{ userId: number }>()
  })

  it("slot without T renders without props", () => {
    const slot = createSlot()

    expectTypeOf<ComponentProps<typeof slot.Root>>().toMatchTypeOf<EmptyObject>()

    // @ts-expect-error — a slot without props accepts no attributes
    void (<slot.Root foo="bar" />)
  })

  it("Component receives no props without mapProps, even on a typed slot", () => {
    const slot = createSlot<{ userId: number }>()

    slot.api.insert({
      Component: (props) => {
        expectTypeOf(props).toEqualTypeOf<EmptyObject>()

        return null
      },
    })

    // @ts-expect-error — slot props require an explicit mapProps
    slot.api.insert({
      Component: (props: { userId: number }) => <b>{props.userId}</b>,
    })
  })

  it("Component receives mapProps result with mapProps", () => {
    const slot = createSlot<{ userId: number }>()

    slot.api.insert({
      mapProps: (slotProps) => ({ label: String(slotProps.userId) }),
      Component: (props) => {
        expectTypeOf(props).toEqualTypeOf<{ label: string }>()

        return <b>{props.label}</b>
      },
    })
  })

  it("mapProps returning void gives EmptyObject to Component", () => {
    const slot = createSlot<{ userId: number }>()

    slot.api.insert({
      mapProps: () => {},
      Component: (props) => {
        expectTypeOf(props).toEqualTypeOf<EmptyObject>()

        return null
      },
    })
  })

  it("rejects mapProps returning a primitive", () => {
    const slot = createSlot<{ count: number }>()

    slot.api.insert({
      // @ts-expect-error — mapProps must return an object, spreading a primitive crashes at runtime
      mapProps: (slotProps: { count: number }) => slotProps.count * 2,
      Component: () => null,
    })
  })

  it("rejects key and ref in slot props", () => {
    // @ts-expect-error — key is reserved by React and silently swallowed from spreads
    createSlot<{ key: string }>()

    // @ts-expect-error — ref is reserved by React
    createSlot<{ ref: string }>()
  })

  it("rejects key in mapProps result", () => {
    const slot = createSlot<{ userId: number }>()

    // @ts-expect-error — key is forbidden in the mapProps result
    slot.api.insert({
      mapProps: () => ({ key: "x" }),
      Component: () => null,
    })
  })

  it("rejects ref in mapProps result", () => {
    const slot = createSlot<{ userId: number }>()

    // @ts-expect-error — ref is forbidden in the mapProps result
    slot.api.insert({
      mapProps: () => ({ ref: "x" }),
      Component: () => null,
    })
  })

  it("normalizes union slot props on both sides: Root and mapProps", () => {
    const slot = createSlot<{ x: number } | undefined>()

    void (<slot.Root />)
    void (<slot.Root x={1} />)

    // @ts-expect-error — unknown prop is rejected
    void (<slot.Root y={1} />)

    slot.api.insert({
      mapProps: (slotProps) => {
        expectTypeOf(slotProps).toEqualTypeOf<{ x: number } | EmptyObject>()

        return slotProps
      },
      Component: (props) => {
        expectTypeOf(props).toEqualTypeOf<{ x: number } | EmptyObject>()

        return null
      },
    })
  })

  it("accepts explicit undefined mapProps as the no-props form", () => {
    const slot = createSlot<{ userId: number }>()

    slot.api.insert({
      mapProps: undefined,
      Component: (props) => {
        expectTypeOf(props).toEqualTypeOf<EmptyObject>()

        return null
      },
    })

    // @ts-expect-error — slot props require an explicit mapProps function
    slot.api.insert({
      mapProps: undefined,
      Component: (props: { userId: number }) => <b>{props.userId}</b>,
    })
  })

  it("accepts explicit undefined order", () => {
    const slot = createSlot()

    slot.api.insert({ Component: () => null, order: undefined })
  })

  it("slot without props forbids mapProps", () => {
    const slot = createSlot()

    slot.api.insert({
      // @ts-expect-error — mapProps is forbidden on a slot without props
      mapProps: () => ({ label: "x" }),
      Component: () => null,
    })
  })

  it("slot without T gives EmptyObject to Component", () => {
    const slot = createSlot()

    slot.api.insert({
      Component: (props) => {
        expectTypeOf(props).toEqualTypeOf<EmptyObject>()

        return null
      },
    })
  })

  it("narrows mapProps input through an explicit filter type guard, down to Component", () => {
    const slot = createSlot<{ kind: "str"; text: string } | { kind: "num"; value: number }>()

    slot.api.insert({
      filter: (slotProps): slotProps is { kind: "str"; text: string } => slotProps.kind === "str",
      mapProps: (slotProps) => {
        expectTypeOf(slotProps).toEqualTypeOf<{ kind: "str"; text: string }>()

        return slotProps
      },
      Component: (props) => {
        expectTypeOf(props).toEqualTypeOf<{ kind: "str"; text: string }>()

        return null
      },
    })
  })

  it("narrows through an inferred filter predicate on a discriminated union", () => {
    const slot = createSlot<{ kind: "str"; text: string } | { kind: "num"; value: number }>()

    slot.api.insert({
      filter: (slotProps) => slotProps.kind === "str",
      mapProps: (slotProps) => {
        expectTypeOf(slotProps).toEqualTypeOf<{ kind: "str"; text: string }>()

        return { text: slotProps.text }
      },
      Component: (props) => {
        expectTypeOf(props).toEqualTypeOf<{ text: string }>()

        return null
      },
    })
  })

  it("falls back to the boolean overload when filter narrows only a property", () => {
    const slot = createSlot<{ loaded: boolean; name: string }>()

    slot.api.insert({
      filter: (slotProps) => slotProps.loaded,
      mapProps: (slotProps) => {
        expectTypeOf(slotProps).toEqualTypeOf<{ loaded: boolean; name: string }>()

        return { name: slotProps.name }
      },
      Component: (props) => {
        expectTypeOf(props).toEqualTypeOf<{ name: string }>()

        return null
      },
    })
  })

  it("accepts a boolean filter without narrowing", () => {
    const slot = createSlot<{ count: number }>()

    slot.api.insert({
      filter: (slotProps) => slotProps.count > 0,
      mapProps: (slotProps) => {
        expectTypeOf(slotProps).toEqualTypeOf<{ count: number }>()

        return slotProps
      },
      Component: (props) => {
        expectTypeOf(props).toEqualTypeOf<{ count: number }>()

        return null
      },
    })
  })

  it("rejects filter without mapProps", () => {
    const slot = createSlot<{ userId: number }>()

    // @ts-expect-error — filter requires an explicit mapProps
    slot.api.insert({
      filter: (slotProps: { userId: number }) => slotProps.userId > 0,
      Component: () => null,
    })
  })

  it("slot without props forbids filter", () => {
    const slot = createSlot()

    slot.api.insert({
      // @ts-expect-error — filter is forbidden on a slot without props
      filter: () => true,
      Component: () => null,
    })
  })

  it("accepts explicit undefined filter as the unfiltered form", () => {
    const slot = createSlot<{ userId: number }>()

    slot.api.insert({
      filter: undefined,
      mapProps: (slotProps) => {
        expectTypeOf(slotProps).toEqualTypeOf<{ userId: number }>()

        return slotProps
      },
      Component: (props) => {
        expectTypeOf(props).toEqualTypeOf<{ userId: number }>()

        return null
      },
    })
  })

  it("rejects mapProps returning a primitive under filter", () => {
    const slot = createSlot<{ count: number }>()

    slot.api.insert({
      filter: (slotProps: { count: number }): slotProps is { count: number } => slotProps.count > 0,
      // @ts-expect-error — mapProps must return an object under the guard overload too
      mapProps: (slotProps: { count: number }) => slotProps.count * 2,
      Component: () => null,
    })

    slot.api.insert({
      filter: (slotProps: { count: number }) => slotProps.count > 0,
      // @ts-expect-error — mapProps must return an object under the boolean overload too
      mapProps: (slotProps: { count: number }) => slotProps.count * 2,
      Component: () => null,
    })
  })

  it("rejects key in mapProps result under filter", () => {
    const slot = createSlot<{ userId: number }>()

    slot.api.insert({
      filter: (slotProps: { userId: number }) => slotProps.userId > 0,
      // @ts-expect-error — key is forbidden in the mapProps result
      mapProps: () => ({ key: "x" }),
      Component: () => null,
    })
  })

  it("rejects ref in mapProps result under filter", () => {
    const slot = createSlot<{ userId: number }>()

    slot.api.insert({
      filter: (slotProps: { userId: number }) => slotProps.userId > 0,
      // @ts-expect-error — ref is forbidden in the mapProps result
      mapProps: () => ({ ref: "x" }),
      Component: () => null,
    })
  })

  it("accepts explicit undefined order on both filter overloads", () => {
    const slot = createSlot<{ kind: "str"; text: string } | { kind: "num"; value: number }>()

    slot.api.insert({
      filter: (slotProps) => slotProps.kind === "str",
      mapProps: (slotProps) => ({ text: slotProps.text }),
      Component: (props) => {
        expectTypeOf(props).toEqualTypeOf<{ text: string }>()

        return null
      },
      order: undefined,
    })

    slot.api.insert({
      filter: (slotProps) => slotProps.kind !== undefined,
      mapProps: (slotProps) => slotProps,
      Component: () => null,
      order: undefined,
    })
  })

  it("convention: filter above mapProps — reversed order silently loses narrowing", () => {
    const slot = createSlot<{ kind: "str"; text: string } | { kind: "num"; value: number }>()

    slot.api.insert({
      mapProps: (slotProps) => {
        expectTypeOf(slotProps).toEqualTypeOf<{ kind: "str"; text: string } | { kind: "num"; value: number }>()

        return { mapped: true }
      },
      filter: (slotProps) => slotProps.kind === "str",
      Component: (props) => {
        expectTypeOf(props).toEqualTypeOf<{ mapped: boolean }>()

        return null
      },
    })
  })
})
