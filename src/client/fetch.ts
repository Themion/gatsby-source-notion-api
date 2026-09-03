import { APIErrorCode, Client, isNotionClientError, NotionClientError } from '@notionhq/client';
import { QueryClient } from '@tanstack/query-core';
import { Reporter } from 'gatsby';
import { FetchNotionData, Options } from '~/types';
import { mapAwaited } from '~/utils';

const DEFAULT_RETRY_DELAY_MS = 30_000;
const DEFAULT_RATE_LIMIT_RETRY_SECONDS = 60;

// Notion's error type doesn't type `headers`, but responses use the standard fetch `Headers` object.
const getRetryAfterSeconds = (headers: unknown) => {
  if (!(headers instanceof Headers)) return null;
  const retryAfter = headers.get('retry-after');
  return retryAfter === null ? null : parseInt(retryAfter, 10);
};

// null means "don't retry"; otherwise the number of ms to wait before retrying.
const getNotionRetryDelayMs = (error: NotionClientError): number | null => {
  switch (error.name) {
    case 'APIResponseError':
      switch (error.code) {
        case APIErrorCode.RateLimited:
          return (getRetryAfterSeconds(error.headers) ?? DEFAULT_RATE_LIMIT_RETRY_SECONDS) * 1000;
        case APIErrorCode.InternalServerError:
        case APIErrorCode.ServiceUnavailable:
          return DEFAULT_RETRY_DELAY_MS;
        default:
          return null;
      }
    case 'RequestTimeoutError':
      return DEFAULT_RETRY_DELAY_MS;
    default:
      return null;
  }
};

class FetchWrapper {
  private readonly queryClient: QueryClient;
  private fetchCount = 0;

  constructor(
    { token, notionVersion = '2022-06-28' }: Options,
    private readonly reporter: Reporter,
    private readonly client: Client = new Client({ auth: token, notionVersion }),
  ) {
    this.queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          // Every call gets its own queryKey, so nothing is ever re-read from the cache: drop
          // entries as soon as they settle instead of letting them pile up over a long build.
          gcTime: 0,
          retry: (_failureCount, error) => {
            if (!isNotionClientError(error)) {
              this.reporter.error(`Unknwon Error has thrown! ${String(error)}`);
              return false;
            }

            const delayMs = getNotionRetryDelayMs(error);
            if (delayMs === null) {
              this.reporter.error(error);
              return false;
            }

            this.reporter.warn(
              `Notion API error (${error.name}). retrying after ${delayMs / 1000} seconds...`,
            );
            return true;
          },
          retryDelay: (_failureCount, error) => {
            if (!isNotionClientError(error)) return 0;
            return getNotionRetryDelayMs(error) ?? 0;
          },
        },
      },
    });
  }

  async fetchWithErrorHandler<T>(fetch: (client: Client) => Promise<T>): Promise<T> {
    return this.queryClient.query({
      queryKey: ['notion-fetch', this.fetchCount++],
      queryFn: () => fetch(this.client),
    });
  }

  async fetchAll<T, U extends T, V>(
    fetchPartial: FetchNotionData<T>,
    resultFilterer: (item: T) => item is U,
    addContent: (item: U, index?: number, list?: U[]) => Promise<V>,
    chunkSize?: number | undefined,
    useReturnValue: boolean = true,
  ): Promise<V[]> {
    const { pages } = await this.queryClient.infiniteQuery({
      queryKey: ['notion-fetch-all', this.fetchCount++],
      queryFn: ({ pageParam }) => fetchPartial(this.client, pageParam),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage) => lastPage.next_cursor,
      pages: Infinity,
    });

    const filteredResults = pages.flatMap((page) => page.results).filter(resultFilterer);
    const mappedResults = await mapAwaited(
      filteredResults,
      addContent,
      chunkSize ?? filteredResults.length,
    );

    return useReturnValue ? mappedResults : [];
  }
}

export default FetchWrapper;
