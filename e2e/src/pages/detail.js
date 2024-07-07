import { graphql } from "gatsby"
import React from "react"

import "./detail.css"

const DetailPage = ({ data }) => (
  <div dangerouslySetInnerHTML={{ __html: data.markdownRemark.html }} />
)

export const query = graphql`
  query IndexPage($id: String) {
    markdownRemark(id: { eq: $id }) {
      id
      frontmatter {
        name
      }
      html
    }
  }
`

export default DetailPage
