/**
 * Configure your Gatsby site with this file.
 *
 * See: https://www.gatsbyjs.com/docs/reference/config-files/gatsby-config/
 */

/**
 * @type {import('gatsby').GatsbyConfig}
 */
const dotenv = require("dotenv")

dotenv.config()

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
      options: {
        token: process.env.NOTION_TOKEN,
        databaseId: process.env.NOTION_DATABASE,
        keyConverter: ({ type, name }) => {
          if (type === "people") return "person"
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
      },
    },
  ],
}
