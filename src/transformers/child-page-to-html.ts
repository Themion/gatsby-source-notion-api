import { RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';
import type { Block } from '~/types';

const richTextToCode = (blockList: RichTextItemResponse[]) =>
  blockList
    .map(({ plain_text }) => plain_text)
    .join();

const childBlockToHtml = (childBlock: Extract<Block, { type: 'code' }>) => {
  const code = richTextToCode(childBlock.code.rich_text);
  switch (childBlock.code.language) {
    case 'markdown':
    case 'html':
      return code;
    case 'css':
      return `<style>\n${code}\n</style>`;
    case 'javascript':
      return `<script>\n${code}\n</script>`;
    default:
      return null;
  }
};

export const childPageToHtml = (
  block: Extract<Block, { type: 'child_page'; has_children: true }>,
) =>
  block.children
    .filter((childBlock) => childBlock.type === 'code')
    .map(childBlockToHtml)
    .filter((text) => text !== null)
    .join('\n');
