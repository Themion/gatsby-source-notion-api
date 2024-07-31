import { GatsbyCache, Reporter } from 'gatsby';
import { CACHE_PREFIX, NODE_TYPE } from '~/constants';
import { CacheType, Cached, Page } from '~/types';

const getCacheKey = (type: CacheType, id: string) =>
  `${NODE_TYPE.toUpperCase()}_${CACHE_PREFIX[type]}_${id}`;

class CacheWrapper {
  constructor(private readonly reporter: Reporter, private readonly cache: GatsbyCache) {}

  private async setToCache<T>(type: CacheType, id: string, payload: T) {
    const cachedDate = new Date();
    cachedDate.setMilliseconds(0);
    cachedDate.setSeconds(0);
    const cachedValue: Cached<T> = { payload, cachedTime: cachedDate.getTime() };
    return (await this.cache.set(getCacheKey(type, id), cachedValue)) as Cached<T>;
  }

  private async getFromCache<T>(type: CacheType, id: string): Promise<Cached<T> | null> {
    return ((await this.cache.get(getCacheKey(type, id))) as Cached<T> | undefined) ?? null;
  }

  async getPageFromCache(pageId: string, lastEditedTime: Date) {
    const pageFromCache = await this.getFromCache<Page>('page', pageId);

    if (pageFromCache === null) {
      this.reporter.info(`Cache failed for page ${pageId}!`);
      return null;
    } else if (pageFromCache.cachedTime <= lastEditedTime.getTime()) {
      this.reporter.info(`Page ${pageId} is updated: refetching page...`);
      return null;
    } else {
      return pageFromCache.payload;
    }
  }

  async setPageToCache(page: Page) {
    return this.setToCache('page', page.id, page);
  }
}

export default CacheWrapper;
