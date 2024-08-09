import { Client } from '@notionhq/client';
import {
  DatabaseObjectResponse,
  PageObjectResponse,
  QueryDatabaseParameters,
} from '@notionhq/client/build/src/api-endpoints';
import { NodePluginArgs, Reporter } from 'gatsby';
import {
  Block,
  FetchNotionData,
  NormalizedValue,
  NotionAPIPage,
  Options,
  Page,
  SlugOptions,
} from '~/types';
import {
  getPromiseValue,
  getPropertyContent,
  isFulfilled,
  isPageAccessible,
  isPropertyAccessible,
  isPropertySupported,
} from '~/utils';
import CacheWrapper from './cache';
import FetchWrapper from './fetch';

type UpdatePageOption = {
  pageId: string;
  key: string;
  value: string;
  url?: string;
};

const isPageObject = (item: PageObjectResponse | DatabaseObjectResponse): item is NotionAPIPage =>
  item.object === 'page';

class NotionClient {
  private readonly databaseId: string;
  private readonly filter: QueryDatabaseParameters['filter'];
  private readonly reporter: Reporter;
  private readonly slugOptions: SlugOptions | null;

  constructor(
    { reporter, cache }: NodePluginArgs,
    { token, notionVersion = '2022-06-28', filter, databaseId, slugOptions, cacheOptions }: Options,
    private readonly fetchWrapper: FetchWrapper = new FetchWrapper(reporter),
    private readonly cacheWrapper: CacheWrapper = new CacheWrapper(reporter, cache, cacheOptions),
    private readonly client: Client = new Client({ auth: token, notionVersion }),
    private readonly cacheEnabled = cacheOptions?.enabled ?? true,
  ) {
    this.databaseId = databaseId;
    this.filter = filter;
    this.reporter = reporter;
    this.slugOptions = slugOptions ?? null;
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
                ? {
                    has_children: true,
                    children: await this.getBlocks(block.id, new Date(block.last_edited_time)),
                  }
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

  async getBlocks(id: string, lastEditedDate: Date) {
    if (this.cacheEnabled) {
      const cachedBlocks = await this.cacheWrapper.getBlocksFromCache(id, lastEditedDate);
      if (cachedBlocks !== null) return cachedBlocks;
    }

    const blocksFromNotion = await this.fetchWrapper.fetchAll(this.getBlock(id));
    if (this.cacheEnabled) this.cacheWrapper.setBlocksToCache(id, blocksFromNotion);
    return blocksFromNotion;
  }

  private async getPageContent(result: PageObjectResponse): Promise<Page> {
    const lastEditedTime = new Date(result.last_edited_time);

    if (this.cacheEnabled) {
      const pageFromCache = await this.cacheWrapper.getPageFromCache(result.id, lastEditedTime);
      if (pageFromCache !== null) return pageFromCache;
    }

    const pageFromNotion: Page = {
      ...result,
      children: await this.getBlocks(result.id, lastEditedTime),
    };
    if (this.cacheEnabled) this.cacheWrapper.setPageToCache(pageFromNotion);

    return pageFromNotion;
  }

  private getPagesFromNotion(): FetchNotionData<Page> {
    const fetch = async (cursor: string | null) => {
      const { results, next_cursor } = await this.client.databases.query({
        database_id: this.databaseId,
        start_cursor: cursor ?? undefined,
        filter: this.filter,
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
    return await this.fetchWrapper.fetchAll(this.getPagesFromNotion());
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

    return this.fetchWrapper.fetchWithErrorHandler(fetch.bind(this));
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
