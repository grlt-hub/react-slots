import { createEvent } from 'effector';
import { createGate } from 'effector-react';
import React from 'react';
import { createSlotIdentifier, createSlots } from './src';

const { slotsApi } = createSlots({
  ConfirmScreenBottom: createSlotIdentifier<{ id: number }>(),
} as const);

const appGate = createGate<number>();

slotsApi.insert.into.ConfirmScreenBottom({
  when: [appGate.open],
  fn: (__, y) => ({ id: Number(y) }),
  component: (props) => <p>Hello world! {props.id}</p>,
});

slotsApi.insert.into.ConfirmScreenBottom({
  fn: (x) => x,
  component: (props) => <p>Hello world! {props.id}</p>,
});
