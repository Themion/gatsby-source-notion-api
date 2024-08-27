import { RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';
import { NodePluginArgs, Reporter } from 'gatsby';
import { blockToString } from '~/block-to-string';
import type { Block, Options, Page } from '~/types';
import { getBlockProperty } from '~/utils';
import { childPageToHtml } from './child-page-to-html';
import { getYoutubeUrl } from './get-youtube-url';

type BlockProperty = ReturnType<typeof getBlockProperty>;
type ApiColor = Extract<Block, { type: 'paragraph' }>['paragraph']['color'];

const BR = '<br>';
const MEDIA_FILE_ERROR_MESSAGE =
  'Media file stored in Notion will last only for 1 hour! Consider using link embed, or disable gatsby cache.';

const notionBlockComment = (
  block: Block,
  reporter: Reporter,
  comment: string = `Block type '${block.type}' is not supported yet.`,
) => {
  reporter.warn(comment);
  return `<!-- ${comment} -->`;
};

const htmlClass = (classname: string) => `class="notion-${classname.replaceAll('_', '-')}-block"`;
const notionColor = (color: ApiColor) => (color === 'default' ? '' : `notion-color="${color}"`);

const captionize = (content: string, caption: string = '') => {
  const figureClass = htmlClass('figure');
  const captionClass = htmlClass('figcaption');
  return caption === ''
    ? content
    : `<figure ${figureClass}>${content}<figcaption ${captionClass}>${caption}</figcaption></figure>`;
};

const ifHasRichText = (
  property: BlockProperty,
): property is Extract<BlockProperty, { rich_text: RichTextItemResponse[] }> =>
  Object.keys({ ...property }).includes('rich_text');
const getBlockMarkdown = (block: Block): RichTextItemResponse[] => {
  const property = getBlockProperty(block);
  return ifHasRichText(property) ? property.rich_text : [];
};

// Converts a notion block to a markdown string.
const notionBlockToMarkdown = (
  block: Block,
  nodePluginArgs: NodePluginArgs,
  options: Options,
  parentBlock: Block | null = null,
): string => {
  const { lowerTitleLevel = true } = options;

  const childMarkdown =
    block.has_children === true
      ? block.children
          .map((child) => notionBlockToMarkdown(child, nodePluginArgs, options, block))
          .join('\n\n')
          .trim()
      : '';

  // Extract the remaining content of the block and combine it with its children.
  const blockMarkdown = blockToString(getBlockMarkdown(block), block.type !== 'code')
    .trim()
    .replaceAll('\n', block.type === 'code' ? '\n' : BR);
  const blockClass = htmlClass(block.type);

  switch (block.type) {
    case 'audio':
      if (block.audio.type === 'file' && options.cacheOptions?.enabled) {
        nodePluginArgs.reporter.panicOnBuild(MEDIA_FILE_ERROR_MESSAGE);
        throw MEDIA_FILE_ERROR_MESSAGE;
      }
      const audioUrl =
        block.audio.type == 'external' ? block.audio.external.url : block.audio.file.url;
      return `<audio ${blockClass} controls><source src="${audioUrl}" /></audio>`;
    case 'bookmark':
      const bookmarkUrl = block.bookmark.url;
      const bookmarkCaption = blockToString(block.bookmark.caption) || bookmarkUrl;
      return `[${bookmarkCaption}](${block.bookmark.url})`;
    case 'bulleted_list_item':
      return `<ul><li ${notionColor(block.bulleted_list_item.color)}>${blockMarkdown}</li></ul>`;
    case 'child_page':
      if (block.has_children) return childPageToHtml(block);
      return '';
    case 'code':
      return `\`\`\`${block.code.language}\n${blockMarkdown}\n\`\`\``;
    case 'column':
      return `<div ${blockClass}>${childMarkdown}</div>`;
    case 'column_list':
      return `<div ${blockClass}>${childMarkdown.replaceAll('</div>\n\n<div', '</div><div')}</div>`;
    case 'divider':
      return '<hr>';
    case 'embed':
      return captionize(
        `<iframe ${blockClass} src="${block.embed.url}"></iframe>`,
        blockToString(block.embed.caption),
      );
    case 'heading_1':
    case 'heading_2':
    case 'heading_3':
      const headingLevel = parseInt(block.type.split('_')[1], 10) + (lowerTitleLevel ? 1 : 0);
      const headingContent = blockMarkdown === '' ? BR : blockMarkdown;
      const headingColor: ApiColor = (() => {
        switch (block.type) {
          case 'heading_1':
            return block.heading_1.color;
          case 'heading_2':
            return block.heading_2.color;
          case 'heading_3':
            return block.heading_3.color;
        }
      })();
      return `<h${headingLevel} ${notionColor(headingColor)}>${headingContent}</h${headingLevel}>`;
    case 'image':
      if (block.image.type === 'file' && options.cacheOptions?.enabled) {
        nodePluginArgs.reporter.panicOnBuild(MEDIA_FILE_ERROR_MESSAGE);
        throw MEDIA_FILE_ERROR_MESSAGE;
      }
      const imageUrl =
        block.image.type == 'external' ? block.image.external.url : block.image.file.url;
      const imageExt = imageUrl.split('.').at(-1) ?? imageUrl;
      const caption = blockToString(block.image.caption);
      return ['gif'].includes(imageExt)
        ? `<figure><img src="${imageUrl}" alt="${caption}"><figcaption>${caption}</figcaption></figure>`
        : `![${caption}](${imageUrl})`;
    case 'numbered_list_item':
      return `<ol><li ${notionColor(block.numbered_list_item.color)}>${blockMarkdown}</li></ol>`;
    case 'paragraph':
      return `<p ${notionColor(block.paragraph.color)}>${
        blockMarkdown === '' ? BR : blockMarkdown
      }</p>`;
    case 'quote':
      return `<blockquote ${notionColor(block.quote.color)}>${blockMarkdown}</blockquote>`;
    case 'table':
      const tableContent = childMarkdown.replaceAll(/\n+/g, '\n');
      const table = `<table>\n${tableContent}\n</table>`;
      return table;
    case 'table_row':
      if (parentBlock?.type !== 'table' || !parentBlock.has_children) return '';

      const { has_row_header, has_column_header } = parentBlock.table;
      const isHeaderRow = has_row_header && block.id === parentBlock.children[0].id;
      const isHeaderColumn = (i: number) => has_column_header && i === 0;
      const isHeaderCell = (i: number) => isHeaderRow || isHeaderColumn(i);

      const cells = block.table_row.cells
        .map((block) => blockToString(block))
        .map((cell, i) => (isHeaderCell(i) ? `<th>${cell}</th>` : `<td>${cell}</td>`));

      return `<tr>${cells.join('')}</tr>`;
    case 'to_do':
      const checked = block.to_do.checked ? 'checked' : '';
      return `<input type="checkbox" ${checked} disabled>${blockMarkdown}</input>`;
    case 'toggle':
      const detailsClass = htmlClass('details');
      const summaryClass = htmlClass('summary');
      const toggleColor = notionColor(block.toggle.color);
      return `<details ${toggleColor} ${detailsClass}><summary ${summaryClass}>${blockMarkdown}</summary>${childMarkdown}</details>`;
    case 'video':
      if (block.video.type === 'file' && options.cacheOptions?.enabled) {
        nodePluginArgs.reporter.panicOnBuild(MEDIA_FILE_ERROR_MESSAGE);
        throw MEDIA_FILE_ERROR_MESSAGE;
      }
      const url = block.video.type === 'external' ? block.video.external.url : block.video.file.url;
      const videoCaption = blockToString(block.video.caption).trim();
      if (block.video.type === 'file')
        return captionize(
          `<video ${blockClass} controls><source src="${url}">${videoCaption}</video>`,
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
        nodePluginArgs.reporter,
        `External video (${url}) is not supported yet: please upload video file directly or to youtube.`,
      );

    // TODO: Add support for callouts, and files
    default:
      return notionBlockComment(block, nodePluginArgs.reporter);
  }
};

export const notionPageToMarkdown = (
  page: Page,
  nodePluginArgs: NodePluginArgs,
  options: Options,
) =>
  page.children
    .map((child) => notionBlockToMarkdown(child, nodePluginArgs, options))
    .join('\n\n')
    .replaceAll('</ul>\n\n<ul>', '')
    .replaceAll('</ol>\n\n<ol>', '')
    .trim();
