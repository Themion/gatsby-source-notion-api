import { APIErrorCode, Client, isNotionClientError } from '@notionhq/client';
import { Reporter } from 'gatsby';
import { FetchNotionData, Options } from '~/types';
import { mapAwaited, wait } from '~/utils';

class FetchWrapper {
  constructor(
    { token, notionVersion = '2022-06-28' }: Options,
    private readonly reporter: Reporter,
    private readonly client: Client = new Client({ auth: token, notionVersion }),
  ) {}

  async waitAndLogWithNotionError(error: unknown) {
    if (!isNotionClientError(error)) {
      this.reporter.error('Unknwon Error has thrown!');
      throw error;
    }

    switch (error.name) {
      case 'APIResponseError':
        switch (error.code) {
          case APIErrorCode.RateLimited:
            const retryAfter = parseInt((error.headers as Headers).get('retry-after') ?? '60', 10);
            this.reporter.warn(
              `API Rate Limit reached! retrying after ${Math.floor(retryAfter)} seconds...`,
            );
            await wait(retryAfter * 1000);
            return;
          case APIErrorCode.InternalServerError:
          case APIErrorCode.ServiceUnavailable:
            this.reporter.warn('Server-side error is thrown! retrying after 30 seconds...');
            await wait(1000 * 30);
            return;
          default:
            this.reporter.error(error);
        }
        break;
      case 'RequestTimeoutError':
        this.reporter.warn('Request Timeout error is thrown! retrying after 30 seconds...');
        await wait(1000 * 30);
        return;
      case 'UnknownHTTPResponseError':
        this.reporter.error(error);
        break;
    }
    throw error;
  }

  async fetchWithErrorHandler<T>(fetch: (client: Client) => T) {
    do {
      try {
        return await fetch(this.client);
      } catch (error) {
        await this.waitAndLogWithNotionError(error);
      }
    } while (true);
  }

  async fetchAll<T, U extends T, V>(
    fetchPartial: FetchNotionData<T>,
    resultFilterer: (item: T) => item is U,
    addContent: (item: U, index?: number, list?: U[]) => Promise<V>,
    chunkSize?: number | undefined,
    useReturnValue: boolean = true,
  ): Promise<V[]> {
    const dataList: V[] = [];
    let cursor: string | null = null;

    do {
      const { results, next_cursor } = await this.fetchWithErrorHandler((client) =>
        fetchPartial(client, cursor),
      );

      const filteredResults = results.filter(resultFilterer);
      const mappedResults: V[] = await mapAwaited(
        filteredResults,
        addContent,
        chunkSize ?? filteredResults.length,
      );
      if (useReturnValue) dataList.push(...mappedResults);
      cursor = next_cursor;
    } while (cursor != null);

    return dataList;
  }
}

export default FetchWrapper;
