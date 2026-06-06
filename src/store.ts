import { useSyncExternalStore } from "use-sync-external-store/shim"
import { insertSorted, type WithOrder } from "./insertSorted"

const EMPTY: readonly never[] = []

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

    state = EMPTY
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

export { createStore, useStore }
export type { Store }
