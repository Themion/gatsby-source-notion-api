import { RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';
import { getBlockProperty } from 'src/utils';
import { blockToString } from '../block-to-string';
import { Block, Page } from '../types';

const EOL_MD = '\n';
const DOUBLE_EOL_MD = EOL_MD.repeat(2);

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
  const textPropertyEntries = Object.entries({ ...property }).find(([key]) => key === 'text');
  const textProperty: RichTextItemResponse[] = // TODO: might cause problem
    textPropertyEntries !== undefined && Array.isArray(textPropertyEntries[1])
      ? textPropertyEntries[1]
      : [];
  let blockMarkdown = blockToString(textProperty).trim();
  let markdown = [blockMarkdown, childMarkdown].filter((text) => text).join(DOUBLE_EOL_MD);

  // Paragraph
  if (block.type == 'paragraph') {
    return [EOL_MD, markdown, EOL_MD].join('');
  }

  // Heading
  if (block.type.startsWith('heading_')) {
    const headingLevel = Number(block.type.split('_')[1]);
    let symbol = (lowerTitleLevel ? '#' : '') + '#'.repeat(headingLevel);
    return [EOL_MD, prependToLines(markdown, symbol), EOL_MD].join('');
  }

  // To do list item
  if (block.type == 'to_do') {
    let symbol = `- [${block.to_do.checked ? 'x' : ' '}] `;
    return prependToLines(markdown, symbol).concat(EOL_MD);
  }

  // Bulleted list item
  if (block.type == 'bulleted_list_item') {
    return prependToLines(markdown, '*').concat(EOL_MD);
  }

  // Numbered list item
  if (block.type == 'numbered_list_item') {
    return prependToLines(markdown, '1.').concat(EOL_MD);
  }

  // Toggle
  if (block.type == 'toggle') {
    return [
      EOL_MD,
      '<details><summary>',
      blockMarkdown,
      '</summary>',
      childMarkdown,
      '</details>',
      EOL_MD,
    ].join('');
  }

  // Code
  if (block.type == 'code') {
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
  }

  // Image
  if (block.type == 'image') {
    const imageUrl =
      block.image.type == 'external' ? block.image.external.url : block.image.file.url;
    return `${EOL_MD}![${blockToString(block.image.caption)}](${imageUrl})${EOL_MD}`;
  }

  // Audio
  if (block.type == 'audio') {
    const audioUrl =
      block.audio.type == 'external' ? block.audio.external.url : block.audio.file.url;
    return [EOL_MD, '<audio controls>', `<source src="${audioUrl}" />`, '</audio>', EOL_MD].join(
      '',
    );
  }

  // Video
  if (block.type == 'video' && block.video.type == 'external') {
    return [EOL_MD, block.video.external.url, EOL_MD].join('');
  }

  // Embed
  if (block.type == 'embed') {
    return [EOL_MD, block.embed.url, EOL_MD].join('');
  }

  // Quote
  if (block.type == 'quote') {
    return [EOL_MD, prependToLines(markdown, '>', false), EOL_MD].join('');
  }

  // Bookmark
  if (block.type == 'bookmark') {
    const bookmarkUrl = block.bookmark.url;
    const bookmarkCaption = blockToString(block.bookmark.caption) || bookmarkUrl;
    return `${EOL_MD}[${bookmarkCaption}](${bookmarkUrl})${EOL_MD}`;
  }

  // Divider
  if (block.type == 'divider') {
    return `${EOL_MD}---${EOL_MD}`;
  }

  // Column List
  if (block.type == 'column_list') {
    return [EOL_MD, '<ColumnList>', EOL_MD, markdown, EOL_MD, '</ColumnList>', EOL_MD].join('');
  }

  // Column
  if (block.type == 'column') {
    return ['<Column>', EOL_MD, EOL_MD, markdown, EOL_MD, EOL_MD, '</Column>', EOL_MD].join('');
  }

  // Unsupported types.
  // TODO: Add support for callouts, internal video, and files
  return [EOL_MD, `<!-- This block type '${block.type}' is not supported yet. -->`, EOL_MD].join(
    '',
  );
};
