import React, { memo, useMemo } from 'react';

const isNil = <T,>(x: T | undefined | null): x is undefined | null => x === null || x === undefined;

const insertSorted = <T extends { order?: number }>(list: T[], element: T) => {
  const elementOrder = element.order ?? 0;
  const insertIndex = list.findIndex((existing) => (existing.order ?? 0) > elementOrder);

  return list.toSpliced(insertIndex === -1 ? list.length : insertIndex, 0, element);
};

type EmptyObject = Record<string, never>;
type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

// @ts-expect-error its ok
const makeChildWithProps = (child) =>
  // @ts-expect-error its ok
  memo<any>((props) => {
    const childProps = useMemo(() => child.fn(props), [props]);

    return <child.component {...childProps} />;
  });

export { insertSorted, isNil, makeChildWithProps, type EmptyObject, type Entries };
