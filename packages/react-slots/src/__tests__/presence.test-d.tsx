import React, { type ComponentProps } from "react"
import { describe, expectTypeOf, it } from "vitest"
import type { EmptyObject } from "../payload"
import { createSlot, type PresenceSlot, type Slot } from "../createSlot"

describe("presence types", () => {
  it("createSlot() has no useCount/usePresence", () => {
    const slot = createSlot()

    // @ts-expect-error — no hooks without presence
    void slot.useCount
    // @ts-expect-error — no hooks without presence
    void slot.usePresence
  })

  it("createSlot<T>() / {} / {presence:false} / {presence:undefined} → base slot, no hooks", () => {
    const a = createSlot<{ userId: number }>()
    const b = createSlot({})
    const c = createSlot({ presence: false })
    const d = createSlot({ presence: undefined })

    expectTypeOf(a).toEqualTypeOf<Slot<{ userId: number }>>()
    expectTypeOf(b).toEqualTypeOf<Slot<void>>()
    expectTypeOf(c).toEqualTypeOf<Slot<void>>()
    expectTypeOf(d).toEqualTypeOf<Slot<void>>()
  })

  it("createSlot({ presence: <widened boolean var> }) → base slot, NO compile error", () => {
    const flag: boolean = Math.random() > 0.5
    const slot = createSlot({ presence: flag })

    expectTypeOf(slot).toEqualTypeOf<Slot<void>>()
  })

  it("createSlot({ presence: true }) → useCount/usePresence", () => {
    const slot = createSlot({ presence: true })

    expectTypeOf(slot.useCount).toEqualTypeOf<() => number>()
    expectTypeOf(slot.usePresence).toEqualTypeOf<() => readonly boolean[]>()
  })

  it("createSlot<T>({ presence: true }) preserves T on Root and insert", () => {
    const slot = createSlot<{ userId: number }>({ presence: true })

    expectTypeOf(slot).toEqualTypeOf<PresenceSlot<{ userId: number }>>()
    expectTypeOf<ComponentProps<typeof slot.Root>>().toMatchTypeOf<{ userId: number }>()

    slot.api.insert({
      mapProps: (slotProps) => ({ label: String(slotProps.userId) }),
      Component: (props) => {
        expectTypeOf(props).toEqualTypeOf<{ label: string }>()

        return null
      },
    })
  })

  it("createSlot<void>({ presence: true }) keeps InsertWithoutProps", () => {
    const slot = createSlot({ presence: true })

    slot.api.insert({
      Component: (props) => {
        expectTypeOf(props).toEqualTypeOf<EmptyObject>()

        return null
      },
    })

    slot.api.insert({
      // @ts-expect-error — mapProps forbidden on a slot without props
      mapProps: () => ({ label: "x" }),
      Component: () => null,
    })
  })

  it("presence config does not disturb T inference or the Insertable constraint", () => {
    const slot = createSlot<{ kind: "str"; text: string } | { kind: "num"; value: number }>({ presence: true })

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

  it("useCount/usePresence are top-level, not on api", () => {
    const slot = createSlot({ presence: true })

    // @ts-expect-error — hooks are not on api
    void slot.api.useCount
    // @ts-expect-error — hooks are not on api
    void slot.api.usePresence
  })

  it("return-type parity: base slot equals Slot<T> (HARD GATE)", () => {
    expectTypeOf<ReturnType<typeof createSlot<void>>>().toEqualTypeOf<Slot<void>>()
    expectTypeOf<ReturnType<typeof createSlot<{ userId: number }>>>().toEqualTypeOf<Slot<{ userId: number }>>()
  })
})
