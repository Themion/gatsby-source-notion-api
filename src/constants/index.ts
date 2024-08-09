import { CacheType } from '~/types';

const NODE_TYPE = 'Notion';
const CACHE_PREFIX: Record<CacheType, string> = {
  block: 'BLOCK',
};
export { CACHE_PREFIX, NODE_TYPE };
