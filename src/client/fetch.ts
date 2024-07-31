import { APIErrorCode, isNotionClientError } from '@notionhq/client';
import { Reporter } from 'gatsby';
import { FetchNotionData } from '~/types';
import { wait } from '~/utils';

class FetchWrapper {
  constructor(private readonly reporter: Reporter) {}

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

  async fetchWithErrorHandler<T>(fetch: () => T) {
    do {
      try {
        return await fetch();
      } catch (error) {
        await this.waitAndLogWithNotionError(error);
      }
    } while (true);
  }

  async fetchAll<T>(fetch: FetchNotionData<T>) {
    const dataList: T[] = [];
    let cursor: string | null = null;

    do {
      const { nextCursor, data } = await this.fetchWithErrorHandler(() => fetch(cursor));
      dataList.push(...data);
      cursor = nextCursor;
    } while (cursor != null);

    return dataList;
  }
}

export default FetchWrapper;
