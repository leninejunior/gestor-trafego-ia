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
  campaignName: string
  objective: string
  budget: { amount: number; currency: string }
  channels: SquadChannel[]
  status: string
  stage: string
  allowAutoRefine: boolean
  refinementCount: number
  llmConfigId: string | null
  approvalId: string | null
  readyCreatives?: ReadyCreativeInput[]
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
  if (status === 'failed' || status === 'rejected') return 'destructive'
  if (status === 'awaiting_approval' || status === 'publishing') return 'secondary'
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
