import { CacheType } from '../types';

const NODE_TYPE = 'NOTION';
const CACHE_PREFIX: Record<CacheType, string> = {
  page: 'PAGE',
};
export { CACHE_PREFIX, NODE_TYPE };
