const fetch = require('node-fetch');
const { errorMessage } = require('../error-message');
const { Client } = require('@notionhq/client');

exports.getBlocks = async ({ id, notionVersion, token }, reporter) => {
  const notion = new Client({ auth: token, notionVersion });
  let blockContent = [];
  let startCursor = '';

  do {
    try {
      const { results, next_cursor } = await notion.blocks.children.list({
        block_id: id,
        start_cursor: startCursor,
      });

      for (let childBlock of results) {
        if (childBlock.has_children) {
          childBlock.children = await this.getBlocks(
            { id: childBlock.id, notionVersion, token },
            reporter,
          );
        }
      }

      blockContent = blockContent.concat(results);
      startCursor = next_cursor;
    } catch (e) {
      reporter.panic(errorMessage);
    }
  } while (!!startCursor);

  return blockContent;
};
