import { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';
import type {
  NotionAPIBlock,
  NotionAPIDatabase,
  NotionAPIPage,
  NotionAPIPropertyValue,
  NotionAPIUser,
} from './notion';

export * from './notion';

/*
 * Helper
 */

export type FetchNotionData<T> = (
  cursor: string | null,
) => Promise<{ nextCursor: string | null; data: T[] }>;

export type EntityWithUserDetail<E extends NotionAPIBlock | NotionAPIDatabase | NotionAPIPage> =
  E extends any
    ? Omit<E, 'created_by' | 'last_edited_by'> & {
        created_by: NotionAPIUser | null;
        last_edited_by: NotionAPIUser | null;
      }
    : never;

/*
 * Property
 */

export type Date = {
  start: string;
  end: string | null;
  time_zone: string | null;
};

export type File = {
  name: string | null;
  url: string;
};

export type Person = {
  name: string | null;
  avatar: string | null;
  email: string | null;
};

export type SelectColor = NonNullable<
  Extract<NotionAPIPropertyValue, { type: 'select' }>['select']
>['color'];

export type Select = {
  name: string;
  color: SelectColor;
};

export type NormalizedValue =
  | null
  | boolean
  | number
  | string
  | string[]
  | Date
  | File
  | Person
  | Select
  | NormalizedValue[];

/*
 * Block
 */

export type Block = NotionAPIBlock &
  ({ has_children: false } | { has_children: true; children: Block[] });

/*
 * Page & Database
 */

export type Metadata = {
  url: string;
  createdByAvatar: string | null;
  createdByEmail: string | null;
  createdByName: string | null;
  createdTime: string;
  lastEditedByAvatar: string | null;
  lastEditedByEmail: string | null;
  lastEditedByName: string | null;
  lastEditedTime: string;
  coverImage: string | null;
  iconEmoji: string | null;
  iconImage: string | null;
};

export type Page = NotionAPIPage & {
  children: Block[];
};

export type Database = {
  id: string;
  object: NotionAPIDatabase['object'];
  parent: NotionAPIDatabase['parent'];
  title: string;
  metadata: Metadata;
  pages: Page[];
};

/*
 * Cache
 */

export type CacheType = 'block';
export type CachePayloadType = {
  block: Block[];
};
export type Cached<T extends CacheType> = {
  cachedTime: number;
  expiresAt: number | null;
  payload: CachePayloadType[T];
};

type ConverterArgument = {
  name: string;
  value: NormalizedValue;
  properties: Page['properties'];
} & Page['properties']['string'];

export type KeyConverter = (argument: ConverterArgument) => string | null;
export type ValueConverter = (argument: ConverterArgument) => NormalizedValue;
export type SlugGenerator = (
  properties: Record<string, NormalizedValue>,
  page: Page,
) => {
  notionKey: string;
  value: string;
  url?: string;
};
export type SlugOptions = {
  key: string;
  generator?: SlugGenerator;
};
export type CacheOptions =
  | {
      enabled: false;
    }
  | {
      enabled: true;
      maxAge?: number;
    };

export type Options = {
  token: string;
  databaseId: string;
  notionVersion?: string;
  filter?: NonNullable<QueryDatabaseParameters['filter']>;
  propsToFrontmatter?: boolean;
  lowerTitleLevel?: boolean;
  devServerRefreshInterval?: number;
  slugOptions?: SlugOptions;
  cacheOptions?: CacheOptions;
  keyConverter?: KeyConverter;
  valueConverter?: ValueConverter;
};
