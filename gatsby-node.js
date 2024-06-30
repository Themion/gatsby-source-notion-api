const { getPages } = require('./src/notion-api/get-pages');
const { notionBlockToMarkdown } = require('./src/transformers/notion-block-to-markdown');
const { getNotionPageProperties } = require('./src/transformers/get-page-properties');
const { getNotionPageTitle } = require('./src/transformers/get-page-title');
const YAML = require('yaml');

const NOTION_NODE_TYPE = 'Notion';

exports.sourceNodes = async (
  { actions, createContentDigest, createNodeId, reporter, cache },
  {
    token,
    databaseId,
    notionVersion = '2022-06-28',
    propsToFrontmatter = true,
    lowerTitleLevel = true,
  },
) => {
  const pages = await getPages({ token, databaseId, notionVersion }, reporter, cache);

  pages.forEach((page) => {
    const title = getNotionPageTitle(page);
    const properties = getNotionPageProperties(page, reporter);
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
