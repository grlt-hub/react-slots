import { useSyncExternalStore } from "use-sync-external-store/shim"
import type { Store, WithOrder } from "./store"

const useStore = <Item extends WithOrder>(store: Store<Item>): readonly Item[] =>
  useSyncExternalStore(store.subscribe, store.get, store.get)

export { useStore }
