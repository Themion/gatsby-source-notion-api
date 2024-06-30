import type { NotionPage } from '../types';
import { getPropertyContent } from '../utils';

export const getNotionPageProperties = (page: NotionPage) =>
  Object.entries(page.properties).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: getPropertyContent(value),
    }),
    {},
  );
