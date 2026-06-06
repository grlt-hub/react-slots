import React, { act } from "react"
import { describe, expect, it } from "vitest"
import { createStore, useStore, type Store } from "../store"
import { render, texts } from "./renderer"

type Item = { order?: number; label: string }

const List = ({ store }: { store: Store<Item> }) => {
  const items = useStore(store)

  return (
    <ul>
      {items.map((item) => (
        <li key={item.label}>{item.label}</li>
      ))}
    </ul>
  )
}

describe("useStore", () => {
  it("renders items inserted before mount", () => {
    const store = createStore<Item>()

    store.insert({ label: "early" })

    const { container } = render(<List store={store} />)

    expect(texts(container, "li")).toEqual(["early"])
  })

  it("re-renders when an item is inserted after mount", () => {
    const store = createStore<Item>()

    const { container } = render(<List store={store} />)

    expect(texts(container, "li")).toEqual([])

    act(() => {
      store.insert({ label: "late" })
    })

    expect(texts(container, "li")).toEqual(["late"])
  })

  it("renders items in order", () => {
    const store = createStore<Item>()

    const { container } = render(<List store={store} />)

    act(() => {
      store.insert({ order: 2, label: "second" })
      store.insert({ order: 1, label: "first" })
    })

    expect(texts(container, "li")).toEqual(["first", "second"])
  })

  it("clear empties the rendered list", () => {
    const store = createStore<Item>()

    store.insert({ label: "a" })

    const { container } = render(<List store={store} />)

    act(() => {
      store.clear()
    })

    expect(texts(container, "li")).toEqual([])
  })

  it("does not re-render on unrelated store changes", () => {
    const store = createStore<Item>()
    const unrelated = createStore<Item>()
    let renders = 0

    const Counting = () => {
      useStore(store)
      renders += 1

      return null
    }

    render(<Counting />)

    const before = renders

    act(() => {
      unrelated.insert({ label: "noise" })
    })

    expect(renders).toBe(before)
  })
})
