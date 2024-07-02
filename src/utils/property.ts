import { blockToString } from '../block-to-string';
import {
  InaccessibleNotionAPIUser,
  NormalizedValue,
  NotionAPIFile,
  NotionAPIPropertyValue,
  NotionAPIPropertyValueWithoutID,
  NotionAPIUser,
  Person,
} from '../types';

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

export const getPropertyContent = (
  property: NotionAPIPropertyValueWithoutID<NotionAPIPropertyValue>,
): NormalizedValue => {
  switch (property.type) {
    case 'unique_id':
      return property.unique_id.number;
    case 'title':
      return blockToString(property.title);
    case 'rich_text':
      return blockToString(property.rich_text);
    case 'number':
      return property.number;
    case 'select':
      return property.select;
    case 'multi_select':
      return property.multi_select;
    case 'status':
      return property.status;
    case 'date':
      return property.date;
    case 'people':
      return property.people
        .filter(isPropertyAccessible)
        .map(getPropertyContentFromUser)
        .filter((user) => !!user);
    case 'files':
      return property.files.map((file) => ({
        name: file.name,
        url: getPropertyContentFromFile(file),
      }));
    case 'checkbox':
      return property.checkbox;
    case 'url':
      return property.url;
    case 'email':
      return property.email;
    case 'phone_number':
      return property.phone_number;
    case 'formula':
      return getPropertyContentFromFormula(property.formula);
    case 'rollup':
      return getPropertyContentFromRollup(property.rollup);
    case 'created_by':
      return getPropertyContentFromUser(property.created_by);
    case 'created_time':
      return property.created_time;
    case 'last_edited_by':
      return getPropertyContentFromUser(property.last_edited_by);
    case 'last_edited_time':
      return property.last_edited_time;
    default:
      console.warn(`Property type '${property.type}' is not supported yet.`);
      return null;
  }
};

/**
 * get the url of a file property
 * @param file a file property returned from Notion API
 * @returns its url
 */
export function getPropertyContentFromFile(file: NotionAPIFile): string {
  if (file.type === 'external') {
    return file.external.url;
  } else if (file.type === 'file') {
    return file.file.url;
  } else {
    throw new TypeError(`unknown file type`);
  }
}

/**
 * extract the content from a formula property
 * @param formula a formula property returned from Notion API
 * @returns its content
 */
export function getPropertyContentFromFormula(
  formula: Extract<NotionAPIPropertyValue, { type: 'formula' }>['formula'],
): NormalizedValue {
  switch (formula.type) {
    case 'string':
      return formula.string;
    case 'number':
      return formula.number;
    case 'boolean':
      return formula.boolean;
    case 'date':
      return formula.date;
    /* istanbul ignore next */
    default:
      throw new TypeError(`unknown formula property`);
  }
}

/**
 * get the content from a formula property
 * @param rollup a formula property returned from Notion API
 * @returns its content
 */
export function getPropertyContentFromRollup(
  rollup: Extract<NotionAPIPropertyValue, { type: 'rollup' }>['rollup'],
): NormalizedValue {
  switch (rollup.type) {
    case 'number':
      return rollup.number;
    case 'date':
      return rollup.date;
    case 'array':
      return rollup.array.map((item) => getPropertyContent(item));
    /* istanbul ignore next */
    default:
      throw new TypeError(`unknown rollup property`);
  }
}

/**
 * get useful user information
 * @param user a user property returned from Notion API
 * @returns its content
 */
export function getPropertyContentFromUser(
  user: NotionAPIUser | InaccessibleNotionAPIUser | null,
): Person | null {
  if (!user || !isPropertyAccessible(user)) {
    return null;
  }

  if (user.type === 'person') {
    // extract user information from a real user
    return {
      name: user.name,
      avatar: user.avatar_url,
      email: user.person.email ?? null,
    };
  } else if (user.bot.owner.type === 'user') {
    // extract user information from a bot authorized by a user (i.e. not an internal integration)
    return getPropertyContentFromUser(user.bot.owner.user);
  }

  return null;
}
