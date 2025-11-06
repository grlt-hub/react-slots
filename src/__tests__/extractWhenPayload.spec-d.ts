import { createEffect, createEvent, createStore } from 'effector';
import { expectTypeOf } from 'vitest';
import { ExtractWhenPayload } from '../payload';

const event = createEvent<string>();
const $store = createStore<number>(0);
const effectFx = createEffect<boolean, void>();
const effectWithArrayFx = createEffect<string[], void>();

// --- Single Units ---

expectTypeOf<ExtractWhenPayload<typeof event>>().toEqualTypeOf<string>();
expectTypeOf<ExtractWhenPayload<typeof $store>>().toEqualTypeOf<number>();
expectTypeOf<ExtractWhenPayload<typeof effectFx>>().toEqualTypeOf<boolean>();
expectTypeOf<ExtractWhenPayload<typeof effectWithArrayFx>>().toEqualTypeOf<string[]>();

// --- Array of Units ---

// Single type array
expectTypeOf<ExtractWhenPayload<[typeof event]>>().toEqualTypeOf<string>();
expectTypeOf<ExtractWhenPayload<[typeof $store]>>().toEqualTypeOf<number>();
expectTypeOf<ExtractWhenPayload<[typeof effectFx]>>().toEqualTypeOf<boolean>();
expectTypeOf<ExtractWhenPayload<[typeof effectWithArrayFx]>>().toEqualTypeOf<string[]>();

// Mixed array
expectTypeOf<
  ExtractWhenPayload<[typeof event, typeof $store, typeof effectFx, typeof effectWithArrayFx]>
>().toEqualTypeOf<string | number | boolean | string[]>();

// Mixed array with duplicates
expectTypeOf<ExtractWhenPayload<[typeof event, typeof event, typeof $store]>>().toEqualTypeOf<string | number>();

// --- Edge Cases ---

// Empty array should resolve to never
expectTypeOf<ExtractWhenPayload<[]>>().toBeNever();

// Non-unit types should resolve to never
expectTypeOf<ExtractWhenPayload<string>>().toBeNever();
expectTypeOf<ExtractWhenPayload<number>>().toBeNever();
expectTypeOf<ExtractWhenPayload<null>>().toBeNever();
expectTypeOf<ExtractWhenPayload<undefined>>().toBeNever();
expectTypeOf<ExtractWhenPayload<{ a: 1 }>>().toBeNever();
