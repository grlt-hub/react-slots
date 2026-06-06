import React, { memo, type FunctionComponent, type NamedExoticComponent } from "react"
import type { Insertable, NormalizedProps, Payload } from "./payload"
import { createStore, useStore } from "./store"

let idCounter = 0

const createSlot = <T extends Insertable = void>() => {
  type SlotProps = NormalizedProps<T> & object
  type Item = { id: string; order?: number | undefined; Child: NamedExoticComponent<SlotProps> }

  const store = createStore<Item>()

  const insert = ((payload: {
    Component: FunctionComponent<object>
    mapProps?: (slotProps: SlotProps) => object
    order?: number | undefined
  }): void => {
    const { Component, mapProps, order } = payload
    const Memoized = memo(Component)

    const Child = mapProps
      ? memo<SlotProps>((props) => <Memoized {...mapProps(props)} />)
      : (Memoized as NamedExoticComponent<SlotProps>)

    store.insert({ id: String(++idCounter), order, Child })
  }) as Payload<T>

  const Root = memo<SlotProps>((props) => useStore(store).map((child) => <child.Child key={child.id} {...props} />))

  return { Root, api: { insert, clear: store.clear } }
}

export { createSlot }
