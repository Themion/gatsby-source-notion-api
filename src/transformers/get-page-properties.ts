import type { NormalizedValue, Page } from '../types';
import { getPropertyContent } from '../utils';

export const getNotionPageProperties = (page: Page): Record<string, NormalizedValue> =>
  Object.entries(page.properties).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: getPropertyContent(value),
    }),
    {},
  );
