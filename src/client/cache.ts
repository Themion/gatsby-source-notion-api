import { GatsbyCache, Reporter } from 'gatsby';
import { CACHE_PREFIX, NODE_TYPE } from '~/constants';
import { Block, CacheOptions, CachePayloadType, CacheType, Cached, Page } from '~/types';

const getCacheKey = (type: CacheType, id: string) =>
  `${NODE_TYPE.toUpperCase()}_${CACHE_PREFIX[type]}_${id}`;

class CacheWrapper {
  constructor(
    private readonly reporter: Reporter,
    private readonly cache: GatsbyCache,
    cacheOptions: CacheOptions = { enabled: true },
    private readonly maxAge: number | null = (cacheOptions.enabled && cacheOptions.maxAge) || null,
  ) {}

  private async setToCache<T extends CacheType>(type: T, id: string, payload: CachePayloadType[T]) {
    const cachedDate = new Date();
    cachedDate.setMilliseconds(0);
    cachedDate.setSeconds(0);
    const cachedTime = cachedDate.getTime();
    const expiresAt: number | null = this.maxAge ? cachedTime + this.maxAge : null;
    const cachedValue: Cached<T> = { payload, cachedTime: cachedTime, expiresAt };
    return (await this.cache.set(getCacheKey(type, id), cachedValue)) as Cached<T>;
  }

  private async getFromCache<T extends CacheType>(
    type: T,
    id: string,
    lastEditedTime: Date,
  ): Promise<CachePayloadType[T] | null> {
    const cachedValue = (await this.cache.get(getCacheKey(type, id))) as Cached<T> | undefined;

    const isCacheEmpty = cachedValue === undefined;
    const isCacheInvalidated = (cachedValue?.cachedTime ?? -1) <= lastEditedTime.getTime();
    const isCacheAlive =
      new Date().getTime() <= (cachedValue?.expiresAt ?? new Date().getTime() + 1);

    if (isCacheEmpty) {
      this.reporter.info(`cache failed for ${type} ${id}!`);
      return null;
    } else if (isCacheInvalidated) {
      this.reporter.info(`${type} ${id} is updated: refetching ${type}...`);
      return null;
    } else if (!isCacheAlive) {
      this.reporter.info(`cache of ${type} ${id} is outdated: refetching ${type}...`);
      return null;
    } else return cachedValue.payload;
  }

  async getPageFromCache(pageId: string, lastEditedTime: Date) {
    return await this.getFromCache('page', pageId, lastEditedTime);
  }

  async setPageToCache(page: Page) {
    return await this.setToCache('page', page.id, page);
  }

  async getBlocksFromCache(blockId: string, lastEditedTime: Date) {
    return await this.getFromCache('block', blockId, lastEditedTime);
  }

  async setBlocksToCache(id: string, blocks: Block[]) {
    return await this.setToCache('block', id, blocks);
  }
}

export default CacheWrapper;
