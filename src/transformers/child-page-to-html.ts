import { blockToString } from '~/block-to-string';
import type { Block } from '~/types';

const childBlockToHtml = (childBlock: Extract<Block, { type: 'code' }>) => {
  const code = blockToString(childBlock.code.rich_text, false);
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
