import { createGate } from 'effector-react';
import React from 'react';
import { createSlotIdentifier, createSlots } from './src';

const { slotsApi } = createSlots({
  ConfirmScreenBottom: createSlotIdentifier<{ id: number }>(),
} as const);

const appGate = createGate<number>();

slotsApi.ConfirmScreenBottom.insert({
  when: [appGate.open],
  mapProps: (__, y) => ({ id: Number(y) }),
  Component: (props) => <p>Hello world! {props.id}</p>,
});

slotsApi.ConfirmScreenBottom.insert({
  mapProps: (x) => x,
  Component: (props) => <p>Hello world! {props.id}</p>,
});
