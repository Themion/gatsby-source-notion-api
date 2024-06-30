import { blockToString } from '../block-to-string';
import { NotionPage } from '../types';

type TitleProperty = Extract<NotionPage['properties'][string], { type: 'title' }>;

const getTitleProperty = (properties: NotionPage['properties']) =>
  Object.values(properties).find(({ type }) => type === 'title') as TitleProperty | undefined;

export const getNotionPageTitle = (page: NotionPage) =>
  blockToString(getTitleProperty(page.properties)?.title ?? []);
