import { NotionAPIList } from '../types';

/**
 * get all records from a method that need to be called multiple times to get all the paginated records
 * @param fn a Notion client function that returns paginated results
 * @param arg arguments for the function
 * @returns complete list of records
 */
export async function getAll<A extends object>(
  fn2: (arg: { page_size: number; start_cursor: string | undefined } & A) => Promise<NotionAPIList>,
  arg: A,
): Promise<NotionAPIList['results']> {
  const state: { next: string | undefined; hasMore: boolean } = {
    next: undefined,
    hasMore: true,
  };
  const entities: NotionAPIList['results'] = [];

  while (state.hasMore) {
    const { has_more, next_cursor, results } = await fn2({
      ...arg,
      page_size: 100,
      start_cursor: state.next,
    });

    // update the current state
    Object.assign(state, { hasMore: has_more, next: next_cursor ?? undefined });

    // push the results to the list
    entities.push(...results);
  }

  return entities;
}
