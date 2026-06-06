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

  it("Component receives slot props without mapProps", () => {
    const slot = createSlot<{ userId: number }>()

    slot.api.insert({
      Component: (props) => {
        expectTypeOf(props).toEqualTypeOf<{ userId: number }>()

        return <b>{props.userId}</b>
      },
    })

    // @ts-expect-error — Component props do not match the slot props
    slot.api.insert({
      Component: (props: { nope: string }) => <b>{props.nope}</b>,
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

  it("keeps optionality for union slot props", () => {
    const slot = createSlot<{ x: number } | undefined>()

    slot.api.insert({
      Component: (props) => {
        expectTypeOf(props).toEqualTypeOf<{ x: number } | undefined>()

        return null
      },
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
})
