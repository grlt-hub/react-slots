import { createEvent, createStore, type EventCallable } from 'effector';
import { useStoreMap } from 'effector-react';
import { nanoid } from 'nanoid';
import React, { memo, type FunctionComponent } from 'react';
import { insertSorted, isNil, makeChildWithProps, type Entries } from './helpers';
import type { Payload } from './payload';

type CreateSlotIdentifier = <T>() => (_: T) => T;

const createSlotIdentifier: CreateSlotIdentifier = () => (props) => props;

type SlotFunction<T> = (_: T) => T;

const createSlots = <T extends Record<string, SlotFunction<any>>>(config: T) => {
  const entries = Object.entries(config) as Entries<typeof config>;
  const keys = entries.map(([k]) => k);

  type SetApi = {
    [key in keyof T]: T[key] extends (_: any) => unknown ? Payload<Parameters<T[key]>[0]> : never;
  };

  type ClearApi = {
    [key in keyof T]: EventCallable<void>;
  };

  type SlotApi = {
    [key in keyof T]: {
      insert: SetApi[key];
      clear: ClearApi[key];
    };
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
    const insert = createEvent<Parameters<Payload<ExtractData<typeof key>>>[0]>();

    const unwatch = insert.watch((payload) => {
      if (isNil(payload.when)) {
        unwatch();

        return;
      }

      const triggers = Array.isArray(payload.when) ? payload.when : [payload.when];

      triggers.forEach((trigger) => {
        // @ts-expect-error
        trigger.watch((triggerPayload) => {
          const { when, mapProps, ...data } = payload;

          // @ts-expect-error
          const wrappedFn = mapProps ? (props: any) => mapProps(props, triggerPayload) : undefined;

          // @ts-expect-error
          insert({ ...data, mapProps: wrappedFn });
        });
      });

      unwatch();
    });

    const immediateInsert = insert.filter({ fn: (x) => isNil(x.when) });

    $slots.on(immediateInsert, (state, payload) => {
      const item = { ...payload, id: nanoid(10) };
      const list = insertSorted(state[key], item);

      return { ...state, [key]: list };
    });

    // @ts-expect-error its ok. avoid extra fn creation
    acc[key] = insert;

    return acc;
  }, {} as SetApi);

  const clearApi = keys.reduce((acc, key) => {
    const clear = createEvent();

    $slots.on(clear, (state) => {
      if (state[key].length === 0) return state;
      return { ...state, [key]: [] };
    });

    acc[key] = clear;

    return acc;
  }, {} as ClearApi);

  const slots = keys.reduce((acc, key) => {
    const component = memo<ExtractData<typeof key>>((props) => {
      const slotChildren = useStoreMap($slots, (x) => x[key]);

      return slotChildren.map((child) => {
        if (isNil(child.mapProps)) {
          return (
            <React.Fragment key={child.id}>
              <child.Component />
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

  const slotsApi = keys.reduce((acc, key) => {
    acc[key] = {
      insert: insertApi[key],
      clear: clearApi[key],
    };
    return acc;
  }, {} as SlotApi);

  return { slotsApi, Slots: slots };
};

export { createSlotIdentifier, createSlots };
