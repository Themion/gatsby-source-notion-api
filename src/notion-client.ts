import { APIErrorCode, Client, isNotionClientError } from '@notionhq/client';
import {
  DatabaseObjectResponse,
  GetDatabaseResponse,
  PageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { GatsbyCache, NodePluginArgs, Reporter } from 'gatsby';
import { CACHE_PREFIX, NODE_TYPE } from './constants';
import { Block, Cached, CacheType, NotionAPIPage, Page } from './types';
import {
  getPromiseValue,
  isFulfilled,
  isPageAccessible,
  isPropertyAccessible,
  isPropertySupported,
  wait,
} from './utils';

type ClientConfig = {
  token: string;
  notionVersion: string;
  useCacheForDatabase: boolean;
} & NodePluginArgs;

type UpdatePageOption = {
  pageId: string;
  key: string;
  value: string;
  url?: string;
};

type FetchNotionData<T> = (
  cursor: string | null,
) => Promise<{ nextCursor: string | null; data: T[] }>;

const isPageObject = (item: PageObjectResponse | DatabaseObjectResponse): item is NotionAPIPage =>
  item.object === 'page';

const isDatabaseObject = (
  databaseStat: GetDatabaseResponse,
): databaseStat is DatabaseObjectResponse => Object.keys(databaseStat).includes('last_edited_time');

const getCacheKey = (type: CacheType, id: string) => `${NODE_TYPE}_${CACHE_PREFIX[type]}_${id}`;

class NotionClient {
  private readonly client: Client;
  private readonly reporter: Reporter;
  private readonly cache: GatsbyCache;
  private readonly useCacheForDatabase: boolean;

  constructor({ token, notionVersion, useCacheForDatabase, reporter, cache }: ClientConfig) {
    this.client = new Client({ auth: token, notionVersion });
    this.reporter = reporter;
    this.cache = cache;
    this.useCacheForDatabase = useCacheForDatabase;
  }

  async waitAndLogWithNotionError(error: unknown) {
    if (!isNotionClientError(error)) {
      this.reporter.error('Unknwon Error has thrown!');
      throw error;
    }

    switch (error.name) {
      case 'APIResponseError':
        switch (error.code) {
          case APIErrorCode.RateLimited:
            const retryAfter = parseInt((error.headers as Headers).get('retry-after') ?? '60', 10);
            this.reporter.warn(
              `API Rate Limit reached! retrying after ${Math.floor(retryAfter)} seconds...`,
            );
            await wait(retryAfter * 1000);
            return;
          case APIErrorCode.InternalServerError:
          case APIErrorCode.ServiceUnavailable:
            this.reporter.warn('Server-side error is thrown! retrying after 30 seconds...');
            await wait(1000 * 30);
            return;
          default:
            this.reporter.error(error);
        }
        break;
      case 'RequestTimeoutError':
        this.reporter.warn('Request Timeout error is thrown! retrying after 30 seconds...');
        await wait(1000 * 30);
        return;
      case 'UnknownHTTPResponseError':
        this.reporter.error(error);
        break;
    }
    throw error;
  }

  private async fetchAll<T>(fetch: FetchNotionData<T>) {
    const dataList: T[] = [];
    let cursor: string | null = null;

    try {
      do {
        const { nextCursor, data } = await fetch(cursor);
        dataList.push(...data);
        cursor = nextCursor;
      } while (cursor != null);
    } catch (error) {
      await this.waitAndLogWithNotionError(error);
    }

    return dataList;
  }

  private async setToCache<T>(type: CacheType, id: string, payload: T) {
    const cachedValue: Cached<T> = { payload, cachedTime: new Date().getTime() };
    return (await this.cache.set(getCacheKey(type, id), cachedValue)) as Cached<T>;
  }

  private async getFromCache<T>(type: CacheType, id: string): Promise<Cached<T> | null> {
    return ((await this.cache.get(getCacheKey(type, id))) as Cached<T> | undefined) ?? null;
  }

  private async getPageFromCache(pageId: string, lastEditedTime: Date) {
    const pageFromCache = await this.getFromCache<Page>('page', pageId);

    if (pageFromCache === null) {
      this.reporter.info(`Cache failed for page ${pageId}!`);
      return null;
    } else if (new Date(pageFromCache.cachedTime).getTime() < lastEditedTime.getTime()) {
      this.reporter.info(`Page ${pageId} is updated: refetching page...`);
      return null;
    } else {
      return pageFromCache.payload;
    }
  }

  private async setPageToCache(page: Page) {
    return this.setToCache('page', page.id, page);
  }

  private async getPagesFromCache(databaseId: string): Promise<Page[] | null> {
    const pageIdsFromCache = await this.getFromCache<string[]>('database', databaseId);
    const databaseStat = await this.client.databases.retrieve({ database_id: databaseId });

    if (!isDatabaseObject(databaseStat)) {
      this.reporter.warn(`Failed to fetch info of database ${databaseId}!`);
      return null;
    }
    const lastEditedTime = new Date(databaseStat.last_edited_time);

    if (pageIdsFromCache === null) {
      this.reporter.info(`Cache failed for database ${databaseId}!`);
      return null;
    }
    if (new Date(pageIdsFromCache.cachedTime).getTime() < lastEditedTime.getTime()) {
      this.reporter.info(`Database ${databaseId} is updated: refetching database...`);
      return null;
    }

    return Promise.all(
      pageIdsFromCache.payload.map((pageId) => this.getPageFromCache(pageId, lastEditedTime)),
    )
      .then((list) => list.filter((item) => item !== null))
      .catch(() => {
        this.reporter.info(
          `Cache failed for page in database ${databaseId}: refetching database...`,
        );
        return null;
      });
  }

  private async setPagesToCache(databaseId: string, pages: Page[]) {
    const pageIds = pages.map(({ id }) => id);
    return this.setToCache('database', databaseId, pageIds);
  }

  private getBlock(id: string): FetchNotionData<Block> {
    const fetch = async (cursor: string | null) => {
      const { results, next_cursor } = await this.client.blocks.children.list({
        block_id: id,
        start_cursor: cursor ?? undefined,
      });

      const blocks = await Promise.allSettled(
        results
          .filter(isPropertyAccessible)
          .filter(isPropertySupported)
          .map(
            async (block): Promise<Block> => ({
              ...block,
              ...(block.has_children
                ? { has_children: true, children: await this.getBlocks(block.id) }
                : { has_children: false }),
            }),
          ),
      );

      return {
        data: blocks.filter(isFulfilled).map(getPromiseValue),
        nextCursor: next_cursor,
      };
    };

    return fetch.bind(this);
  }

  async getBlocks(id: string) {
    return this.fetchAll(this.getBlock(id));
  }

  private async getPageContent(result: PageObjectResponse): Promise<Page> {
    const lastEditedTime = new Date(result.last_edited_time);
    const pageFromCache = await this.getPageFromCache(result.id, lastEditedTime);
    if (pageFromCache !== null) return pageFromCache;

    const pageFromNotion: Page = { ...result, children: await this.getBlocks(result.id) };
    this.setPageToCache(pageFromNotion);
    return pageFromNotion;
  }

  private getPagesFromNotion(id: string): FetchNotionData<Page> {
    const fetch = async (cursor: string | null) => {
      const { results, next_cursor } = await this.client.databases.query({
        database_id: id,
        start_cursor: cursor ?? undefined,
      });

      const fetchedPages: PromiseSettledResult<Page>[] = await Promise.allSettled(
        results
          .filter(isPageAccessible)
          .filter(isPageObject)
          .map((result) => this.getPageContent(result)),
      );

      return {
        data: fetchedPages.filter(isFulfilled).map(getPromiseValue),
        nextCursor: next_cursor,
      };
    };

    return fetch.bind(this);
  }

  async getPages(databaseId: string) {
    if (this.useCacheForDatabase) {
      const pagesFromCache = await this.getPagesFromCache(databaseId);
      if (pagesFromCache !== null) return pagesFromCache;
    }
    const pages = await this.fetchAll(this.getPagesFromNotion(databaseId));
    if (this.useCacheForDatabase) {
      this.setPagesToCache(databaseId, pages);
    }
    return pages;
  }

  async updatePageSlug({ pageId, key, value, url }: UpdatePageOption) {
    const link = url ? { url } : null;
    try {
      const result = await this.client.pages.update({
        page_id: pageId,
        properties: {
          [key]: {
            type: 'rich_text',
            rich_text: [
              {
                type: 'text',
                text: { content: value, link },
                annotations: {
                  bold: false,
                  italic: false,
                  strikethrough: false,
                  underline: false,
                  code: false,
                  color: 'default',
                },
              },
            ],
          },
        },
      });

      return isPageAccessible(result) ? result.properties[key] : null;
    } catch {
      return null;
    }
  }
}

export default NotionClient;
