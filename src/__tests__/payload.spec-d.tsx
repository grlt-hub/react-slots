import React from 'react';
import { expectTypeOf } from 'vitest';
import { createSlotIdentifier, createSlots, type EmptyObject } from '../init';

const slotId = createSlotIdentifier<{ text: string }>();
const noPropsSlot = createSlotIdentifier<void>();

const { slotsApi } = createSlots({
  Top: slotId,
  Bottom: noPropsSlot,
});

slotsApi.insert.into.Top({
  fn: (data) => ({ text: data.text }),
  component: (props) => {
    expectTypeOf<{ text: string }>(props);
    return <div />;
  },
});

slotsApi.insert.into.Top({
  component: (props) => {
    expectTypeOf<EmptyObject>(props);
    return <div />;
  },
});

slotsApi.insert.into.Top({
  fn: () => {},
  component: (props) => {
    expectTypeOf<EmptyObject>(props);
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
  fn: (data) => ({ text: data.text }),
  // @ts-expect-error
  component: (_: { wrong: number }) => <div />,
});
