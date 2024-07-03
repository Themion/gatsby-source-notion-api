import type { KeyConverter, NormalizedValue, Page, ValueConverter } from '../types';
import { getPropertyContent } from '../utils';

export const pageToProperties =
  (valueConverter: ValueConverter, keyConverter: KeyConverter) =>
  ({ properties }: Page): Record<string, NormalizedValue> =>
    Object.entries(properties).reduce((acc, [name, property]) => {
      const propertyValue = getPropertyContent(property);
      const argument = { ...property, name, value: propertyValue, properties };
      const key = keyConverter(argument);
      return key === null
        ? acc
        : {
            ...acc,
            [key]: valueConverter(argument),
          };
    }, {});
