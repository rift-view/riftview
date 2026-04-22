import type { LinearClient } from '@riftview/automation-core'

const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql'

export function linearApiClient(apiKey = process.env.LINEAR_API_KEY): LinearClient {
  if (!apiKey) throw new Error('LINEAR_API_KEY env is required for linearApiClient')
  return {
    async listLabels(issueId) {
      const data = await gql(apiKey, ISSUE_LABELS_QUERY, { id: issueId })
      return (
        (data.issue as { labels: { nodes: Array<{ name: string }> } } | null)?.labels?.nodes?.map(
          (n: { name: string }) => n.name
        ) ?? []
      )
    },
    async addLabel(issueId, label) {
      // Linear labels are resolved by name → id; find or create
      const labelId = await findLabelIdByName(apiKey, issueId, label)
      await gql(apiKey, ADD_LABEL_MUTATION, { id: issueId, labelIds: [labelId] })
    },
    async removeLabel(issueId, label) {
      const labelId = await findLabelIdByName(apiKey, issueId, label)
      await gql(apiKey, REMOVE_LABEL_MUTATION, { id: issueId, labelIds: [labelId] })
    },
    async postComment(issueId, body) {
      await gql(apiKey, CREATE_COMMENT_MUTATION, { input: { issueId, body } })
    },
    async listComments(issueId) {
      const data = await gql(apiKey, COMMENTS_QUERY, { id: issueId })
      return (
        (
          data.issue as {
            comments: { nodes: Array<{ id: string; body: string; createdAt: string }> }
          } | null
        )?.comments?.nodes ?? []
      ).map((n: { id: string; body: string; createdAt: string }) => ({
        id: n.id,
        body: n.body,
        createdAt: n.createdAt
      }))
    }
  }
}

async function gql(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(LINEAR_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey
    },
    body: JSON.stringify({ query, variables })
  })
  if (!res.ok) throw new Error(`Linear API ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as { data?: Record<string, unknown>; errors?: unknown }
  if (json.errors) throw new Error(`Linear GraphQL errors: ${JSON.stringify(json.errors)}`)
  return json.data ?? {}
}

async function findLabelIdByName(
  apiKey: string,
  issueId: string,
  labelName: string
): Promise<string> {
  const data = await gql(apiKey, ISSUE_TEAM_LABELS_QUERY, { id: issueId })
  const issue = data.issue as { team: { labels: { nodes: Array<{ id: string; name: string }> } } }
  const found = issue.team.labels.nodes.find((l) => l.name === labelName)
  if (!found) throw new Error(`Linear label "${labelName}" does not exist on team`)
  return found.id
}

const ISSUE_LABELS_QUERY = `query ($id: String!) { issue(id: $id) { labels { nodes { name } } } }`
const ISSUE_TEAM_LABELS_QUERY = `query ($id: String!) { issue(id: $id) { team { labels(first: 250) { nodes { id name } } } } }`
const COMMENTS_QUERY = `query ($id: String!) { issue(id: $id) { comments(first: 250, orderBy: createdAt) { nodes { id body createdAt } } } }`
const ADD_LABEL_MUTATION = `mutation ($id: String!, $labelIds: [String!]!) { issueAddLabel(id: $id, labelIds: $labelIds) { success } }`
const REMOVE_LABEL_MUTATION = `mutation ($id: String!, $labelIds: [String!]!) { issueRemoveLabel(id: $id, labelIds: $labelIds) { success } }`
const CREATE_COMMENT_MUTATION = `mutation ($input: CommentCreateInput!) { commentCreate(input: $input) { success } }`
