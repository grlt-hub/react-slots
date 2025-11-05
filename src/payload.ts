import type { Event, EventPayload } from 'effector';
import type { EmptyObject } from './helpers';

type ExtractWhenPayload<T> = T extends Event<infer P> ? P : T extends Event<any>[] ? EventPayload<T[number]> : never;

type Payload<T> = {
  // When mapProps is provided with when
  <R, W extends Event<any> | Event<any>[]>(params: {
    Component: (props: unknown extends R ? EmptyObject : R extends void ? EmptyObject : R) => React.JSX.Element;
    mapProps: (arg: T, whenPayload: ExtractWhenPayload<W>) => R;
    order?: number;
    when: W;
  }): void;

  // When mapProps is provided without when
  <R>(params: {
    Component: (props: unknown extends R ? EmptyObject : R extends void ? EmptyObject : R) => React.JSX.Element;
    mapProps: (arg: T) => R;
    order?: number;
    when?: undefined;
  }): void;

  // When mapProps is not provided
  (params: {
    Component: (props: unknown extends T ? EmptyObject : T extends void ? EmptyObject : T) => React.JSX.Element;
    mapProps?: undefined;
    order?: number;
    when?: undefined;
  }): void;
};

export type { Payload };
