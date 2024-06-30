import type { Page } from '../types';
import { getPropertyContent } from '../utils';

export const getNotionPageProperties = (page: Page) =>
  Object.entries(page.properties).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: getPropertyContent(value),
    }),
    {},
  );
