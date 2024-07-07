/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.com/docs/reference/config-files/gatsby-node/
 */

const { resolve } = require("node:path")

/**
 * @type {import('gatsby').GatsbyNode['createPages']}
 */
exports.createPages = async ({ actions, graphql }) => {
  const { createPage } = actions

  const list = await graphql(`
    query GatsbyNode {
      allMarkdownRemark {
        nodes {
          id
        }
      }
    }
  `)

  list.data.allMarkdownRemark.nodes.forEach(({ id }) => {
    createPage({
      path: `/${id}`,
      component: resolve("./src/pages/detail.js"),
      context: { id },
    })
  })
}
