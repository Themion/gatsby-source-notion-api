const { blockToString } = require('../block-to-string');

exports.getNotionPageProperties = (page) =>
  Object.entries(page.properties).reduce((acc, [key, value]) => {
    if (value.type == 'title') {
      return acc;
    }

    if (value.type == 'rich_text') {
      value.rich_text = blockToString(value.rich_text);
    }

    return {
      ...acc,
      [key]: {
        id: value.id,
        key,
        value: value[value.type],
        type: value.type,
      },
    };
  }, {});
