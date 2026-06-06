import React, { memo, useRef, type FunctionComponent, type NamedExoticComponent, type ReactElement } from "react"
import type { Insertable, NormalizedProps, Payload } from "./payload"
import { createStore, useStore } from "./store"

let idCounter = 0

const createSlot = <T extends Insertable = void>() => {
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
                const last = useRef<ReactElement | null>(null)

                if (filter(props)) last.current = <Memoized {...mapProps(props)} />

                return last.current
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

  const Root = memo<SlotProps>((props) =>
    useStore(store).map((child) =>
      child.withProps ? <child.Child key={child.id} {...props} /> : <child.Child key={child.id} />,
    ),
  )

  return { Root, api: { insert, clear: store.clear } }
}

export { createSlot }
