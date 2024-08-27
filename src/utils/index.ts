export * from './block';
export * from './property';

const isFulfilled = <T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> =>
  result.status === 'fulfilled';

const getPromiseValue = <T>({ value }: PromiseFulfilledResult<T>): T => value;

const arrayToMatrix = <T>(list: T[], len: number): T[][] =>
  len > 1
    ? new Array(Math.ceil(list.length / len))
        .fill(null)
        .map((_, i) => list.slice(i * len, (i + 1) * len))
    : [list];

export const mapAwaited = async <T, U>(
  list: T[],
  mapper: (item: T, index?: number, list?: T[]) => Promise<U>,
  chunkSize: number = list.length,
): Promise<U[]> => {
  const matrix = arrayToMatrix(list, chunkSize).map((chunk) =>
    Promise.allSettled(chunk.map(mapper)).then((list) =>
      list.filter(isFulfilled).map(getPromiseValue),
    ),
  );

  const result: U[] = [];
  for (const list of matrix) result.push(...(await list));
  return result;
};

export const wait = (millisecond: number) =>
  new Promise((resolve) => setTimeout(resolve, millisecond));
