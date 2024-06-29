export * from './client';

export const isFulfilled = <T>(result: PromiseSettledResult<T>) => result.status === 'fulfilled';

/**
 * indicates if a property is accessible
 * @param property a property returned from Notion API
 * @returns whether it is accessible
 */
export function isPropertyAccessible<
  P extends {
    id: string;
    type?: string;
  },
>(property: P): property is Extract<P, { type: string }> {
  return !!property.type;
}

/**
 * indicates if a property is supported by Notion API
 * @param property a property returned from Notion API
 * @returns whether it is supported
 */
export function isPropertySupported<
  P extends {
    id: string;
    type?: string;
  },
>(property: P): property is Exclude<P, Extract<P, { type: 'unsupported' }>> {
  return property.type !== 'unsupported';
}

/**
 * indicates if a database or page is accessible
 * @param page a database or page returned from Notion API
 * @returns whether it is accessible
 */
export function isPageAccessible<
  P extends {
    id: string;
    object: string;
    url?: string;
  },
>(page: P): page is Extract<P, { url: string }> {
  return !!page.url;
}
