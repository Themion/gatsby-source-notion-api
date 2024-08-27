import type { NodePluginArgs } from 'gatsby';
import YAML from 'yaml';
import NotionClient from '~/client';
import { NODE_TYPE } from '~/constants';
import { pageToProperties } from '~/transformers/get-page-properties';
import { getNotionPageTitle } from '~/transformers/get-page-title';
import { notionPageToMarkdown } from '~/transformers/notion-page-to-markdown';
import type { Options, Page } from '~/types';

const createNodeClosure = (
  notionPluginArgs: NodePluginArgs,
  options: Options,
  notionClient: NotionClient,
  getPageProperties: ReturnType<typeof pageToProperties>,
) => {
  const { actions, createContentDigest, createNodeId } = notionPluginArgs;
  const { databaseId, propsToFrontmatter = true } = options;

  return async (page: Page) => {
    const title = getNotionPageTitle(page);
    const properties = getPageProperties(page);
    const slug = await notionClient.appendSlug(page, properties);

    let markdown = notionPageToMarkdown(page, notionPluginArgs, options);

    if (propsToFrontmatter) {
      markdown = '---\n'.concat(YAML.stringify(properties)).concat('\n---\n\n').concat(markdown);
    }

    await actions.createNode({
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
  };
};

export const importNotionSource = async (notionPluginArgs: NodePluginArgs, options: Options) => {
  const { reporter } = notionPluginArgs;
  const {
    chunkOptions,
    keyConverter = ({ name }) => name.replaceAll(' ', '_'),
    valueConverter = ({ value }) => value,
  } = options;

  const notionClient = new NotionClient(notionPluginArgs, options);
  const getPageProperties = pageToProperties(valueConverter, keyConverter, reporter);
  const createNode = createNodeClosure(notionPluginArgs, options, notionClient, getPageProperties);

  await notionClient.createPages(createNode);
};
