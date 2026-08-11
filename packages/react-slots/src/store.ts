import { useSyncExternalStore } from "use-sync-external-store/shim"
import { insertSorted, type WithOrder } from "./insertSorted"

const EMPTY: readonly never[] = []
// Deliberately distinct from EMPTY: snapshot identity is what tells a never-inserted
// store (EMPTY) from an emptied one (CLEARED) — fallback rendering relies on it.
const CLEARED: readonly never[] = []

const neverInserted = (state: readonly unknown[]): boolean => state === EMPTY

const createStore = <Item extends WithOrder>() => {
  let state: readonly Item[] = EMPTY
  const listeners = new Set<() => void>()

  const notify = () => listeners.forEach((listener) => listener())

  const get = () => state

  const insert = (item: Item): void => {
    state = insertSorted(state, item)
    notify()
  }

  const clear = (): void => {
    if (state.length === 0) return

    state = CLEARED
    notify()
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  }

  return { get, insert, clear, subscribe }
}

type Store<Item extends WithOrder> = ReturnType<typeof createStore<Item>>

const useStore = <Item extends WithOrder>(store: Store<Item>): readonly Item[] =>
  useSyncExternalStore(store.subscribe, store.get, store.get)

export { createStore, neverInserted, useStore }
export type { Store }
