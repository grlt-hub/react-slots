import { describe, expect, it, vi } from "vitest"
import { createStore } from "../store"

type Item = { order?: number; label?: string }

describe("createStore", () => {
  it("starts empty", () => {
    const store = createStore<Item>()

    expect(store.get()).toEqual([])
  })

  it("insert adds an item and notifies subscribers", () => {
    const store = createStore<Item>()
    const listener = vi.fn()

    store.subscribe(listener)
    store.insert({ label: "a" })

    expect(store.get().map((x) => x.label)).toEqual(["a"])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("insert respects order", () => {
    const store = createStore<Item>()

    store.insert({ order: 2, label: "second" })
    store.insert({ order: 1, label: "first" })

    expect(store.get().map((x) => x.label)).toEqual(["first", "second"])
  })

  it("clear empties the store and notifies subscribers", () => {
    const store = createStore<Item>()
    const listener = vi.fn()

    store.insert({ label: "a" })
    store.subscribe(listener)
    store.clear()

    expect(store.get()).toEqual([])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("clear on an empty store does not notify", () => {
    const store = createStore<Item>()
    const listener = vi.fn()

    store.subscribe(listener)
    store.clear()

    expect(listener).not.toHaveBeenCalled()
  })

  it("unsubscribe stops notifications", () => {
    const store = createStore<Item>()
    const listener = vi.fn()

    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.insert({})

    expect(listener).not.toHaveBeenCalled()
  })

  it("notifies every subscriber", () => {
    const store = createStore<Item>()
    const first = vi.fn()
    const second = vi.fn()

    store.subscribe(first)
    store.subscribe(second)
    store.insert({})

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it("get returns the same reference between mutations", () => {
    const store = createStore<Item>()

    store.insert({})

    const snapshot = store.get()

    expect(store.get()).toBe(snapshot)
  })

  it("every mutation produces a new reference, old snapshot stays intact", () => {
    const store = createStore<Item>()

    store.insert({ label: "a" })

    const snapshot = store.get()

    store.insert({ label: "b" })

    expect(store.get()).not.toBe(snapshot)
    expect(snapshot.map((x) => x.label)).toEqual(["a"])
  })

  it("empty state is the shared EMPTY reference", () => {
    const first = createStore<Item>()
    const second = createStore<Item>()

    expect(first.get()).toBe(second.get())

    first.insert({})
    first.clear()

    expect(first.get()).toBe(second.get())
  })

  it("stores are isolated from each other", () => {
    const first = createStore<Item>()
    const second = createStore<Item>()
    const listener = vi.fn()

    second.subscribe(listener)
    first.insert({ label: "a" })

    expect(second.get()).toEqual([])
    expect(listener).not.toHaveBeenCalled()
  })
})
