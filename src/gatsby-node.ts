import { GatsbyNode, PluginOptions } from 'gatsby';
import YAML from 'yaml';
import { getPages } from './notion-api/get-pages';
import { getNotionPageProperties } from './transformers/get-page-properties';
import { getNotionPageTitle } from './transformers/get-page-title';
import { notionBlockToMarkdown } from './transformers/notion-block-to-markdown';

type Options = PluginOptions & {
  token: string;
  databaseId: string;
  notionVersion: string;
  propsToFrontmatter: boolean;
  lowerTitleLevel: boolean;
};

const NOTION_NODE_TYPE = 'Notion';

export const sourceNodes: GatsbyNode['sourceNodes'] = async (
  { actions, createContentDigest, createNodeId, reporter, cache },
  {
    token,
    databaseId,
    notionVersion = '2022-06-28',
    propsToFrontmatter = true,
    lowerTitleLevel = true,
  }: Options,
) => {
  const pages = await getPages(token, databaseId, notionVersion, reporter, cache);

  pages.forEach((page) => {
    const title = getNotionPageTitle(page);
    const properties = getNotionPageProperties(page);
    let markdown = notionBlockToMarkdown(page, lowerTitleLevel);

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
