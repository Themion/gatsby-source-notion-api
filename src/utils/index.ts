export * from './block';
export * from './property';
export const isFulfilled = <T>(result: PromiseSettledResult<T>) => result.status === 'fulfilled';
