import { RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';
import { blockToString } from '../block-to-string';
import { Block, Page } from '../types';
import { getBlockProperty } from '../utils';
import { childPageToHtml } from './child-page-to-html';
import { getYoutubeUrl } from './get-youtube-url';

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
    .join('\n')
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
    case 'audio':
      const audioUrl =
        block.audio.type == 'external' ? block.audio.external.url : block.audio.file.url;
      return `<audio controls><source src="${audioUrl}" /></audio>\n`;
    case 'bookmark':
      const bookmarkUrl = block.bookmark.url;
      const bookmarkCaption = blockToString(block.bookmark.caption) || bookmarkUrl;
      return `[${bookmarkCaption}](${bookmarkUrl})`;
    case 'bulleted_list_item':
      return prependToLines(markdown.replaceAll('\n', '<br>'), '*');
    case 'child_page':
      if (block.has_children) return childPageToHtml(block);
      return '';
    case 'code':
      `\`\`\`${block.code.language}\n${blockMarkdown}\n\`\`\`${childMarkdown}`;
    case 'column':
      return `<div class="notion-column-block">${markdown}</div>\n`;
    case 'column_list':
      return `<div class="notion-column-list-block">${markdown}</div>\n`;
    case 'divider':
      return '---';
    case 'embed':
      return [EOL_MD, block.embed.url, EOL_MD].join('');
    case 'heading_1':
    case 'heading_2':
    case 'heading_3':
      const headingLevel = Number(block.type.split('_')[1]);
      const headingSymbol = (lowerTitleLevel ? '#' : '') + '#'.repeat(headingLevel);
      return prependToLines(markdown, headingSymbol);
    case 'image':
      const imageUrl =
        block.image.type == 'external' ? block.image.external.url : block.image.file.url;
      return `${EOL_MD}![${blockToString(block.image.caption)}](${imageUrl})${EOL_MD}`;
    case 'numbered_list_item':
      return prependToLines(markdown.replaceAll('\n', '<br>'), '1.');
    case 'paragraph':
      return markdown;
    case 'quote':
      return prependToLines(markdown, '>', false);
    case 'to_do':
      const toDoSymbol = `- [${block.to_do.checked ? 'x' : ' '}] `;
      return prependToLines(markdown, toDoSymbol).concat(EOL_MD);
    case 'toggle':
      return `<details><summary>${blockMarkdown}</summary>${childMarkdown}</details>\n`;
    case 'video':
      const url = block.video.type === 'external' ? block.video.external.url : block.video.file.url;
      const videoCaption = blockToString(block.video.caption).trim();
      if (block.video.type === 'file')
        return `<video controls><source src="${url}">${videoCaption}</video>\n`;
      const youtubeUrl = getYoutubeUrl(url);
      if (youtubeUrl !== null)
        return `<iframe width="100%" height="600" src="${youtubeUrl}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>\n`;

      const videoWarningText = `External video (${url}) is not supported yet: please upload video file directly or to youtube.`;
      console.warn(videoWarningText);
      return [EOL_MD, `<!-- ${videoWarningText} -->`, EOL_MD].join('');

    // TODO: Add support for table, callouts, and files
    default:
      const unsupportedWarningText = unsupportedNotionBlockComment(block);
      console.warn(unsupportedWarningText);
      return [EOL_MD, `<!-- ${unsupportedWarningText} -->`, EOL_MD].join('');
  }
};
