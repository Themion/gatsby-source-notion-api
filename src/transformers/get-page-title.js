const { blockToString } = require('../block-to-string');

const getTitleProperty = (properties) =>
	Object.values(properties).find(({ type }) => type === 'title');

exports.getNotionPageTitle = (page) => blockToString(getTitleProperty(page.properties).title);
