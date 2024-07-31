export * from './block';
export * from './property';

export const isFulfilled = <T>(
  result: PromiseSettledResult<T>,
): result is PromiseFulfilledResult<T> => result.status === 'fulfilled';

export const getPromiseValue = <T>({ value }: PromiseFulfilledResult<T>): T => value;

export const wait = (millisecond: number) =>
  new Promise((resolve) => setTimeout(resolve, millisecond));
