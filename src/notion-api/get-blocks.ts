import { Client } from '@notionhq/client';
import type { Reporter } from 'gatsby';
import { errorMessage } from '../error-message';
import type { Block } from '../types';
import { isFulfilled, isPropertyAccessible, isPropertySupported } from '../utils';

type GetBlockOption = {
  id: string;
  notionVersion: string;
  token: string;
  reporter: Reporter;
};

export const getBlocks = async ({ id, token, notionVersion, reporter }: GetBlockOption) => {
  const notion = new Client({ auth: token, notionVersion });
  const blockContent: Block[] = [];
  let startCursor: string | null = null;

  const getBlock = async (id: string, cursor: string | null = null) => {
    const result = await notion.blocks.children.list({
      block_id: id,
      start_cursor: cursor ?? undefined,
    });

    const results = result.results.filter(isPropertyAccessible).filter(isPropertySupported);

    const blocks = await Promise.allSettled(
      results.map(
        async (block): Promise<Block> => ({
          ...block,
          ...(block.has_children
            ? { has_children: true, children: (await getBlock(block.id)).blocks }
            : { has_children: false }),
        }),
      ),
    );

    return {
      blocks: blocks.filter(isFulfilled).map(({ value }) => value),
      nextCursor: result.next_cursor,
    };
  };

  do {
    try {
      const { blocks, nextCursor } = await getBlock(id, startCursor);
      blockContent.push(...blocks);
      startCursor = nextCursor;
    } catch (e) {
      reporter.panic(errorMessage);
    }
  } while (!!startCursor);

  return blockContent;
};
