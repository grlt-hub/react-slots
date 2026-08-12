import type { ReactNode } from "react"
import React, { memo, useState, type FunctionComponent, type NamedExoticComponent, type ReactElement } from "react"
import { useSyncExternalStore } from "use-sync-external-store/shim"
import type { Insertable, NormalizedProps, Payload } from "./payload"
import { createPresenceStore, probe, type PresenceStore } from "./presenceStore"
import { createStore, neverInserted, useStore } from "./store"

let idCounter = 0

const EMPTY_PRESENCE: readonly boolean[] = []

type SlotConfig<T extends Insertable> = {
  presence?: boolean | undefined
  // NoInfer blocks T inference from the Fallback signature: slot props come only
  // from the explicit type argument.
  Fallback?: ((props: NoInfer<NormalizedProps<T>>) => ReactNode) | undefined
}

type Slot<T extends Insertable> = {
  Root: NamedExoticComponent<NormalizedProps<T> & object>
  api: { insert: Payload<T>; clear: () => void }
}

type PresenceSlot<T extends Insertable> = Slot<T> & {
  useCount: () => number
  usePresence: () => readonly boolean[]
}

const projectAllFalse = (items: readonly { id: string }[]): readonly boolean[] =>
  items.length === 0 ? EMPTY_PRESENCE : items.map(() => false)

function createSlot<T extends Insertable = void>(config: SlotConfig<T> & { presence: true }): PresenceSlot<T>
function createSlot<T extends Insertable = void>(config?: SlotConfig<T>): Slot<T>
function createSlot<T extends Insertable = void>(config?: SlotConfig<T>) {
  if (!config?.presence) {
    type SlotProps = NormalizedProps<T> & object
    type Item = { id: string; order?: number | undefined } & (
      | { withProps: true; Child: NamedExoticComponent<SlotProps> }
      | { withProps: false; Child: NamedExoticComponent<object> }
    )

    const store = createStore<Item>()

    const insert = ((payload: {
      Component: FunctionComponent<object>
      filter?: (slotProps: SlotProps) => boolean
      mapProps?: (slotProps: SlotProps) => object
      order?: number | undefined
    }): void => {
      const { Component, filter, mapProps, order } = payload
      const Memoized = memo(Component)

      const item: Item = mapProps
        ? {
            id: String(++idCounter),
            order,
            withProps: true,
            Child: filter
              ? memo<SlotProps>((props) => {
                  const [last, setLast] = useState<{ props: SlotProps; element: ReactElement | null }>(() => ({
                    props,
                    element: filter(props) ? <Memoized {...mapProps(props)} /> : null,
                  }))

                  if (props !== last.props && filter(props)) {
                    setLast({ props, element: <Memoized {...mapProps(props)} /> })
                  }

                  return last.element
                })
              : memo<SlotProps>((props) => <Memoized {...mapProps(props)} />),
          }
        : {
            id: String(++idCounter),
            order,
            withProps: false,
            Child: Memoized,
          }

      store.insert(item)
    }) as Payload<T>

    const Fallback = config?.Fallback ? memo(config.Fallback as FunctionComponent<SlotProps>) : null

    const Root = Fallback
      ? memo<SlotProps>((props) => {
          const items = useStore(store)

          if (items.length === 0) return neverInserted(items) ? <Fallback {...props} /> : null

          return items.map((child) =>
            child.withProps ? <child.Child key={child.id} {...props} /> : <child.Child key={child.id} />,
          )
        })
      : memo<SlotProps>((props) =>
          useStore(store).map((child) =>
            child.withProps ? <child.Child key={child.id} {...props} /> : <child.Child key={child.id} />,
          ),
        )

    return { Root, api: { insert, clear: store.clear } }
  }

  type SlotProps = NormalizedProps<T> & object
  type Item = { id: string; order?: number | undefined } & (
    | { withProps: true; Child: NamedExoticComponent<SlotProps> }
    | { withProps: false; Child: NamedExoticComponent<object> }
  )

  const store = createStore<Item>()
  const presence: PresenceStore = createPresenceStore(store.get, store.subscribe)

  const insert = ((payload: {
    Component: FunctionComponent<object>
    filter?: (slotProps: SlotProps) => boolean
    mapProps?: (slotProps: SlotProps) => object
    order?: number | undefined
  }): void => {
    const { Component, filter, mapProps, order } = payload
    const id = String(++idCounter)
    const Memoized = memo(probe(presence, id, Component))

    const item: Item = mapProps
      ? {
          id,
          order,
          withProps: true,
          Child: filter
            ? memo<SlotProps>((props) => {
                const [last, setLast] = useState<{ props: SlotProps; element: ReactElement | null }>(() => ({
                  props,
                  element: filter(props) ? <Memoized {...mapProps(props)} /> : null,
                }))

                if (props !== last.props && filter(props)) {
                  setLast({ props, element: <Memoized {...mapProps(props)} /> })
                }

                return last.element
              })
            : memo<SlotProps>((props) => <Memoized {...mapProps(props)} />),
        }
      : {
          id,
          order,
          withProps: false,
          Child: Memoized,
        }

    store.insert(item)
  }) as Payload<T>

  const Fallback = config.Fallback ? memo(config.Fallback as FunctionComponent<SlotProps>) : null

  const Root = Fallback
    ? memo<SlotProps>((props) => {
        const items = useStore(store)

        if (items.length === 0) return neverInserted(items) ? <Fallback {...props} /> : null

        return items.map((child) =>
          child.withProps ? <child.Child key={child.id} {...props} /> : <child.Child key={child.id} />,
        )
      })
    : memo<SlotProps>((props) =>
        useStore(store).map((child) =>
          child.withProps ? <child.Child key={child.id} {...props} /> : <child.Child key={child.id} />,
        ),
      )

  const subscribe = (listener: () => void) => presence.subscribe(listener)

  const getCount = () => {
    const items = store.get()
    let n = 0

    for (let i = 0; i < items.length; i++) if (presence.renders(items[i]!.id)) n++

    return n
  }

  let presencePrevItems: readonly Item[] | null = null
  let presenceArray: readonly boolean[] = EMPTY_PRESENCE

  const getPresence = () => {
    const items = store.get()

    if (items.length === 0) {
      presenceArray = EMPTY_PRESENCE
      presencePrevItems = items

      return presenceArray
    }

    if (presencePrevItems === items && presenceArray.length === items.length) {
      let changed = false

      for (let i = 0; i < items.length; i++) {
        if (presenceArray[i] !== presence.renders(items[i]!.id)) {
          changed = true
          break
        }
      }

      if (!changed) return presenceArray
    }

    presenceArray = items.map((item) => presence.renders(item.id))
    presencePrevItems = items

    return presenceArray
  }

  const getServerCount = () => 0

  let serverPrevItems: readonly Item[] | null = null
  let serverPresence: readonly boolean[] = EMPTY_PRESENCE

  const getServerPresence = () => {
    const items = store.get()

    if (serverPrevItems !== items) {
      serverPrevItems = items
      serverPresence = projectAllFalse(items)
    }

    return serverPresence
  }

  const useCount = () => useSyncExternalStore(subscribe, getCount, getServerCount)
  const usePresence = () => useSyncExternalStore(subscribe, getPresence, getServerPresence)

  return { Root, api: { insert, clear: store.clear }, useCount, usePresence }
}

export { createSlot }
export type { PresenceSlot, Slot }
