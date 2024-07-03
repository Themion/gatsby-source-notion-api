import type { NormalizedValue, Page, ValueConverter } from '../types';
import { getPropertyContent } from '../utils';

export const pageToProperties =
  (converter: ValueConverter) =>
  ({ properties }: Page): Record<string, NormalizedValue> =>
    Object.entries(properties).reduce((acc, [name, property]) => {
      const value = getPropertyContent(property);
      return {
        ...acc,
        [name]: converter({ ...property, name, value, properties }),
      };
    }, {});
