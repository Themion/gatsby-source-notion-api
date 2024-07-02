export * from './block';
export * from './property';
export const isFulfilled = <T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> => result.status === 'fulfilled';
