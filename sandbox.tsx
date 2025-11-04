import { createEvent, sample } from 'effector';
import { createSlotIdentifier, createSlots } from './src';

const { slotsApi } = createSlots({
  ConfirmScreenBottom: createSlotIdentifier<{ id: number }>(),
} as const);

const evt = createEvent<{ id: number }>();

sample({
  clock: evt,
  target: slotsApi.insert.into.ConfirmScreenBottom,
});

// slotsApi.on(evt).insert.into.ConfirmScreenBottom
