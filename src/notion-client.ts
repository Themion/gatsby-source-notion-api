import { APIErrorCode, Client, isNotionClientError } from '@notionhq/client';
import {
  DatabaseObjectResponse,
  PageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { GatsbyCache, NodePluginArgs, Reporter } from 'gatsby';
import {
  Block,
  Cached,
  CacheType,
  NormalizedValue,
  NotionAPIPage,
  Options,
  Page,
  SlugOptions,
} from './types';
import {
  getCacheKey,
  getPromiseValue,
  getPropertyContent,
  isFulfilled,
  isPageAccessible,
  isPropertyAccessible,
  isPropertySupported,
  wait,
} from './utils';

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

class NotionClient {
  private readonly client: Client;
  private readonly databaseId: string;
  private readonly reporter: Reporter;
  private readonly cache: GatsbyCache;
  private readonly slugOptions: SlugOptions | null;

  constructor(
    { reporter, cache }: NodePluginArgs,
    { token, notionVersion, databaseId, slugOptions }: Options,
  ) {
    this.client = new Client({ auth: token, notionVersion });
    this.databaseId = databaseId;
    this.reporter = reporter;
    this.cache = cache;
    this.slugOptions = slugOptions ?? null;
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

  private async fetchWithErrorHandler<T>(fetch: () => T) {
    do {
      try {
        return await fetch();
      } catch (error) {
        await this.waitAndLogWithNotionError(error);
      }
    } while (true);
  }

  private async fetchAll<T>(fetch: FetchNotionData<T>) {
    const dataList: T[] = [];
    let cursor: string | null = null;

    do {
      const { nextCursor, data } = await this.fetchWithErrorHandler(() => fetch(cursor));
      dataList.push(...data);
      cursor = nextCursor;
    } while (cursor != null);

    return dataList;
  }

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

  private async getPageFromCache(pageId: string, lastEditedTime: Date) {
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

  private async setPageToCache(page: Page) {
    return this.setToCache('page', page.id, page);
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

  private getPagesFromNotion(): FetchNotionData<Page> {
    const fetch = async (cursor: string | null) => {
      const { results, next_cursor } = await this.client.databases.query({
        database_id: this.databaseId,
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

  async getPages(): Promise<Page[]> {
    return await this.fetchAll(this.getPagesFromNotion());
  }

  private async updatePageSlug({ pageId, key, value, url }: UpdatePageOption) {
    const link = url ? { url } : null;

    const fetch = async () => {
      const updateResult = await this.client.pages.update({
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

      return isPageAccessible(updateResult) ? updateResult.properties[key] : null;
    };

    return this.fetchWithErrorHandler(fetch.bind(this));
  }

  async appendSlug(page: Page, properties: Record<string, NormalizedValue>) {
    if (!this.slugOptions || !this.slugOptions.generator) return null;
    const { key, generator } = this.slugOptions;

    const slugProperty = properties[key];
    const valueType = typeof slugProperty;

    if (slugProperty === undefined) {
      const message = `Property ${key} doesn't exist on database ${this.databaseId}!`;
      this.reporter.panicOnBuild(message);
      return null;
    } else if (valueType !== 'string') {
      const message = `Property ${key} is defined as slug, but its value type is ${valueType}!`;
      this.reporter.panicOnBuild(message);
      return null;
    } else if (slugProperty !== '') return slugProperty;

    const pageId = page.id;
    const { notionKey, value, url } = generator(properties, page);
    const result = await this.updatePageSlug({ pageId, key: notionKey, value, url });
    if (result === null) {
      this.reporter.warn(`Setting slug for page ${pageId} has failed! Slug will be set to null.`);
      return null;
    }

    page.properties[notionKey] = result;
    properties[key] = getPropertyContent(result);
    this.reporter.info(`Updated slug for page ${pageId}!`);

    return value;
  }
}

export default NotionClient;
