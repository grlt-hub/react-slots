import { createEvent } from 'effector';
import React from 'react';
import { expectTypeOf } from 'vitest';
import { EmptyObject } from '../helpers';
import { createSlotIdentifier, createSlots } from '../index';

const slotWithProps = createSlotIdentifier<{ text: string }>();
const noPropsSlot = createSlotIdentifier<void>();
const signal = createEvent<number>();

const { slotsApi } = createSlots({
  Top: slotWithProps,
  Bottom: noPropsSlot,
});

slotsApi.insert.into.Top({
  mapProps: (data) => ({ text: data.text }),
  component: (props) => {
    expectTypeOf<{ text: string }>(props);
    return <div />;
  },
});

slotsApi.insert.into.Top({
  when: signal,
  mapProps: (__, signalPayload) => ({ text: String(signalPayload) }),
  component: (props) => {
    expectTypeOf<{ text: string }>(props);
    return <div />;
  },
});

slotsApi.insert.into.Top({
  when: [signal],
  mapProps: (__, signalPayload) => ({ text: String(signalPayload) }),
  component: (props) => {
    expectTypeOf<{ text: string }>(props);
    return <div />;
  },
});

slotsApi.insert.into.Top({
  when: [signal, createEvent<string[]>()],
  mapProps: (__, signalPayload) => {
    const text = Array.isArray(signalPayload) ? signalPayload[0] : String(signalPayload);

    return { text };
  },
  component: (props) => {
    expectTypeOf<{ text: string }>(props);
    return <div />;
  },
});

slotsApi.insert.into.Top({
  component: (props) => {
    expectTypeOf<{ text: string }>(props);
    return <div />;
  },
});

slotsApi.insert.into.Bottom({
  component: (props) => {
    expectTypeOf<EmptyObject>(props);
    return <div />;
  },
});

slotsApi.insert.into.Top({
  mapProps: (data) => ({ text: data.text }),
  // @ts-expect-error
  component: (_: { wrong: number }) => <div />,
});

slotsApi.insert.into.Top({
  // @ts-expect-error
  mapProps: () => {},
  component: () => <div />,
});

slotsApi.insert.into.Top({
  when: signal,
  // @ts-expect-error
  mapProps: (__, signalPayload) => ({ text: signalPayload }),
  component: () => <div />,
});
