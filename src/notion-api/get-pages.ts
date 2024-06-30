import { Client } from '@notionhq/client';
import {
  DatabaseObjectResponse,
  PageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import type { GatsbyCache, Reporter } from 'gatsby';
import { errorMessage } from '../error-message';
import { Block, NotionAPIPage, Page } from '../types';
import { isFulfilled, isPageAccessible } from '../utils';
import { getBlocks } from './get-blocks';

const isPageObject = (item: PageObjectResponse | DatabaseObjectResponse): item is NotionAPIPage =>
  item.object === 'page';

type FetchPageChildrenOption = {
  page: NotionAPIPage;
  token: string;
  notionVersion: string;
  reporter: Reporter;
  cache: GatsbyCache;
};

async function fetchPageChildren({
  page,
  token,
  notionVersion,
  reporter,
  cache,
}: FetchPageChildrenOption) {
  let cacheKey = `notionApiPageChildren:${page.id}:${page.last_edited_time}`;

  let children: Block[] = await cache.get(cacheKey);

  if (children) {
    return children;
  }

  children = await getBlocks({ id: page.id, token, notionVersion, reporter });
  await cache.set(cacheKey, children);
  return children;
}

type GetPageOptions = {
  token: string;
  databaseId: string;
  notionVersion: string;
  reporter: Reporter;
  cache: GatsbyCache;
};

export const getPages = async ({
  token,
  databaseId,
  notionVersion,
  reporter,
  cache,
}: GetPageOptions) => {
  const notion = new Client({ auth: token, notionVersion });
  const pages: Page[] = [];

  let startCursor: string | null = null;

  do {
    try {
      const { results, next_cursor } = await notion.databases.query({
        database_id: databaseId,
        start_cursor: startCursor ?? undefined,
      });

      startCursor = next_cursor;

      const fetchedPages = await Promise.allSettled(
        results
          .filter(isPageAccessible)
          .filter(isPageObject)
          .map(
            async (result): Promise<Page> => ({
              ...result,
              children: await fetchPageChildren({
                page: result,
                token,
                notionVersion,
                reporter,
                cache,
              }),
            }),
          ),
      );

      pages.push(...fetchedPages.filter(isFulfilled).map(({ value }) => value));
    } catch (e) {
      reporter.panic(errorMessage);
    }
  } while (!!startCursor);

  return pages;
};
