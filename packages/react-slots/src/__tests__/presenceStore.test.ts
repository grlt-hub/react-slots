import { beforeEach, describe, expect, it, vi } from "vitest"
import { createPresenceStore } from "../presenceStore"

const microtask = () => new Promise<void>((resolve) => queueMicrotask(resolve))

type Item = { id: string }

const setup = (items: Item[] = []) => {
  let itemsRef: readonly Item[] = items
  const itemsListeners = new Set<() => void>()

  const getItems = () => itemsRef
  const subscribeItems = vi.fn((l: () => void) => {
    itemsListeners.add(l)

    return () => {
      itemsListeners.delete(l)
    }
  })
  const notifyItems = (next: readonly Item[]) => {
    itemsRef = next
    itemsListeners.forEach((l) => l())
  }

  const store = createPresenceStore(getItems, subscribeItems)
  const listener = vi.fn()

  store.subscribe(listener)

  return { store, listener, subscribeItems, notifyItems }
}

const el = () => ({}) as unknown as Element

describe("createPresenceStore", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("starts empty: no reports, renders(any) is false", () => {
    const { store } = setup()

    expect(store.renders("1")).toBe(false)
    expect(store.renders("anything")).toBe(false)
  })

  it("report(rendered=true) for one id triggers one coalesced notify", async () => {
    const { store, listener } = setup()

    store.report("1", el(), true)

    expect(listener).not.toHaveBeenCalled()
    await microtask()

    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.renders("1")).toBe(true)
  })

  it("report is Object.is-gated: an identical re-report does not notify", async () => {
    const { store, listener } = setup()
    const a = el()

    store.report("1", a, true)
    await microtask()
    expect(listener).toHaveBeenCalledTimes(1)

    store.report("1", a, true)
    await microtask()

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("OR-aggregation: two elements one id — renders(id) true if any element true", async () => {
    const { store } = setup()
    const a = el()
    const b = el()

    store.report("1", a, false)
    store.report("1", b, true)
    await microtask()

    expect(store.renders("1")).toBe(true)
  })

  it("remove the last true element drops renders(id) to false and notifies", async () => {
    const { store, listener } = setup()
    const a = el()

    store.report("1", a, true)
    await microtask()
    expect(store.renders("1")).toBe(true)

    store.remove("1", a)
    await microtask()

    expect(store.renders("1")).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it("remove prunes the empty inner map (re-report after remove starts fresh)", async () => {
    const { store } = setup()
    const a = el()

    store.report("1", a, true)
    await microtask()
    store.remove("1", a)
    await microtask()

    expect(store.renders("1")).toBe(false)

    const b = el()

    store.report("1", b, true)
    await microtask()

    expect(store.renders("1")).toBe(true)
  })

  it("StrictMode-idempotent: report; remove; report on the SAME element converges to one element entry, renders true", async () => {
    const { store } = setup()
    const a = el()

    store.report("1", a, true)
    store.remove("1", a)
    store.report("1", a, true)
    await microtask()

    expect(store.renders("1")).toBe(true)
  })

  it("multiple reports in one tick coalesce to a single notify", async () => {
    const { store, listener } = setup()

    store.report("1", el(), true)
    store.report("2", el(), true)
    store.report("3", el(), true)

    await microtask()

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("a composition change via subscribeItems triggers exactly one coalesced notify (no extra flush)", async () => {
    const { listener, notifyItems } = setup()

    notifyItems([{ id: "1" }])
    await microtask()

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("a composition change in the same tick as a DOM report coalesces to ONE flush", async () => {
    const { store, listener, notifyItems } = setup()

    notifyItems([{ id: "1" }])
    store.report("1", el(), true)

    await microtask()

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("notify is microtask-deferred: synchronous read after report sees the pre-flush listener count", () => {
    const { store, listener } = setup()

    store.report("1", el(), true)

    expect(listener).toHaveBeenCalledTimes(0)
  })
})
