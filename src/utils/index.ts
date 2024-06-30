export * from './client';
export * from './property';
export const isFulfilled = <T>(result: PromiseSettledResult<T>) => result.status === 'fulfilled';
