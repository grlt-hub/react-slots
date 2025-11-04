import type { EventCallable, EventPayload } from 'effector';
import type { EmptyObject } from './helpers';

type ExtractWhenPayload<T> =
  T extends EventCallable<infer P> ? P : T extends EventCallable<any>[] ? EventPayload<T[number]> : never;

type Payload<T> = <R, W extends EventCallable<any> | EventCallable<any>[] | undefined = undefined>(params: {
  component: (props: unknown extends R ? EmptyObject : R extends void ? EmptyObject : R) => React.JSX.Element;
  fn?: W extends undefined ? (arg: T) => R : (arg: T, whenPayload: ExtractWhenPayload<NonNullable<W>>) => R;
  order?: number;
  when?: W;
}) => void;

export type { Payload };
