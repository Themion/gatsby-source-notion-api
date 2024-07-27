import { APIErrorCode, Client, isNotionClientError } from '@notionhq/client';
import {
  DatabaseObjectResponse,
  PageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { NodePluginArgs, Reporter } from 'gatsby';
import { Block, NotionAPIPage, Page } from './types';
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
} & NodePluginArgs;

type UpdatePageOption = {
  pageId: string;
  key: string;
  value: string;
};

type FetchNotionData<T> = (
  cursor: string | null,
) => Promise<{ nextCursor: string | null; data: T[] }>;

const isPageObject = (item: PageObjectResponse | DatabaseObjectResponse): item is NotionAPIPage =>
  item.object === 'page';

class NotionClient {
  private readonly client: Client;
  private readonly reporter: Reporter;

  constructor({ token, notionVersion, reporter }: ClientConfig) {
    this.client = new Client({ auth: token, notionVersion });
    this.reporter = reporter;
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

  private getPage(id: string): FetchNotionData<Page> {
    const fetch = async (cursor: string | null) => {
      const { results, next_cursor } = await this.client.databases.query({
        database_id: id,
        start_cursor: cursor ?? undefined,
      });

      const fetchedPages: PromiseSettledResult<Page>[] = await Promise.allSettled(
        results
          .filter(isPageAccessible)
          .filter(isPageObject)
          .map(
            async (result): Promise<Page> => ({
              ...result,
              children: await this.getBlocks(result.id),
            }),
          ),
      );

      return {
        data: fetchedPages.filter(isFulfilled).map(getPromiseValue),
        nextCursor: next_cursor,
      };
    };

    return fetch.bind(this);
  }

  async getPages(databaseId: string) {
    return this.fetchAll(this.getPage(databaseId));
  }

  async updatePageSlug({ pageId, key, value }: UpdatePageOption) {
    try {
      const result = await this.client.pages.update({
        page_id: pageId,
        properties: {
          [key]: {
            type: 'rich_text',
            rich_text: [
              {
                type: 'text',
                text: {
                  content: value,
                  link: null,
                },
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
