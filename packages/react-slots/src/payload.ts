import type { ReactNode } from "react"

type EmptyObject = Record<string, never>

type Insertable = (object & { key?: never; ref?: never }) | void

type NormalizedProps<T> = unknown extends T ? EmptyObject : T extends void ? EmptyObject : T

type InsertWithoutProps = (params: {
  Component: (props: EmptyObject) => ReactNode
  mapProps?: never
  order?: number | undefined
}) => void

type InsertWithProps<T> = {
  <R extends Insertable>(params: {
    Component: (props: NormalizedProps<R>) => ReactNode
    mapProps: (slotProps: NormalizedProps<T>) => R
    order?: number | undefined
  }): void

  (params: {
    Component: (props: EmptyObject) => ReactNode
    mapProps?: undefined
    order?: number | undefined
  }): void
}

type Payload<T> = [NormalizedProps<T>] extends [EmptyObject] ? InsertWithoutProps : InsertWithProps<T>

export type { EmptyObject, Insertable, NormalizedProps, Payload }
