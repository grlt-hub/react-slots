import type { Unit, UnitValue } from 'effector';
import type { ReactNode } from 'react';
import type { EmptyObject } from './helpers';

type ExtractWhenPayload<T> = T extends Unit<infer P> ? P : T extends Unit<any>[] ? UnitValue<T[number]> : never;

type Payload<T> = {
  // When mapProps is provided with when
  <R, W extends Unit<any> | Unit<any>[]>(params: {
    Component: (props: unknown extends R ? EmptyObject : R extends void ? EmptyObject : R) => ReactNode;
    mapProps: (slotProps: T, whenPayload: ExtractWhenPayload<W>) => R;
    order?: number;
    when: W;
  }): void;

  // When mapProps is provided without when
  <R>(params: {
    Component: (props: unknown extends R ? EmptyObject : R extends void ? EmptyObject : R) => ReactNode;
    mapProps: (slotProps: T) => R;
    order?: number;
    when?: undefined;
  }): void;

  // When mapProps is not provided
  (params: {
    Component: (props: unknown extends T ? EmptyObject : T extends void ? EmptyObject : T) => ReactNode;
    mapProps?: undefined;
    order?: number;
    when?: undefined;
  }): void;
};

export type { ExtractWhenPayload, Payload };
