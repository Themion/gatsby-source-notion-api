/**
 * Configure your Gatsby site with this file.
 *
 * See: https://www.gatsbyjs.com/docs/reference/config-files/gatsby-config/
 */

/**
 * @type {import('gatsby').GatsbyConfig}
 */
const dotenv = require("dotenv")
const { default: slugify } = require("slugify")

dotenv.config()

/**
 * @type {import('@themion/gatsby-source-notion-api').NotionSourceOptions}
 */
const notionSourceOption = {
  token: process.env.NOTION_TOKEN,
  databaseId: process.env.NOTION_DATABASE,
  devServerRefreshInterval: 10000,
  keyConverter: ({ type, name }) => {
    if (type === "people") return "person"
    if (name === "slug_temp") return "slug"
    return name
  },
  valueConverter: ({ type, value }) => {
    if (value === null) return value
    switch (type) {
      case "date":
        return value.start
      case "select":
      case "status":
      case "multi_select":
        return value.name
      default:
        return value
    }
  },
  slugOptions: {
    key: "slug",
    generator: ({ name }) => ({
      notionKey: "slug_temp",
      value: slugify(name).toLowerCase(),
    }),
  },
}

module.exports = {
  siteMetadata: {
    title: `Gatsby Default Starter`,
    description: `Kick off your next, great Gatsby project with this default starter. This barebones starter ships with the main Gatsby configuration files you might need.`,
    author: `@gatsbyjs`,
    siteUrl: `https://gatsbystarterdefaultsource.gatsbyjs.io/`,
  },
  plugins: [
    `gatsby-transformer-remark`,
    {
      resolve: `@themion/gatsby-source-notion-api`,
      options: notionSourceOption,
    },
  ],
}
