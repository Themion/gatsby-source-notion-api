/**
 * indicates if a property is accessible
 * @param property a property returned from Notion API
 * @returns whether it is accessible
 */
const isPropertyAccessible = (property) => {
  return !!property.type;
};

exports.isPropertyAccessible = isPropertyAccessible;

/**
 * get useful user information
 * @param user a user property returned from Notion API
 * @returns its content
 */
exports.getPropertyContentFromUser = (user) => {
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
};
/**
 * get the url of a file property
 * @param file a file property returned from Notion API
 * @returns its url
 */
exports.getPropertyContentFromFile = (file) => {
  if (file.type === 'external') {
    return file.external.url;
  } else if (file.type === 'file') {
    return file.file.url;
  } else {
    throw new TypeError(`unknown file type`);
  }
};

/**
 * extract the content from a formula property
 * @param formula a formula property returned from Notion API
 * @returns its content
 */
exports.getPropertyContentFromFormula = (formula) => {
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
};

/**
 * get the content from a formula property
 * @param rollup a formula property returned from Notion API
 * @returns its content
 */
exports.getPropertyContentFromRollup = (rollup) => {
  switch (rollup.type) {
    case 'number':
      return rollup.number;
    case 'date':
      return rollup.date;
    case 'array':
      return rollup.array.map(
        (item) => (getPropertyContent < 'people') | 'title' | ('rich_text' > item),
      );
    /* istanbul ignore next */
    default:
      throw new TypeError(`unknown rollup property`);
  }
};
