import { RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';
import { blockToString } from '../block-to-string';
import { Block, Page } from '../types';
import { getBlockProperty } from '../utils';

const EOL_MD = '\n';
const DOUBLE_EOL_MD = EOL_MD.repeat(2);

const unsupportedNotionBlockComment = (block: Block) =>
  `Block type '${block.type}' is not supported yet.`;

// Inserts the string at the beginning of every line of the content. If the useSpaces flag is set to
// true, the lines after the first will instead be prepended with two spaces.
function prependToLines(content: string, string: string, useSpaces = true) {
  let [head, ...tail] = content.split('\n');

  return [
    `${string} ${head}`,
    ...tail.map((line) => {
      return `${useSpaces ? ' ' : string} ${line}`;
    }),
  ].join('\n');
}

// Converts a notion block to a markdown string.
export const notionBlockToMarkdown = (block: Block | Page, lowerTitleLevel: boolean): string => {
  const children: Block[] =
    block.object === 'page' || block.has_children === true ? block.children : [];
  // Get the child content of the block.
  let childMarkdown = children
    .map((childBlock) => notionBlockToMarkdown(childBlock, lowerTitleLevel))
    .join('')
    .trim();

  // If the block is a page, return the child content.
  if (block.object === 'page') {
    return childMarkdown;
  }

  // Extract the remaining content of the block and combine it with its children.
  const property = getBlockProperty(block);
  const textPropertyEntries = Object.entries({ ...property }).find(([key]) => key === 'rich_text');
  const textProperty: RichTextItemResponse[] = // TODO: might cause problem
    textPropertyEntries !== undefined && Array.isArray(textPropertyEntries[1])
      ? textPropertyEntries[1]
      : [];
  let blockMarkdown = blockToString(textProperty).trim();
  let markdown = [blockMarkdown, childMarkdown].filter((text) => text).join(DOUBLE_EOL_MD);

  switch (block.type) {
    case 'paragraph':
      return [EOL_MD, markdown, EOL_MD].join('');
    case 'heading_1':
    case 'heading_2':
    case 'heading_3':
      const headingLevel = Number(block.type.split('_')[1]);
      const headingSymbol = (lowerTitleLevel ? '#' : '') + '#'.repeat(headingLevel);
      return [EOL_MD, prependToLines(markdown, headingSymbol), EOL_MD].join('');
    case 'to_do':
      const toDoSymbol = `- [${block.to_do.checked ? 'x' : ' '}] `;
      return prependToLines(markdown, toDoSymbol).concat(EOL_MD);
    case 'bulleted_list_item':
      return prependToLines(markdown, '*').concat(EOL_MD);
    case 'numbered_list_item':
      return prependToLines(markdown, '1.').concat(EOL_MD);
    case 'toggle':
      return [
        EOL_MD,
        '<details><summary>',
        blockMarkdown,
        '</summary>',
        childMarkdown,
        '</details>',
        EOL_MD,
      ].join('');
    case 'code':
      return [
        EOL_MD,
        `\`\`\` ${block.code.language}${EOL_MD}`,
        blockMarkdown,
        EOL_MD,
        '```',
        EOL_MD,
        childMarkdown,
        EOL_MD,
      ].join('');
    case 'image':
      const imageUrl =
        block.image.type == 'external' ? block.image.external.url : block.image.file.url;
      return `${EOL_MD}![${blockToString(block.image.caption)}](${imageUrl})${EOL_MD}`;
    case 'audio':
      const audioUrl =
        block.audio.type == 'external' ? block.audio.external.url : block.audio.file.url;
      return [EOL_MD, '<audio controls>', `<source src="${audioUrl}" />`, '</audio>', EOL_MD].join(
        '',
      );
    case 'video':
      const url = block.video.type === 'external' ? block.video.external.url : block.video.file.url;
      if (block.video.type === 'external') {
        const videoWarningText = `External video (${url}) is not supported yet: please upload video file directly.`;
        console.warn(videoWarningText);
        return unsupportedNotionBlockComment(block);
      }
      const videoCaption = blockToString(block.video.caption).trim();
      return [
        EOL_MD,
        `<video controls><source src="${url}">${videoCaption}</video>`,
        EOL_MD,
      ].join();
    case 'embed':
      return [EOL_MD, block.embed.url, EOL_MD].join('');
    case 'quote':
      return [EOL_MD, prependToLines(markdown, '>', false), EOL_MD].join('');
    case 'bookmark':
      const bookmarkUrl = block.bookmark.url;
      const bookmarkCaption = blockToString(block.bookmark.caption) || bookmarkUrl;
      return `${EOL_MD}[${bookmarkCaption}](${bookmarkUrl})${EOL_MD}`;
    case 'divider':
      return `${EOL_MD}---${EOL_MD}`;
    case 'column_list':
      return [
        EOL_MD,
        '<div class="notion-column-list-block">',
        EOL_MD,
        markdown,
        EOL_MD,
        '</div>',
        EOL_MD,
      ].join('');
    case 'column':
      return [EOL_MD, '<div class="notion-column-block">', markdown, '</div>', EOL_MD].join('');
    // TODO: Add support for table, callouts, and files
    default:
      const unsupportedWarningText = unsupportedNotionBlockComment(block);
      console.warn(unsupportedWarningText);
      return [EOL_MD, `<!-- ${unsupportedWarningText} -->`, EOL_MD].join();
  }
};
