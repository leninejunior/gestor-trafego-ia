export type SquadChannel = 'meta' | 'google'

export type TimelineEntry = {
  at: string
  event: string
  detail?: string
}

export type ReadyCreativeInput = {
  type: 'image' | 'video' | 'copy' | 'video-script' | 'headline' | 'primary-text'
  title: string
  storageUrl?: string
  publicUrl?: string
  content?: string
  fileName?: string
  mimeType?: string
}

export type LlmConfig = {
  id: string
  organizationId: string
  provider: string
  model: string
  tokenReference: string
  agentRole?: string
  temperature?: number
  maxTokens?: number
  fallbackModel?: string | null
}

export type SquadRun = {
  id: string
  organizationId: string
  clientId: string
  planName?: string | null
  mode?: 'legacy' | 'conversational'
  idea?: string | null
  campaignName: string
  objective: string
  budget: { amount: number; currency: string } | null
  channels: SquadChannel[]
  status: string
  stage: string
  allowAutoRefine: boolean
  refinementCount: number
  qaLoopCount?: number
  llmConfigId: string | null
  llmSnapshot?: {
    id?: string
    provider?: string
    model?: string
    tokenReference?: string
    temperature?: number
    maxTokens?: number
    fallbackModel?: string | null
  } | null
  approvalId: string | null
  readyCreatives?: ReadyCreativeInput[]
  planDraft?: Record<string, unknown> | null
  approvedPlan?: Record<string, unknown> | null
  contextSnapshot?: Record<string, unknown> | null
  messages?: Array<{
    id: string
    role: 'system' | 'assistant' | 'user'
    phase?: string
    content: string
    createdAt: string
  }>
  executionTasks?: Array<{
    id: string
    type: 'creative' | 'qa' | 'publish' | string
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | string
    title?: string
    channel?: SquadChannel | string | null
    campaignId?: string | null
    loopCount?: number
    error?: string
    externalIds?: Record<string, unknown> | null
    agent?: {
      id?: string
      role?: string
      label?: string
      specialty?: string
      assignedAt?: string
      llm?: {
        provider?: string | null
        model?: string | null
      }
    } | null
    createdAt?: string
    updatedAt?: string
    completedAt?: string
  }>
  timeline: TimelineEntry[]
  creativeBatch?: {
    id: string
    iteration: number
    assets?: Array<{
      id: string
      type: string
      title: string
      content?: string
      storageUrl?: string
      publicUrl?: string | null
      campaignId?: string | null
      channel?: SquadChannel | string | null
      agent?: {
        id?: string
        role?: string
        label?: string
        specialty?: string
      } | null
    }>
  } | null
  publishResult?: {
    publishedAt?: string
    channels?: Array<{
      channel: SquadChannel
      success: boolean
      reason?: string
      campaignId?: string
      adSetId?: string
    }>
  } | null
  createdAt?: string
  updatedAt?: string
}

export type SquadSchedule = {
  id: string
  organizationId: string
  clientId: string
  cadence: 'monthly' | 'weekly'
  timezone: string
  dayOfMonth: number
  hour: number
  minute: number
  nextRunAt: string | null
  payloadTemplate?: Record<string, unknown>
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type ClientSummary = {
  id: string
  name: string
  organization_id?: string | null
  organization_name?: string | null
}

export type ServiceHealth = {
  ok: boolean
  queueMode: string
  timestamp: string
}

export function datetimeLocalFromNow(minutesAhead = 5): string {
  const date = new Date(Date.now() + minutesAhead * 60_000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function normalizeError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback

  const candidate = payload as { error?: unknown; detail?: unknown }
  if (typeof candidate.error === 'string' && candidate.error.trim().length > 0) return candidate.error
  if (typeof candidate.detail === 'string' && candidate.detail.trim().length > 0) return candidate.detail
  return fallback
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(normalizeError(body, `Falha na requisição (${response.status}).`))
  }

  return body as T
}

export function runStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'completed') return 'default'
  if (status === 'failed' || status === 'rejected' || status === 'needs_manual_intervention') return 'destructive'
  if (status === 'awaiting_approval' || status === 'awaiting_plan_approval' || status === 'publishing' || status === 'qa_review') return 'secondary'
  return 'outline'
}

export function parsePublicationConfig(rawJson: string): Record<string, unknown> | undefined {
  if (!rawJson.trim()) return undefined
  const parsed = JSON.parse(rawJson)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('publicationConfig precisa ser um objeto JSON.')
  }
  return parsed as Record<string, unknown>
}
