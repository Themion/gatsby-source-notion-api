import { NodePluginArgs } from 'gatsby';
import YAML from 'yaml';
import { getPages } from './notion-api/get-pages';
import { updatePage } from './notion-api/update-page';
import { pageToProperties } from './transformers/get-page-properties';
import { getNotionPageTitle } from './transformers/get-page-title';
import { notionBlockToMarkdown } from './transformers/notion-block-to-markdown';
import { NormalizedValue, Options } from './types';
import { getPropertyContent } from './utils';

const NOTION_NODE_TYPE = 'Notion';

export const importNotionSource = async (
  { actions, createContentDigest, createNodeId, reporter, cache }: NodePluginArgs,
  {
    token,
    databaseId,
    notionVersion = '2022-06-28',
    propsToFrontmatter = true,
    lowerTitleLevel = true,
    keyConverter = ({ name }) => name.replaceAll(' ', '_'),
    valueConverter = ({ value }) => value,
    slugifier,
  }: Options,
) => {
  const getPageProperties = pageToProperties(valueConverter, keyConverter);
  const pages = await getPages({ token, databaseId, notionVersion, reporter, cache });

  const appendSlug = async (pageId: string, properties: Record<string, NormalizedValue>) => {
    if (!slugifier) return;
    const { key, value } = slugifier(properties);
    if (!!properties[key]) return;
    const slug = await updatePage({ token, notionVersion, pageId, key, value });
    if (slug === null) return;
    properties[key] = getPropertyContent(slug);
  };

  pages.forEach(async (page) => {
    const title = getNotionPageTitle(page);
    const properties = getPageProperties(page);
    let markdown = notionBlockToMarkdown(page, lowerTitleLevel);

    await appendSlug(page.id, properties);

    if (propsToFrontmatter) {
      markdown = '---\n'.concat(YAML.stringify(properties)).concat('\n---\n\n').concat(markdown);
    }

    actions.createNode({
      id: createNodeId(`${NOTION_NODE_TYPE}-${databaseId}-${page.id}`),
      title,
      properties,
      archived: page.archived,
      createdAt: page.created_time,
      updatedAt: page.last_edited_time,
      markdownString: markdown,
      raw: page,
      json: JSON.stringify(page),
      parent: null,
      children: [],
      internal: {
        type: NOTION_NODE_TYPE,
        mediaType: 'text/markdown',
        content: markdown,
        contentDigest: createContentDigest(page),
      },
    });
  });
};
