import type { Event, EventPayload } from 'effector';
import type { EmptyObject } from './helpers';

type ExtractWhenPayload<T> = T extends Event<infer P> ? P : T extends Event<any>[] ? EventPayload<T[number]> : never;

type Payload<T> = <R extends T, W extends Event<any> | Event<any>[] | undefined = undefined>(params: {
  component: (props: unknown extends R ? EmptyObject : R extends void ? EmptyObject : R) => React.JSX.Element;
  mapProps?: W extends undefined ? (arg: T) => R : (arg: T, whenPayload: ExtractWhenPayload<NonNullable<W>>) => R;
  order?: number;
  when?: W;
}) => void;

export type { Payload };
