import { Client } from '@notionhq/client';
import {
  DatabaseObjectResponse,
  PageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { NodePluginArgs } from 'gatsby';
import {
  Block,
  NormalizedValue,
  NotionAPIBlock,
  NotionAPIPage,
  Options,
  Page,
  SlugOptions,
} from '~/types';
import {
  getPropertyContent,
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
  constructor(
    { cache, ...nodePluginArgs }: NodePluginArgs,
    { cacheOptions = { enabled: true }, chunkOptions = { block: 1 }, ...options }: Options,

    private readonly databaseId = options.databaseId,
    private readonly filter = options.filter,
    private readonly reporter = nodePluginArgs.reporter,
    private readonly slugOptions: SlugOptions | null = options.slugOptions ?? null,
    private readonly usePageContent = options.usePageContent ?? true,
    private readonly cacheEnabled = this.usePageContent ? cacheOptions.enabled : false,
    private readonly fetchChunkOptions = chunkOptions,

    private readonly fetchWrapper: FetchWrapper = new FetchWrapper(
      { ...options, cacheOptions, chunkOptions },
      reporter,
    ),
    private readonly cacheWrapper: CacheWrapper = new CacheWrapper(reporter, cache, cacheOptions),
  ) {
    if (!this.usePageContent && cacheOptions?.enabled === true) {
      this.reporter.warn(`Notion Database ${databaseId} without page content will not be cached!`);
    }
  }

  private async getBlockWithChildren(block: NotionAPIBlock): Promise<Block> {
    return {
      ...block,
      ...(block.has_children
        ? {
            has_children: true,
            children: await this.getBlocks(block.id, new Date(block.last_edited_time)),
          }
        : {
            has_children: false,
          }),
    };
  }

  async getBlocks(id: string, lastEditedDate: Date) {
    if (this.cacheEnabled) {
      const cachedBlocks = await this.cacheWrapper.getBlocksFromCache(id, lastEditedDate);
      if (cachedBlocks !== null) return cachedBlocks;
    }

    const blocksFromNotion = await this.fetchWrapper.fetchAll(
      (client, cursor) =>
        client.blocks.children.list({
          block_id: id,
          start_cursor: cursor ?? undefined,
        }),
      (result) => isPropertyAccessible(result) && isPropertySupported(result),
      this.getBlockWithChildren.bind(this),
      this.fetchChunkOptions?.block,
    );

    if (this.cacheEnabled) {
      if (blocksFromNotion.some((block) => block.type === 'child_page')) {
        const warningMessage =
          'Block with child page will not be cached! Changes of child page will not affect last_changed_time of parent page.';
        this.reporter.warn(warningMessage);
      } else {
        this.cacheWrapper.setBlocksToCache(
          id,
          blocksFromNotion.filter((block) => block),
        );
      }
    }

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
      children: this.usePageContent ? await this.getBlocks(result.id, lastEditedTime) : [],
    };

    if (this.cacheEnabled) {
      if (pageFromNotion.children.some((block) => block.type === 'child_page')) {
        const warningMessage =
          'Page with child page will not be cached! Changes of child page will not affect last_changed_time of parent page.';
        this.reporter.warn(warningMessage);
      } else {
        this.cacheWrapper.setPageToCache(pageFromNotion);
      }
    }

    return pageFromNotion;
  }

  async createPages(createPage: (page: Page) => unknown) {
    await this.fetchWrapper.fetchAll(
      (client, cursor) =>
        client.databases.query({
          database_id: this.databaseId,
          start_cursor: cursor ?? undefined,
          filter: this.filter,
        }),
      (result) => isPageAccessible(result) && isPageObject(result),
      async (pageObject) => {
        const page = await this.getPageContent.bind(this)(pageObject);
        createPage(page);
        return null;
      },
      this.fetchChunkOptions.page,
      false,
    );
  }

  private async updatePageSlug({ pageId, key, value, url }: UpdatePageOption) {
    const link = url ? { url } : null;

    const fetch = async (client: Client) => {
      const updateResult = await client.pages.update({
        page_id: pageId,
        properties: {
          [key]: {
            type: 'rich_text',
            rich_text: [
              {
                type: 'text',
                text: { content: value, link },
              },
            ],
          },
        },
      });

      return isPageAccessible(updateResult) ? updateResult.properties[key] : null;
    };

    return this.fetchWrapper.fetchWithErrorHandler(fetch);
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
    properties[key] = getPropertyContent(result, this.reporter);
    this.reporter.info(`Updated slug for page ${pageId}!`);

    return value;
  }
}

export default NotionClient;
