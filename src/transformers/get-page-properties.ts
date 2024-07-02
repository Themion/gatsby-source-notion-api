import type { Converter, NormalizedValue, Page } from '../types';
import { getPropertyContent } from '../utils';

export const pageToProperties =
  (converter: Converter) =>
  ({ properties }: Page): Record<string, NormalizedValue> =>
    Object.entries(properties).reduce((acc, [name, property]) => {
      const value = getPropertyContent(property);
      return {
        ...acc,
        [name]: converter({ ...property, name, value, properties }),
      };
    }, {});
