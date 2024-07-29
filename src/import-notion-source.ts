import type { Actions, NodePluginArgs, Reporter } from 'gatsby';
import YAML from 'yaml';
import { NODE_TYPE } from './constants';
import NotionClient from './notion-client';
import { pageToProperties } from './transformers/get-page-properties';
import { getNotionPageTitle } from './transformers/get-page-title';
import { notionBlockToMarkdown } from './transformers/notion-block-to-markdown';
import type { NormalizedValue, Options, Page } from './types';
import { getPropertyContent } from './utils';

const slugAppender = (
  slugOption: Options['slugOption'],
  reporter: Reporter,
  notionClient: NotionClient,
) => {
  if (slugOption === undefined) return null;
  const { key, generator } = slugOption;
  if (!generator) return null;

  return async (page: Page, properties: Record<string, NormalizedValue>) => {
    const slugProperty = properties[key];
    if (!!slugProperty) {
      const valueType = typeof slugProperty;
      if (valueType !== 'string') {
        const message = `Property ${key} is defined as slug, but its value type is ${valueType}!`;
        reporter.panicOnBuild(message);
        return null;
      } else return slugProperty;
    }

    const pageId = page.id;
    const { notionKey, value, url } = generator(properties, page);
    const result = await notionClient.updatePageSlug({ pageId, key: notionKey, value, url });
    if (result === null) {
      reporter.warn(`Setting slug for page ${pageId} has failed! Slug will be set to null.`);
      return null;
    }

    page.properties[key] = result;
    properties[key] = getPropertyContent(result);
    reporter.info(`Updated slug for page ${pageId}!`);

    return value;
  };
};

export const importNotionSource = async (
  notionPluginArgs: NodePluginArgs,
  {
    token,
    databaseId,
    notionVersion = '2022-06-28',
    propsToFrontmatter = true,
    lowerTitleLevel = true,
    useCacheForDatabase = false,
    slugOption,
    keyConverter = ({ name }) => name.replaceAll(' ', '_'),
    valueConverter = ({ value }) => value,
  }: Options,
) => {
  const { actions, createContentDigest, createNodeId, reporter } = notionPluginArgs;
  const notionClient = new NotionClient({
    token,
    notionVersion,
    useCacheForDatabase,
    ...notionPluginArgs,
  });

  const appendSlug = slugAppender(slugOption, reporter, notionClient);

  const getPageProperties = pageToProperties(valueConverter, keyConverter);
  const pages = await notionClient.getPages(databaseId);

  pages.forEach(async (page) => {
    const title = getNotionPageTitle(page);
    const properties = getPageProperties(page);
    let markdown = notionBlockToMarkdown(page, lowerTitleLevel);

    if (propsToFrontmatter) {
      markdown = '---\n'.concat(YAML.stringify(properties)).concat('\n---\n\n').concat(markdown);
    }

    const slug = appendSlug !== null ? await appendSlug(page, properties) : null;

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
