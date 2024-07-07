import React from "react"

import { graphql } from "gatsby"

const DetailPage = ({ data }) => {
  console.log(data.markdownRemark)
  return <div dangerouslySetInnerHTML={{ __html: data.markdownRemark.html }} />
}

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
