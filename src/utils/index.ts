import { CACHE_PREFIX, NODE_TYPE } from '~/constants';
import { CacheType } from '~/types';

export * from './block';
export * from './property';

export const isFulfilled = <T>(
  result: PromiseSettledResult<T>,
): result is PromiseFulfilledResult<T> => result.status === 'fulfilled';

export const getPromiseValue = <T>({ value }: PromiseFulfilledResult<T>): T => value;

export const wait = (millisecond: number) =>
  new Promise((resolve) => setTimeout(resolve, millisecond));

export const getCacheKey = (type: CacheType, id: string) =>
  `${NODE_TYPE.toUpperCase()}_${CACHE_PREFIX[type]}_${id}`;
