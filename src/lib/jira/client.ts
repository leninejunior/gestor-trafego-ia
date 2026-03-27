type JiraIssueType = 'Epic' | 'Story' | 'Task' | string

export type JiraIssueFields = {
  project: { key: string }
  summary: string
  description?: unknown
  issuetype: { name: JiraIssueType }
  labels?: string[]
  priority?: { name: string }
  parent?: { key: string }
  [key: string]: unknown
}

type JiraSearchIssue = {
  id: string
  key: string
  fields?: {
    summary?: string
  }
}

type JiraSearchResponse = {
  issues?: JiraSearchIssue[]
}

type JiraCreateResponse = {
  id: string
  key: string
  self: string
}

export type JiraClientConfig = {
  baseUrl: string
  email: string
  apiToken: string
}

function trimSlash(value: string): string {
  return value.replace(/\/$/, '')
}

export function getJiraConfigFromEnv(): JiraClientConfig | null {
  const baseUrl = process.env.JIRA_BASE_URL?.trim() || ''
  const email = process.env.JIRA_EMAIL?.trim() || ''
  const apiToken = process.env.JIRA_API_TOKEN?.trim() || ''

  if (!baseUrl || !email || !apiToken) {
    return null
  }

  return {
    baseUrl: trimSlash(baseUrl),
    email,
    apiToken
  }
}

export class JiraClient {
  private readonly baseUrl: string
  private readonly authHeader: string

  constructor(config: JiraClientConfig) {
    this.baseUrl = trimSlash(config.baseUrl)
    this.authHeader = `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: this.authHeader,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init?.headers || {})
      },
      cache: 'no-store'
    })

    const text = await response.text()
    const payload = text ? JSON.parse(text) : {}

    if (!response.ok) {
      const message =
        (payload?.errorMessages && Array.isArray(payload.errorMessages) && payload.errorMessages[0]) ||
        payload?.message ||
        `Jira request failed (${response.status})`
      throw new Error(typeof message === 'string' ? message : `Jira request failed (${response.status})`)
    }

    return payload as T
  }

  async searchIssueByExactSummary(projectKey: string, summary: string): Promise<JiraSearchIssue | null> {
    const escapedSummary = summary.replace(/"/g, '\\"')
    const jql = `project = "${projectKey}" AND summary ~ "\\"${escapedSummary}\\""`
    const query = new URLSearchParams({
      jql,
      maxResults: '20',
      fields: 'summary'
    }).toString()

    const response = await this.request<JiraSearchResponse>(`/rest/api/3/search?${query}`, { method: 'GET' })
    const issues = Array.isArray(response.issues) ? response.issues : []
    const exact = issues.find((issue) => issue.fields?.summary?.trim() === summary.trim())
    return exact || null
  }

  async createIssue(fields: JiraIssueFields): Promise<JiraCreateResponse> {
    return this.request<JiraCreateResponse>('/rest/api/3/issue', {
      method: 'POST',
      body: JSON.stringify({ fields })
    })
  }
}

