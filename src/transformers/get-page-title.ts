import { blockToString } from '~/block-to-string';
import type { Page } from '~/types';

type TitleProperty = Extract<Page['properties'][string], { type: 'title' }>;

const getTitleProperty = (properties: Page['properties']) =>
  Object.values(properties).find(({ type }) => type === 'title') as TitleProperty | undefined;

export const getNotionPageTitle = (page: Page) =>
  blockToString(getTitleProperty(page.properties)?.title ?? []);
