import { graphql, Link } from "gatsby"
import React from "react"

export const query = graphql`
  query IndexPage {
    allMarkdownRemark(sort: { frontmatter: { ID: ASC } }) {
      nodes {
        id
        frontmatter {
          name
        }
      }
    }
  }
`

const IndexPage = ({ data }) => {
  const { nodes } = data.allMarkdownRemark

  return (
    <div>
      <ul>
        {nodes.map(({ id, frontmatter }) => (
          <li>
            <Link to={id}>{frontmatter.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default IndexPage
