import { CacheType } from '~/types';

const NODE_TYPE = 'Notion';
const CACHE_PREFIX: Record<CacheType, string> = {
  database: 'DATABASE',
  page: 'PAGE',
};
export { CACHE_PREFIX, NODE_TYPE };
