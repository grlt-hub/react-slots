import type { ReactNode } from "react"

type EmptyObject = Record<string, never>

type Insertable = (object & { key?: never; ref?: never }) | void

type NormalizedProps<T> = unknown extends T ? EmptyObject : T extends void ? EmptyObject : T

type InsertWithoutProps = (params: {
  Component: (props: EmptyObject) => ReactNode
  filter?: never
  mapProps?: never
  order?: number | undefined
}) => void

type InsertWithProps<T> = {
  <S extends NormalizedProps<T>, R extends Insertable>(params: {
    filter: (slotProps: NormalizedProps<T>) => slotProps is S
    mapProps: (slotProps: S) => R
    Component: (props: NormalizedProps<R>) => ReactNode
    order?: number | undefined
  }): void

  <R extends Insertable>(params: {
    filter?: ((slotProps: NormalizedProps<T>) => boolean) | undefined
    mapProps: (slotProps: NormalizedProps<T>) => R
    Component: (props: NormalizedProps<R>) => ReactNode
    order?: number | undefined
  }): void

  (params: {
    Component: (props: EmptyObject) => ReactNode
    filter?: never
    mapProps?: undefined
    order?: number | undefined
  }): void
}

type Payload<T> = [NormalizedProps<T>] extends [EmptyObject] ? InsertWithoutProps : InsertWithProps<T>

export type { EmptyObject, Insertable, NormalizedProps, Payload }
