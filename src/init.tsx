import { createEvent, createStore } from 'effector';
import { useStoreMap } from 'effector-react';
import { nanoid } from 'nanoid';
import React, { type FunctionComponent, memo, useMemo } from 'react';

type EmptyObject = Record<string, never>;
type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

const isNil = <T,>(x: T | undefined | null): x is undefined | null => x === null || x === undefined;

const insertAtPosition = <T,>(list: T[], position: number, element: T) => {
  const newList = [...list];

  if (position <= 0) {
    newList.unshift(element);
  } else if (position >= list.length) {
    newList.push(element);
  } else {
    newList.splice(position, 0, element);
  }

  return newList;
};

type CreateSlotIdentifier = <T>() => (_: T) => T;

const createSlotIdentifier: CreateSlotIdentifier = () => (props) => props;

type SlotFunction<T> = (_: T) => T;

type Payload<T> = <R>(params: {
  component: (props: unknown extends R ? EmptyObject : R extends void ? EmptyObject : R) => JSX.Element;
  fn?: (arg: T) => R;
  order?: number;
}) => void;

const createSlots = <T extends Record<string, SlotFunction<any>>>(config: T) => {
  const entries = Object.entries(config) as Entries<typeof config>;
  const keys = entries.map(([k]) => k);

  type SetApi = {
    [key in keyof T]: T[key] extends (_: any) => unknown ? Payload<Parameters<T[key]>[0]> : never;
  };

  type State = {
    [key in keyof T]: (Parameters<SetApi[key]>[0] & { id: string })[];
  };

  type Slots = {
    [key in keyof T]: FunctionComponent<Parameters<T[key]>[0]>;
  };

  type ExtractData<P extends keyof T> = Parameters<T[P]>[0];

  const $slots = createStore<State>(
    keys.reduce((acc, x) => {
      acc[x] = [];

      return acc;
    }, {} as State),
  );

  const insertApi = keys.reduce((acc, key) => {
    const evt = createEvent<Parameters<Payload<ExtractData<typeof key>>>[0]>();

    $slots.on(evt, (state, payload) => {
      const item = { ...payload, id: nanoid(10) };
      const list = insertAtPosition(state[key], payload.order ?? state[key].length + 1, item);
      const sortedList = list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      return { ...state, [key]: sortedList };
    });

    // @ts-expect-error its ok. avoid extra fn creation
    acc[key] = evt;

    return acc;
  }, {} as SetApi);

  // @ts-expect-error its ok
  const makeChildWithProps = (child) =>
    // @ts-expect-error its ok
    memo<any>((props) => {
      const childProps = useMemo(() => child.fn(props), [props]);

      return (
        <React.Fragment key={child.id}>
          <child.component {...childProps} />
        </React.Fragment>
      );
    });

  const slots = keys.reduce((acc, key) => {
    const component = memo<ExtractData<typeof key>>((props) => {
      const childrens = useStoreMap($slots, (x) => x[key]);

      return childrens.map((child) => {
        if (isNil(child.fn)) {
          return (
            <React.Fragment key={child.id}>
              <child.component />
            </React.Fragment>
          );
        }

        const ChildWithProps = makeChildWithProps(child);

        return (
          <React.Fragment key={child.id}>
            <ChildWithProps {...props} />
          </React.Fragment>
        );
      });
    });

    acc[key] = component;

    return acc;
  }, {} as Slots);

  const slotsApi = {
    insert: { into: insertApi },
  };

  return { slotsApi, Slots: slots };
};

export { createSlotIdentifier, createSlots, type EmptyObject, type Payload };
