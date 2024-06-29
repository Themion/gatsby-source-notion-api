const fetch = require('node-fetch');
const { errorMessage } = require('../error-message');
const { getBlocks } = require('./get-blocks');
const { Client } = require('@notionhq/client');

async function fetchPageChildren({ page, token, notionVersion }, reporter, cache) {
  let cacheKey = `notionApiPageChildren:${page.id}:${page.last_edited_time}`;

  let children = await cache.get(cacheKey);

  if (children) {
    return children;
  }

  children = await getBlocks({ id: page.id, token, notionVersion }, reporter);
  await cache.set(cacheKey, children);
  return children;
}

exports.getPages = async ({ token, databaseId, notionVersion }, reporter, cache) => {
  const notion = new Client({ auth: token, notionVersion });
  const pages = [];

  let startCursor = undefined;

  do {
    try {
      const { results, next_cursor } = await notion.databases.query({
        database_id: databaseId,
        start_cursor: startCursor,
      });

      startCursor = next_cursor;

      for (let page of results) {
        page.children = await fetchPageChildren({ page, token, notionVersion }, reporter, cache);
        pages.push(page);
      }
    } catch (e) {
      reporter.panic(errorMessage);
    }
  } while (!!startCursor);

  return pages;
};
