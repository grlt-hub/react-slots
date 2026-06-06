import { describe, expect, it } from "vitest"
import { insertSorted } from "../insertSorted"

type Item = { order?: number; label: string }

describe("insertSorted", () => {
  it("inserts into an empty list", () => {
    expect(insertSorted<Item>([], { label: "a" })).toEqual([{ label: "a" }])
  })

  it("appends elements with equal order in insertion order (stability)", () => {
    let list: readonly Item[] = []
    list = insertSorted(list, { order: 1, label: "a" })
    list = insertSorted(list, { order: 1, label: "b" })
    list = insertSorted(list, { order: 1, label: "c" })

    expect(list.map((x) => x.label)).toEqual(["a", "b", "c"])
  })

  it("places elements by ascending order: begin, middle, end", () => {
    let list: readonly Item[] = []
    list = insertSorted(list, { order: 20, label: "end" })
    list = insertSorted(list, { order: 0, label: "begin" })
    list = insertSorted(list, { order: 10, label: "middle" })

    expect(list.map((x) => x.label)).toEqual(["begin", "middle", "end"])
  })

  it("treats missing order as 0", () => {
    let list: readonly Item[] = []
    list = insertSorted(list, { order: 1, label: "ordered" })
    list = insertSorted(list, { label: "default" })
    list = insertSorted(list, { order: -1, label: "negative" })

    expect(list.map((x) => x.label)).toEqual(["negative", "default", "ordered"])
  })

  it("supports negative order", () => {
    let list: readonly Item[] = []
    list = insertSorted(list, { label: "zero" })
    list = insertSorted(list, { order: -10, label: "first" })

    expect(list.map((x) => x.label)).toEqual(["first", "zero"])
  })

  it("does not mutate the original list", () => {
    const original: readonly Item[] = [{ order: 1, label: "a" }]
    const result = insertSorted(original, { order: 0, label: "b" })

    expect(original).toEqual([{ order: 1, label: "a" }])
    expect(result).not.toBe(original)
    expect(result.map((x) => x.label)).toEqual(["b", "a"])
  })
})
