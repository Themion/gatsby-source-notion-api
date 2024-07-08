import { RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';
import { blockToString } from '../block-to-string';
import { Block, Page } from '../types';
import { getBlockProperty } from '../utils';
import { childPageToHtml } from './child-page-to-html';
import { getYoutubeUrl } from './get-youtube-url';

type BlockProperty = ReturnType<typeof getBlockProperty>;

const notionBlockComment = (
  block: Block,
  comment: string = `Block type '${block.type}' is not supported yet.`,
) => {
  console.warn(comment);
  return `<!-- ${comment} -->`;
};

const captionize = (content: string, caption: string = '') =>
  caption === '' ? content : `<figure>${content}<figcaption>${caption}</figcaption></figure>`;

const ifHasRichText = (
  property: BlockProperty,
): property is Extract<BlockProperty, { rich_text: RichTextItemResponse[] }> =>
  Object.keys({ ...property }).includes('rich_text');
const getBlockMarkdown = (block: Block): RichTextItemResponse[] => {
  const property = getBlockProperty(block);
  return ifHasRichText(property) ? property.rich_text : [];
};

// Converts a notion block to a markdown string.
export const notionBlockToMarkdown = (block: Block | Page, lowerTitleLevel: boolean): string => {
  const childMarkdown =
    block.object === 'page' || block.has_children === true
      ? block.children
          .map((child) => notionBlockToMarkdown(child, lowerTitleLevel))
          .join('\n\n')
          .trim()
      : '';

  // If the block is a page, return the child content.
  if (block.object === 'page') {
    return childMarkdown;
  }

  // Extract the remaining content of the block and combine it with its children.
  const blockMarkdown = blockToString(getBlockMarkdown(block)).trim();

  switch (block.type) {
    case 'audio':
      const audioUrl =
        block.audio.type == 'external' ? block.audio.external.url : block.audio.file.url;
      return `<audio controls><source src="${audioUrl}" /></audio>`;
    case 'bookmark':
      const bookmarkUrl = block.bookmark.url;
      const bookmarkCaption = blockToString(block.bookmark.caption) || bookmarkUrl;
      return `[${bookmarkCaption}](${bookmarkUrl})`;
    case 'bulleted_list_item':
      return `* ${blockMarkdown}`;
    case 'child_page':
      if (block.has_children) return childPageToHtml(block);
      return '';
    case 'code':
      `\`\`\`${block.code.language}\n${blockMarkdown}\n\`\`\`${childMarkdown}`;
    case 'column':
      return `<div class="notion-column-block">${childMarkdown}</div>`;
    case 'column_list':
      return `<div class="notion-column-list-block">${childMarkdown}</div>`;
    case 'divider':
      return '---';
    case 'embed':
      return captionize(
        `<iframe src="${block.embed.url}"></iframe>`,
        blockToString(block.embed.caption),
      );
    case 'heading_1':
    case 'heading_2':
    case 'heading_3':
      const headingLevel = Number(block.type.split('_')[1]);
      const headingSymbol = (lowerTitleLevel ? '#' : '') + '#'.repeat(headingLevel);
      return `${headingSymbol} ${blockMarkdown}`;
    case 'image':
      const imageUrl =
        block.image.type == 'external' ? block.image.external.url : block.image.file.url;
      return `![${blockToString(block.image.caption)}](${imageUrl})`;
    case 'numbered_list_item':
      return `1. ${blockMarkdown}`;
    case 'paragraph':
      return blockMarkdown;
    case 'quote':
      return `> ${blockMarkdown}`;
    case 'to_do':
      return `- [${block.to_do.checked ? 'x' : ' '}] ${blockMarkdown}`;
    case 'toggle':
      return `<details><summary>${blockMarkdown}</summary>${childMarkdown}</details>`;
    case 'video':
      const url = block.video.type === 'external' ? block.video.external.url : block.video.file.url;
      const videoCaption = blockToString(block.video.caption).trim();
      if (block.video.type === 'file')
        return captionize(
          `<video controls><source src="${url}">${videoCaption}</video>`,
          videoCaption,
        );
      const youtubeUrl = getYoutubeUrl(url);
      if (youtubeUrl !== null)
        return captionize(
          `<iframe width="100%" height="600" src="${youtubeUrl}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
          videoCaption,
        );

      return notionBlockComment(
        block,
        `External video (${url}) is not supported yet: please upload video file directly or to youtube.`,
      );

    // TODO: Add support for table, callouts, and files
    default:
      return notionBlockComment(block);
  }
};
