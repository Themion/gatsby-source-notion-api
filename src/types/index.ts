import type {
  NotionAPIBlock,
  NotionAPIDatabase,
  NotionAPIPage,
  NotionAPIPropertyValue,
  NotionAPIUser,
} from './notion';

/*
 * Helper
 */

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

export type NotionDate = {
  start: string;
  end: string | null;
  time_zone: string | null;
};

export type NotionFile = {
  name: string | null;
  url: string;
};

export type NotionPerson = {
  name: string | null;
  avatar: string | null;
  email: string | null;
};

type OptionColor = NonNullable<
  Extract<NotionAPIPropertyValue, { type: 'select' }>['select']
>['color'];

export type NotionOption = {
  name: string;
  color: OptionColor;
};

export type NormalizedNotionValue =
  | null
  | boolean
  | number
  | string
  | string[]
  | NotionDate
  | NotionFile
  | NotionPerson
  | NotionOption
  | NormalizedNotionValue[];

/*
 * Block
 */

export type NotionBlock = NotionAPIBlock &
  ({ has_children: false } | { has_children: true; children: NotionBlock[] });

/*
 * Page & Database
 */

export type NotionMetadata = {
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

export type NotionPage = NotionAPIPage & {
  children: NotionBlock[];
};

export type NotionDatabase = {
  id: string;
  object: NotionAPIDatabase['object'];
  parent: NotionAPIDatabase['parent'];
  title: string;
  metadata: NotionMetadata;
  pages: NotionPage[];
};
