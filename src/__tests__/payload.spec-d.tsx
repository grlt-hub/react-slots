import { createEffect, createEvent, createStore, UnitValue } from 'effector';
import React from 'react';
import { expectTypeOf } from 'vitest';
import { EmptyObject } from '../helpers';
import { createSlotIdentifier, createSlots } from '../index';
import { ExtractWhenPayload } from '../payload';

const slotWithProps = createSlotIdentifier<{ text: string }>();
const noPropsSlot = createSlotIdentifier<void>();
const triggerEvent = createEvent<number>();

const { slotsApi } = createSlots({
  Top: slotWithProps,
  Bottom: noPropsSlot,
});

slotsApi.Top.insert({
  mapProps: (data) => ({ text: data.text }),
  Component: (props) => {
    expectTypeOf<{ text: string }>(props);
    return <div />;
  },
});

slotsApi.Top.insert({
  when: triggerEvent,
  mapProps: (__, signalPayload) => ({ text: String(signalPayload) }),
  Component: (props) => {
    expectTypeOf<{ text: string }>(props);
    return <div />;
  },
});

slotsApi.Top.insert({
  when: [triggerEvent],
  mapProps: (__, signalPayload) => ({ text: String(signalPayload) }),
  Component: (props) => {
    expectTypeOf<{ text: string }>(props);
    return <div />;
  },
});

slotsApi.Top.insert({
  when: [triggerEvent, createEvent<string[]>()],
  mapProps: (__, signalPayload) => {
    const text = Array.isArray(signalPayload) ? signalPayload[0] : String(signalPayload);

    return { text };
  },
  Component: (props) => {
    expectTypeOf<{ text: string }>(props);
    return <div />;
  },
});

slotsApi.Top.insert({
  Component: (props) => {
    expectTypeOf<{ text: string }>(props);
    return <div />;
  },
});

slotsApi.Bottom.insert({
  Component: (props) => {
    expectTypeOf<EmptyObject>(props);
    return <div />;
  },
});

slotsApi.Top.insert({
  mapProps: () => {},
  Component: () => <div />,
});

slotsApi.Top.insert({
  when: triggerEvent,
  mapProps: (slotPayload, signalPayload) => ({ data: { signalPayload, slotPayload } }),
  Component: (props) => {
    expectTypeOf<{
      data: { slotPayload: { text: string }; signalPayload: number };
    }>(props);
    return <div />;
  },
});

slotsApi.Top.insert({
  when: [createEvent<number>(), createStore<string>(''), createEffect((x: string[]) => x)],
  mapProps: (__, signalPayload) => {
    return null;
  },
  Component: () => '',
});

slotsApi.Top.insert({
  when: [createEvent<number>(), createStore<string>(''), createEffect((x: null) => x)],
  mapProps: (__, signalPayload) => {
    return null;
  },
  Component: () => '',
});

slotsApi.Top.insert({
  when: [createEvent<number>(), createEffect((x: string) => x)],
  mapProps: (__, signalPayload) => {
    return '';
  },
  Component: () => '',
});

slotsApi.Top.insert({
  mapProps: (data) => ({ text: data.text }),
  // @ts-expect-error
  Component: (_: { wrong: number }) => <div />,
});


const $a =  createEffect((x: string) => x)
const list = [$a]
type N = ExtractWhenPayload<typeof list>
