export * from './block';
export * from './property';
export const isFulfilled = <T>(
  result: PromiseSettledResult<T>,
): result is PromiseFulfilledResult<T> => result.status === 'fulfilled';
export const wait = (millisecond: number) =>
  new Promise((resolve) => setTimeout(resolve, millisecond));
