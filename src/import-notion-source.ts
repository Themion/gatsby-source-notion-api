import type { Actions, NodePluginArgs, Reporter } from 'gatsby';
import YAML from 'yaml';
import { NODE_TYPE } from './constants';
import NotionClient from './notion-client';
import { pageToProperties } from './transformers/get-page-properties';
import { getNotionPageTitle } from './transformers/get-page-title';
import { notionBlockToMarkdown } from './transformers/notion-block-to-markdown';
import type { NormalizedValue, Options, Page } from './types';
import { getCacheKey, getPropertyContent } from './utils';

const slugAppender = (
  options: Options,
  nodePluginArgs: NodePluginArgs,
  notionClient: NotionClient,
) => {
  const { databaseId, slugOptions } = options;

  if (slugOptions === undefined) return null;
  const { key, generator } = slugOptions;
  if (!generator) return null;
  const { reporter, cache } = nodePluginArgs;

  return async (page: Page, properties: Record<string, NormalizedValue>) => {
    const slugProperty = properties[key];
    const valueType = typeof slugProperty;

    if (slugProperty === undefined) {
      const message = `Property ${key} doesn't exist on database ${databaseId}!`;
      reporter.panicOnBuild(message);
      return null;
    } else if (valueType !== 'string') {
      const message = `Property ${key} is defined as slug, but its value type is ${valueType}!`;
      reporter.panicOnBuild(message);
      return null;
    } else if (slugProperty !== '') return slugProperty;

    const pageId = page.id;
    cache.del(getCacheKey('page', pageId));
    const { notionKey, value, url } = generator(properties, page);
    const result = await notionClient.updatePageSlug({ pageId, key: notionKey, value, url });
    if (result === null) {
      reporter.warn(`Setting slug for page ${pageId} has failed! Slug will be set to null.`);
      return null;
    }

    page.properties[notionKey] = result;
    properties[key] = getPropertyContent(result);
    reporter.info(`Updated slug for page ${pageId}!`);

    return value;
  };
};

export const importNotionSource = async (notionPluginArgs: NodePluginArgs, options: Options) => {
  const { actions, createContentDigest, createNodeId } = notionPluginArgs;
  const {
    token,
    databaseId,
    notionVersion = '2022-06-28',
    propsToFrontmatter = true,
    lowerTitleLevel = true,
    useCacheForDatabase = false,
    keyConverter = ({ name }) => name.replaceAll(' ', '_'),
    valueConverter = ({ value }) => value,
  } = options;
  const notionClient = new NotionClient({
    token,
    notionVersion,
    useCacheForDatabase,
    ...notionPluginArgs,
  });

  const appendSlug = slugAppender(options, notionPluginArgs, notionClient);
  const getPageProperties = pageToProperties(valueConverter, keyConverter);

  const pages = await notionClient.getPages(databaseId);
  pages.forEach(async (page) => {
    const title = getNotionPageTitle(page);
    const properties = getPageProperties(page);
    const slug = appendSlug !== null ? await appendSlug(page, properties) : null;

    let markdown = notionBlockToMarkdown(page, lowerTitleLevel);

    if (propsToFrontmatter) {
      markdown = '---\n'.concat(YAML.stringify(properties)).concat('\n---\n\n').concat(markdown);
    }

    actions.createNode({
      id: createNodeId(`${NODE_TYPE}-${databaseId}-${page.id}`),
      title,
      properties,
      archived: page.archived,
      createdAt: page.created_time,
      updatedAt: page.last_edited_time,
      markdownString: markdown,
      raw: page,
      json: JSON.stringify(page),
      parent: null,
      slug,
      children: [],
      internal: {
        type: NODE_TYPE,
        mediaType: 'text/markdown',
        content: markdown,
        contentDigest: createContentDigest(page),
      },
    });
  });
};
