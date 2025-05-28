import React from 'react';
import { expectTypeOf } from 'vitest';
import { type Payload } from '../init';

type EmptyObject = Record<string, never>;

declare const payload: Payload<{ name: string }>;

payload({
  fn: (data) => ({ label: data.name }),
  component: (props) => {
    expectTypeOf<{ label: string }>(props);
    return <div />;
  },
});

payload({
  component: (props) => {
    expectTypeOf<EmptyObject>(props);
    return <div />;
  },
});

payload({
  fn: () => {},
  component: (props) => {
    expectTypeOf<EmptyObject>(props);
    return <div />;
  },
});

payload({
  fn: (data) => ({ label: data.name }),
  // @ts-expect-error expected { label: string } but got { wrong: number }
  component: (_: { wrong: number }) => <div />,
});
