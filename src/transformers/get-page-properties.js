const { blockToString } = require('../block-to-string');
const {
  isPropertyAccessible,
  getPropertyContentFromUser,
  getPropertyContentFromFile,
  getPropertyContentFromFormula,
  getPropertyContentFromRollup,
} = require('../utils');

const getPropertyValue = (property) => {
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
      return property.select?.name ?? null;
    case 'multi_select':
      return property.multi_select.map((value) => value.name);
    case 'status':
      return property.status.name;
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
    // @ts-expect-error Notion has unsupported property type in the past and also maybe in future
    case 'relation':
      return null;
    case 'button':
      return null;
    case 'unsupported':
      return null;
    /* istanbul ignore next */
    default:
      throw new TypeError(`unknown property`);
  }
};

exports.getNotionPageProperties = (page, reporter) =>
  Object.entries(page.properties).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: getPropertyValue(value),
    }),
    {},
  );
