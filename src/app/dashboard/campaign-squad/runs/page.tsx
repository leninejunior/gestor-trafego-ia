'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  type ClientSummary,
  type LlmConfig,
  type ReadyCreativeInput,
  type SquadChannel,
  type SquadRun,
  parsePublicationConfig,
  requestJson,
  runStatusVariant
} from '@/lib/campaign-squad/dashboard'
import { CheckCircle2, Clock3, GripVertical, MessageSquare, RefreshCw, Rocket, ShieldCheck, XCircle } from 'lucide-react'
import { CampaignSquadShell } from '../_components/campaign-squad-shell'
import { ReadyCreativesBuilder } from '../_components/ready-creatives-builder'

type RunFormState = {
  organizationId: string
  clientId: string
  campaignName: string
  objective: string
  budgetAmount: string
  budgetCurrency: string
  includeMeta: boolean
  includeGoogle: boolean
  allowAutoRefine: boolean
  llmConfigId: string
  publicationConfigJson: string
}

type OrganizationSummary = {
  id: string
  name: string
}

type EditableCampaign = {
  id: string
  name: string
  channel: 'meta' | 'google'
  objective: string
  startDate: string
  creativesPlanned: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => asString(item))
    .filter((item): item is string => item !== null)
}

function resolveCreativePreviewUrl(primary?: string | null, fallback?: string | null): string | null {
  const candidate = (primary || fallback || '').trim()
  if (!candidate) return null
  if (/^https?:\/\//i.test(candidate)) return candidate

  const s3Match = candidate.match(/^s3:\/\/([^/]+)\/(.+)$/i)
  if (!s3Match) return null

  const bucket = s3Match[1]
  const key = s3Match[2]
  const minioBase = (process.env.NEXT_PUBLIC_MINIO_PUBLIC_BASE_URL || 'http://localhost:9000').replace(/\/$/, '')
  return `${minioBase}/${bucket}/${key}`
}

function extractActivePlanFromRun(run: SquadRun | null): Record<string, unknown> | null {
  if (!run) return null
  const candidate = run.stage === 'awaiting_plan_approval'
    ? run.planDraft
    : (run.approvedPlan || run.planDraft)
  return asRecord(candidate)
}

function resolveRunPlanName(run: SquadRun | null): string {
  if (!run) return 'Planejamento sem nome'
  const plan = extractActivePlanFromRun(run)
  return asString(plan?.planName) || run.campaignName || 'Planejamento sem nome'
}

function toDateInputValue(raw: string | null | undefined): string {
  if (!raw) return ''
  const directMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (directMatch) return directMatch[1]

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function CampaignSquadRunsPage() {
  const { toast } = useToast()
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([])
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loadingClients, setLoadingClients] = useState(false)

  const [runForm, setRunForm] = useState<RunFormState>({
    organizationId: 'default',
    clientId: '',
    campaignName: '',
    objective: 'Leads',
    budgetAmount: '1000',
    budgetCurrency: 'BRL',
    includeMeta: true,
    includeGoogle: false,
    allowAutoRefine: true,
    llmConfigId: '',
    publicationConfigJson: ''
  })

  const [readyCreatives, setReadyCreatives] = useState<ReadyCreativeInput[]>([])
  const [llmConfigs, setLlmConfigs] = useState<LlmConfig[]>([])
  const [loadingLlmConfigs, setLoadingLlmConfigs] = useState(false)

  const [trackedRunId, setTrackedRunId] = useState('')
  const [runData, setRunData] = useState<SquadRun | null>(null)
  const [runsCatalog, setRunsCatalog] = useState<SquadRun[]>([])
  const [loadingRunsCatalog, setLoadingRunsCatalog] = useState(false)
  const [runsSearch, setRunsSearch] = useState('')
  const [approvalFeedback, setApprovalFeedback] = useState('')
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [whatsappMessage, setWhatsappMessage] = useState('')
  const [conversationIdea, setConversationIdea] = useState('')
  const [conversationMessage, setConversationMessage] = useState('')
  const [manualPlanName, setManualPlanName] = useState('')
  const [manualPlanSummary, setManualPlanSummary] = useState('')
  const [manualBudgetAmount, setManualBudgetAmount] = useState('')
  const [manualBudgetCurrency, setManualBudgetCurrency] = useState('BRL')
  const [manualCampaigns, setManualCampaigns] = useState<EditableCampaign[]>([])

  const [submittingRun, setSubmittingRun] = useState(false)
  const [startingConversationalRun, setStartingConversationalRun] = useState(false)
  const [sendingConversationMessage, setSendingConversationMessage] = useState(false)
  const [processingPlanApproval, setProcessingPlanApproval] = useState(false)
  const [processingFinalApproval, setProcessingFinalApproval] = useState(false)
  const [savingManualPlan, setSavingManualPlan] = useState(false)
  const [showLegacyForm, setShowLegacyForm] = useState(false)
  const [refreshingRun, setRefreshingRun] = useState(false)
  const [processingApproval, setProcessingApproval] = useState(false)
  const [sharingWhatsapp, setSharingWhatsapp] = useState(false)

  const selectedChannels = useMemo(() => {
    const channels: SquadChannel[] = []
    if (runForm.includeMeta) channels.push('meta')
    if (runForm.includeGoogle) channels.push('google')
    return channels
  }, [runForm.includeGoogle, runForm.includeMeta])

  const clientsForSelectedOrganization = useMemo(
    () => clients.filter((client) => client.organization_id === runForm.organizationId),
    [clients, runForm.organizationId]
  )

  const trackedOrganizationName = useMemo(() => {
    if (!runData?.organizationId) return null
    return organizations.find((organization) => organization.id === runData.organizationId)?.name || null
  }, [organizations, runData?.organizationId])

  const trackedClientName = useMemo(() => {
    if (!runData?.clientId) return null
    return clients.find((client) => client.id === runData.clientId)?.name || null
  }, [clients, runData?.clientId])
  const organizationNameById = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization.name])),
    [organizations]
  )
  const clientNameById = useMemo(
    () => new Map(clients.map((client) => [client.id, client.name])),
    [clients]
  )

  const activePlan = useMemo(() => {
    return extractActivePlanFromRun(runData)
  }, [runData])
  const activePlanName = useMemo(() => resolveRunPlanName(runData), [runData])

  const planSummary = asString(activePlan?.summary) || 'Resumo estrategico ainda indisponivel.'
  const planChannels = asStringArray(activePlan?.channels)
  const planBudget = asRecord(activePlan?.budget)
  const planSchedule = asRecord(activePlan?.schedule)
  const planQaPolicy = asRecord(activePlan?.qaPolicy)
  const planContextUsed = asRecord(activePlan?.contextUsed)
  const planCampaigns = Array.isArray(activePlan?.campaigns)
    ? activePlan.campaigns.map((entry) => asRecord(entry)).filter((entry): entry is Record<string, unknown> => entry !== null)
    : []
  const filteredRunsCatalog = useMemo(() => {
    const normalized = runsSearch.trim().toLowerCase()
    if (!normalized) return runsCatalog
    return runsCatalog.filter((run) => {
      const planName = resolveRunPlanName(run).toLowerCase()
      return planName.includes(normalized) || run.id.toLowerCase().includes(normalized)
    })
  }, [runsCatalog, runsSearch])

  const copyAssets = (runData?.creativeBatch?.assets || []).filter((asset) =>
    ['copy', 'headline', 'primary-text', 'video-script'].includes(asset.type)
  )
  const contextBrandVoice = asString(planContextUsed?.brand_voice) || asString(planContextUsed?.brandVoice)
  const contextValueProps = asString(planContextUsed?.value_props) || asString(planContextUsed?.valueProps)
  const contextOffers = asString(planContextUsed?.offers)
  const planBudgetAmount = asNumber(planBudget?.amount)
  const planBudgetCurrency = asString(planBudget?.currency)
  const planStartDate = asString(planSchedule?.startDate)
  const planCadence = asString(planSchedule?.cadence)
  const planDurationDays = asNumber(planSchedule?.durationDays)
  const planMaxQaLoops = asNumber(planQaPolicy?.maxLoopsPerTask)
  const creativeAssets = runData?.creativeBatch?.assets || []
  const hierarchyCampaigns = useMemo(() => {
    return planCampaigns.map((campaign, index) => {
      const campaignId = asString(campaign.id)
      const campaignChannel = asString(campaign.channel)
      const relatedAssets = creativeAssets.filter((asset) => {
        const sameCampaign = campaignId && asset.campaignId ? asset.campaignId === campaignId : false
        const sameChannel = campaignChannel && asset.channel ? asset.channel === campaignChannel : false
        return sameCampaign || sameChannel
      })

      return {
        id: campaignId || `campaign-${index}`,
        name: asString(campaign.name) || `Campanha ${index + 1}`,
        channel: campaignChannel || '-',
        objective: asString(campaign.objective) || runData?.objective || '-',
        startDate: asString(campaign.startDate) || '-',
        creativesPlanned: asNumber(campaign.creativesPlanned),
        assets: relatedAssets
      }
    })
  }, [creativeAssets, planCampaigns, runData?.objective])
  const mediaAssets = creativeAssets.filter((asset) => ['image', 'video'].includes(asset.type))
  const hasPlan = Boolean(activePlan)
  const hasPublished = (runData?.publishResult?.channels || []).some((channel) => channel.success)
  const planAgentRuntime = asRecord(activePlan?.agentRuntime)
  const planStageOwners = asRecord(planAgentRuntime?.stageOwners)
  const rosterFromPlan = Array.isArray(planAgentRuntime?.roster)
    ? planAgentRuntime.roster.map((item) => asRecord(item)).filter((item): item is Record<string, unknown> => item !== null)
    : []
  const taskAgents = (runData?.executionTasks || [])
    .map((task) => asRecord(task.agent))
    .filter((agent): agent is Record<string, unknown> => agent !== null)
  const assetAgents = creativeAssets
    .map((asset) => asRecord(asset.agent))
    .filter((agent): agent is Record<string, unknown> => agent !== null)
  const runtimeAgentsByRole = new Map<string, Record<string, unknown>>()
  for (const agent of [...rosterFromPlan, ...taskAgents, ...assetAgents]) {
    const role = asString(agent.role)
    if (!role) continue
    if (!runtimeAgentsByRole.has(role)) runtimeAgentsByRole.set(role, agent)
  }
  const getRuntimeAgent = (role: string, stageKey?: string): Record<string, unknown> | null => {
    if (stageKey) {
      const fromStage = asRecord(planStageOwners?.[stageKey])
      if (fromStage) return fromStage
    }
    return runtimeAgentsByRole.get(role) || null
  }
  const strategistAgent = getRuntimeAgent('strategist', 'strategy')
  const copywriterAgent = getRuntimeAgent('copywriter', 'copy')
  const designerAgent = getRuntimeAgent('designer', 'creative')
  const trafficManagerAgent = getRuntimeAgent('traffic_manager', 'traffic')
  const qaPublisherAgent = getRuntimeAgent('qa_publisher', 'qa')

  const loadClients = useCallback(async () => {
    setLoadingClients(true)
    try {
      const data = await requestJson<{
        clients: Array<{
          id: string
          name: string
          organization_id?: string | null
          organization_name?: string | null
        }>
        organizations?: Array<{ id: string; name: string }>
        organizationId?: string | null
      }>('/api/dashboard/clients')

      const fetchedClients = Array.isArray(data.clients) ? data.clients : []
      setClients(fetchedClients)

      const fetchedOrganizations = Array.isArray(data.organizations) ? data.organizations : []
      const derivedOrganizations = fetchedOrganizations.length > 0
        ? fetchedOrganizations
        : Array.from(
            new Map(
              fetchedClients
                .filter((client) => client.organization_id && client.organization_name)
                .map((client) => [client.organization_id as string, { id: client.organization_id as string, name: client.organization_name as string }])
            ).values()
          )
      setOrganizations(derivedOrganizations)

      const suggestedOrg = typeof data.organizationId === 'string' && data.organizationId.trim().length > 0
        ? data.organizationId
        : null
      setRunForm((prev) => {
        const organizationIds = new Set(derivedOrganizations.map((organization) => organization.id))
        const fallbackOrganizationId = derivedOrganizations[0]?.id || ''

        let nextOrganizationId = prev.organizationId
        if (!nextOrganizationId || nextOrganizationId === 'default') {
          nextOrganizationId = suggestedOrg && organizationIds.has(suggestedOrg) ? suggestedOrg : fallbackOrganizationId
        } else if (!organizationIds.has(nextOrganizationId)) {
          nextOrganizationId = suggestedOrg && organizationIds.has(suggestedOrg) ? suggestedOrg : fallbackOrganizationId
        }

        const clientsInOrganization = fetchedClients.filter((client) => client.organization_id === nextOrganizationId)
        const nextClientId = clientsInOrganization.some((client) => client.id === prev.clientId)
          ? prev.clientId
          : (clientsInOrganization[0]?.id || '')

        return {
          ...prev,
          organizationId: nextOrganizationId,
          clientId: nextClientId
        }
      })
    } catch (error) {
      toast({
        title: 'Falha ao carregar clientes',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setLoadingClients(false)
    }
  }, [toast])

  const loadLlmConfigs = useCallback(async (organizationId: string) => {
    if (!organizationId.trim() || organizationId === 'default') return
    setLoadingLlmConfigs(true)
    try {
      const query = new URLSearchParams({ organizationId }).toString()
      const data = await requestJson<{ data: LlmConfig[] }>(`/api/campaign-squad/llm-configs?${query}`)
      setLlmConfigs(Array.isArray(data.data) ? data.data : [])
    } catch (error) {
      toast({
        title: 'Falha ao listar configurações LLM',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setLoadingLlmConfigs(false)
    }
  }, [toast])

  const refreshRun = useCallback(async (runId: string) => {
    if (!runId.trim()) return
    setRefreshingRun(true)
    try {
      const run = await requestJson<SquadRun>(`/api/campaign-squad/runs/${runId}`)
      setRunData(run)
      setTrackedRunId(run.id)
      setManualPlanName(resolveRunPlanName(run))
      const runPlan = extractActivePlanFromRun(run)
      setManualPlanSummary(asString(runPlan?.summary) || '')
      setManualBudgetAmount(String(asNumber(asRecord(runPlan?.budget)?.amount) ?? asNumber(run.budget?.amount) ?? ''))
      setManualBudgetCurrency(asString(asRecord(runPlan?.budget)?.currency) || run.budget?.currency || 'BRL')
    } catch (error) {
      toast({
        title: 'Run não encontrado',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setRefreshingRun(false)
    }
  }, [toast])

  const loadRunsCatalog = useCallback(async () => {
    if (!runForm.organizationId.trim() || runForm.organizationId === 'default') {
      setRunsCatalog([])
      return
    }

    setLoadingRunsCatalog(true)
    try {
      const query = new URLSearchParams({
        organizationId: runForm.organizationId.trim(),
        limit: '120'
      })

      if (runForm.clientId.trim()) {
        query.set('clientId', runForm.clientId.trim())
      }

      const data = await requestJson<{ data: SquadRun[] }>(`/api/campaign-squad/runs?${query.toString()}`)
      setRunsCatalog(Array.isArray(data.data) ? data.data : [])
    } catch (error) {
      toast({
        title: 'Falha ao carregar planejamentos',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setLoadingRunsCatalog(false)
    }
  }, [runForm.clientId, runForm.organizationId, toast])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  useEffect(() => {
    loadLlmConfigs(runForm.organizationId)
  }, [loadLlmConfigs, runForm.organizationId])

  useEffect(() => {
    loadRunsCatalog()
  }, [loadRunsCatalog])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const runIdFromQuery = new URLSearchParams(window.location.search).get('runId')?.trim()
    if (!runIdFromQuery) return
    setTrackedRunId(runIdFromQuery)
    void refreshRun(runIdFromQuery)
  }, [refreshRun])

  useEffect(() => {
    setRunForm((prev) => {
      const clientsInOrganization = clients.filter((client) => client.organization_id === prev.organizationId)
      if (clientsInOrganization.length === 0) {
        if (!prev.clientId) return prev
        return { ...prev, clientId: '' }
      }

      const hasSelectedClient = clientsInOrganization.some((client) => client.id === prev.clientId)
      if (hasSelectedClient) return prev
      return { ...prev, clientId: clientsInOrganization[0].id }
    })
  }, [clients, runForm.organizationId])

  useEffect(() => {
    if (!runData) {
      setManualPlanName('')
      setManualPlanSummary('')
      setManualBudgetAmount('')
      setManualBudgetCurrency('BRL')
      setManualCampaigns([])
      return
    }

    const runPlan = extractActivePlanFromRun(runData)
    setManualPlanName(resolveRunPlanName(runData))
    setManualPlanSummary(asString(runPlan?.summary) || '')
    setManualBudgetAmount(String(asNumber(asRecord(runPlan?.budget)?.amount) ?? asNumber(runData.budget?.amount) ?? ''))
    setManualBudgetCurrency(asString(asRecord(runPlan?.budget)?.currency) || runData.budget?.currency || 'BRL')

    const nextCampaigns = planCampaigns.map((campaign, index) => {
      const existingId = asString(campaign.id) || `${runData.id}-planned-${index + 1}`
      const channel = asString(campaign.channel)
      return {
        id: existingId,
        name: asString(campaign.name) || `Campanha planejada ${index + 1}`,
        channel: channel === 'google' ? 'google' : 'meta',
        objective: asString(campaign.objective) || runData.objective || '',
        startDate: toDateInputValue(asString(campaign.startDate)),
        creativesPlanned: String(asNumber(campaign.creativesPlanned) ?? '')
      } as EditableCampaign
    })

    setManualCampaigns(nextCampaigns)
  }, [runData?.id, runData?.updatedAt])

  const handleCreateRun = async () => {
    if (!runForm.organizationId.trim() || !runForm.clientId.trim() || !runForm.campaignName.trim()) {
      toast({ title: 'Preencha organização, cliente e nome da campanha', variant: 'destructive' })
      return
    }
    if (selectedChannels.length === 0) {
      toast({ title: 'Selecione ao menos um canal (Meta ou Google)', variant: 'destructive' })
      return
    }

    const budgetAmount = Number(runForm.budgetAmount)
    if (!Number.isFinite(budgetAmount) || budgetAmount <= 0) {
      toast({ title: 'Orçamento inválido', description: 'Informe um valor maior que zero.', variant: 'destructive' })
      return
    }

    setSubmittingRun(true)
    try {
      const publicationConfig = parsePublicationConfig(runForm.publicationConfigJson)

      const created = await requestJson<SquadRun>('/api/campaign-squad/runs', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: runForm.organizationId.trim(),
          clientId: runForm.clientId.trim(),
          campaignName: runForm.campaignName.trim(),
          objective: runForm.objective.trim(),
          budget: {
            amount: budgetAmount,
            currency: runForm.budgetCurrency.trim().toUpperCase()
          },
          channels: selectedChannels,
          allowAutoRefine: runForm.allowAutoRefine,
          llmConfigId: runForm.llmConfigId || undefined,
          publicationConfig,
          readyCreatives: readyCreatives.length > 0 ? readyCreatives : undefined
        })
      })

      setRunData(created)
      setTrackedRunId(created.id)
      void loadRunsCatalog()
      toast({
        title: 'Run criado',
        description: `ID: ${created.id}`
      })
    } catch (error) {
      toast({
        title: 'Falha ao criar run',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setSubmittingRun(false)
    }
  }

  const handleStartConversationalRun = async () => {
    if (!runForm.organizationId.trim() || !runForm.clientId.trim()) {
      toast({ title: 'Selecione conta e cliente para iniciar conversa', variant: 'destructive' })
      return
    }
    if (!runForm.campaignName.trim()) {
      toast({ title: 'Informe o nome do planejamento', variant: 'destructive' })
      return
    }
    if (!conversationIdea.trim()) {
      toast({ title: 'Descreva a ideia inicial da campanha', variant: 'destructive' })
      return
    }

    setStartingConversationalRun(true)
    try {
      const created = await requestJson<SquadRun>('/api/campaign-squad/runs', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: runForm.organizationId.trim(),
          clientId: runForm.clientId.trim(),
          campaignName: runForm.campaignName.trim(),
          mode: 'conversational',
          idea: conversationIdea.trim(),
          llmConfigId: runForm.llmConfigId || undefined
        })
      })

      setRunData(created)
      setTrackedRunId(created.id)
      setConversationMessage('')
      void loadRunsCatalog()
      toast({
        title: 'Run conversacional iniciado',
        description: `ID: ${created.id}`
      })
    } catch (error) {
      toast({
        title: 'Falha ao iniciar run conversacional',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setStartingConversationalRun(false)
    }
  }

  const handleSendConversationMessage = async () => {
    if (!runData?.id) return
    if (!conversationMessage.trim()) return

    setSendingConversationMessage(true)
    try {
      const updated = await requestJson<SquadRun>(`/api/campaign-squad/runs/${runData.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: conversationMessage.trim()
        })
      })
      setRunData(updated)
      setTrackedRunId(updated.id)
      setConversationMessage('')
      void loadRunsCatalog()
    } catch (error) {
      toast({
        title: 'Falha ao enviar mensagem',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setSendingConversationMessage(false)
    }
  }

  const handlePlanApproval = async (action: 'approve' | 'revise') => {
    if (!runData?.id) return
    setProcessingPlanApproval(true)
    try {
      const updated = await requestJson<SquadRun>(`/api/campaign-squad/runs/${runData.id}/plan-approval`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          feedback: approvalFeedback.trim() || undefined
        })
      })
      setRunData(updated)
      setTrackedRunId(updated.id)
      void loadRunsCatalog()
      toast({
        title: action === 'approve' ? 'Plano aprovado' : 'Revisao solicitada',
        description: action === 'approve'
          ? 'Execucao automatica iniciada.'
          : 'O run voltou para etapa de briefing.'
      })
    } catch (error) {
      toast({
        title: 'Falha ao processar plano',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setProcessingPlanApproval(false)
    }
  }

  const handleFinalApproval = async (action: 'approve' | 'revise') => {
    if (!runData?.id) return
    setProcessingFinalApproval(true)
    try {
      const updated = await requestJson<SquadRun>(`/api/campaign-squad/runs/${runData.id}/final-approval`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          feedback: approvalFeedback.trim() || undefined
        })
      })
      setRunData(updated)
      setTrackedRunId(updated.id)
      void loadRunsCatalog()
      toast({
        title: action === 'approve' ? 'Publicacao confirmada' : 'Refino solicitado',
        description: action === 'approve'
          ? 'O squad iniciou a publicacao nos canais configurados.'
          : 'O run voltou para execucao para ajustar criativos antes de publicar.'
      })
    } catch (error) {
      toast({
        title: 'Falha ao processar confirmacao final',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setProcessingFinalApproval(false)
    }
  }

  const handleApproval = async (action: 'approve' | 'reject') => {
    if (!runData?.approvalId) return

    setProcessingApproval(true)
    try {
      const updated = await requestJson<SquadRun>(`/api/campaign-squad/approvals/${runData.approvalId}`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          feedback: approvalFeedback.trim() || undefined
        })
      })

      setRunData(updated)
      setTrackedRunId(updated.id)
      void loadRunsCatalog()
      toast({
        title: action === 'approve' ? 'Peças aprovadas' : 'Peças reprovadas',
        description: action === 'approve'
          ? 'O squad iniciou a publicação.'
          : 'A política de refação foi aplicada conforme configuração.'
      })
    } catch (error) {
      toast({
        title: 'Falha ao processar aprovação',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setProcessingApproval(false)
    }
  }

  const handleSelectCatalogRun = async (runId: string) => {
    setTrackedRunId(runId)
    await refreshRun(runId)
  }

  const handleAddManualCampaign = () => {
    if (!runData) return
    const nextIndex = manualCampaigns.length + 1
    const template: EditableCampaign = {
      id: `${runData.id}-planned-new-${Date.now()}`,
      name: `Campanha planejada ${nextIndex}`,
      channel: 'meta',
      objective: runData.objective || 'Leads',
      startDate: '',
      creativesPlanned: '3'
    }
    setManualCampaigns((current) => [...current, template])
  }

  const handleRemoveManualCampaign = (campaignId: string) => {
    setManualCampaigns((current) => current.filter((campaign) => campaign.id !== campaignId))
  }

  const handleDuplicateManualCampaign = (campaignId: string) => {
    setManualCampaigns((current) => {
      const index = current.findIndex((campaign) => campaign.id === campaignId)
      if (index < 0) return current

      const source = current[index]
      const duplicate: EditableCampaign = {
        ...source,
        id: `${source.id}-copy-${Date.now()}`,
        name: `${source.name} (Copia)`
      }

      const next = Array.from(current)
      next.splice(index + 1, 0, duplicate)
      return next
    })
  }

  const handleUpdateManualCampaign = (
    campaignId: string,
    field: keyof EditableCampaign,
    value: string
  ) => {
    setManualCampaigns((current) =>
      current.map((campaign) =>
        campaign.id === campaignId
          ? { ...campaign, [field]: value }
          : campaign
      )
    )
  }

  const handleManualCampaignDragEnd = (result: DropResult) => {
    if (!result.destination) return
    if (result.destination.index === result.source.index) return

    setManualCampaigns((current) => {
      const reordered = Array.from(current)
      const [moved] = reordered.splice(result.source.index, 1)
      reordered.splice(result.destination!.index, 0, moved)
      return reordered
    })
  }

  const handleSaveManualPlan = async () => {
    if (!runData?.id) return

    const nextPlanName = manualPlanName.trim()
    const nextSummary = manualPlanSummary.trim()
    const nextBudgetAmount = manualBudgetAmount.trim()
    const nextBudgetCurrency = manualBudgetCurrency.trim().toUpperCase()

    if (!nextPlanName) {
      toast({
        title: 'Nome do planejamento obrigatorio',
        variant: 'destructive'
      })
      return
    }

    const payload: {
      planName?: string
      summary?: string
      budget?: { amount?: number; currency?: string }
      channels?: Array<'meta' | 'google'>
      campaigns?: Array<{
        id: string
        name: string
        channel: 'meta' | 'google'
        objective?: string
        startDate?: string
        creativesPlanned?: number
      }>
    } = {
      planName: nextPlanName
    }

    if (nextSummary) {
      payload.summary = nextSummary
    }

    if (nextBudgetAmount) {
      const parsedBudget = Number(nextBudgetAmount)
      if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
        toast({
          title: 'Orcamento invalido',
          description: 'Informe um valor de orcamento maior que zero.',
          variant: 'destructive'
        })
        return
      }

      payload.budget = {
        amount: parsedBudget,
        currency: nextBudgetCurrency || 'BRL'
      }
    } else if (nextBudgetCurrency) {
      payload.budget = {
        currency: nextBudgetCurrency
      }
    }

    const normalizedCampaigns = manualCampaigns
      .map((campaign, index) => {
        const parsedCreatives = Number(campaign.creativesPlanned || '')
        return {
          id: campaign.id || `${runData.id}-planned-${index + 1}`,
          name: campaign.name.trim(),
          channel: campaign.channel === 'google' ? 'google' : 'meta',
          objective: campaign.objective.trim() || undefined,
          startDate: campaign.startDate || undefined,
          creativesPlanned: Number.isFinite(parsedCreatives) && parsedCreatives > 0
            ? Math.floor(parsedCreatives)
            : undefined
        }
      })
      .filter((campaign) => campaign.name.length > 0)

    if (normalizedCampaigns.length > 0) {
      payload.campaigns = normalizedCampaigns
      payload.channels = Array.from(new Set(normalizedCampaigns.map((campaign) => campaign.channel)))
    }

    setSavingManualPlan(true)
    try {
      const updated = await requestJson<SquadRun>(`/api/campaign-squad/runs/${runData.id}/plan-draft`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      })
      setRunData(updated)
      setTrackedRunId(updated.id)
      void loadRunsCatalog()
      toast({
        title: 'Planejamento atualizado',
        description: 'Ajustes manuais aplicados com sucesso.'
      })
    } catch (error) {
      toast({
        title: 'Falha ao salvar ajustes do plano',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setSavingManualPlan(false)
    }
  }

  const handleShareWhatsapp = async () => {
    if (!runData) return
    if (!whatsappPhone.trim()) {
      toast({ title: 'Informe o número do WhatsApp', variant: 'destructive' })
      return
    }

    setSharingWhatsapp(true)
    try {
      const result = await requestJson<{ sentResult?: { sent?: boolean; reason?: string } }>(
        `/api/campaign-squad/runs/${runData.id}/share/whatsapp`,
        {
          method: 'POST',
          body: JSON.stringify({
            phone: whatsappPhone.trim(),
            customMessage: whatsappMessage.trim() || undefined
          })
        }
      )

      const sent = result.sentResult?.sent === true
      toast({
        title: sent ? 'Mensagem enviada no WhatsApp' : 'Envio registrado com falha',
        description: sent ? 'O usuário recebeu o link para aprovação.' : result.sentResult?.reason || 'Verifique as variáveis da Evolution API.'
      })
    } catch (error) {
      toast({
        title: 'Falha ao enviar WhatsApp',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setSharingWhatsapp(false)
    }
  }

  return (
    <CampaignSquadShell
      title="Runs conversacionais"
      description="Plano de marketing visual com etapas, agentes responsaveis e aprovacao final."
      actions={(
        <Button variant="outline" onClick={() => loadLlmConfigs(runForm.organizationId)} disabled={loadingLlmConfigs}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loadingLlmConfigs ? 'animate-spin' : ''}`} />
          Atualizar LLM
        </Button>
      )}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Planejamentos
            </CardTitle>
            <CardDescription>Clique no nome do planejamento para abrir a hierarquia de campanhas e aprovar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="filter-org">Conta</Label>
                <Select
                  value={runForm.organizationId}
                  onValueChange={(value) => setRunForm((prev) => ({ ...prev, organizationId: value }))}
                >
                  <SelectTrigger id="filter-org">
                    <SelectValue placeholder="Selecione uma conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((organization) => (
                      <SelectItem key={organization.id} value={organization.id}>
                        {organization.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-client">Cliente</Label>
                <Select
                  value={runForm.clientId}
                  onValueChange={(value) => setRunForm((prev) => ({ ...prev, clientId: value }))}
                >
                  <SelectTrigger id="filter-client">
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientsForSelectedOrganization.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
              <Input
                placeholder="Buscar por nome do planejamento ou ID"
                value={runsSearch}
                onChange={(event) => setRunsSearch(event.target.value)}
              />
              <Button variant="outline" onClick={loadRunsCatalog} disabled={loadingRunsCatalog}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loadingRunsCatalog ? 'animate-spin' : ''}`} />
                Atualizar lista
              </Button>
            </div>

            <div className="max-h-72 space-y-2 overflow-auto rounded-md border p-2">
              {loadingRunsCatalog ? (
                <p className="text-xs text-muted-foreground">Carregando planejamentos...</p>
              ) : filteredRunsCatalog.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum planejamento encontrado com os filtros atuais.</p>
              ) : (
                filteredRunsCatalog.map((run) => {
                  const runPlan = extractActivePlanFromRun(run)
                  const runPlanName = resolveRunPlanName(run)
                  const runCampaignCount = Array.isArray(runPlan?.campaigns) ? runPlan.campaigns.length : 0
                  const isActive = runData?.id === run.id

                  return (
                    <button
                      type="button"
                      key={run.id}
                      className={`w-full rounded-md border p-3 text-left transition ${isActive ? 'border-primary bg-primary/5' : 'bg-background hover:bg-muted/40'}`}
                      onClick={() => handleSelectCatalogRun(run.id)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{runPlanName}</p>
                        <Badge variant={runStatusVariant(run.status)}>{run.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {organizationNameById.get(run.organizationId) || run.organizationId} | {clientNameById.get(run.clientId) || run.clientId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Campanhas: {runCampaignCount} | Run: {run.id}
                      </p>
                    </button>
                  )
                })
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
              <Input
                placeholder="Abrir run por ID manualmente"
                value={trackedRunId}
                onChange={(event) => setTrackedRunId(event.target.value)}
              />
              <Button onClick={() => refreshRun(trackedRunId)} disabled={refreshingRun || !trackedRunId.trim()}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshingRun ? 'animate-spin' : ''}`} />
                Abrir
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRunData(null)
                  setTrackedRunId('')
                  setApprovalFeedback('')
                }}
              >
                Novo run
              </Button>
            </div>
          </CardContent>
        </Card>

        {!runData ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                Iniciar run conversacional
              </CardTitle>
              <CardDescription>Defina conta e cliente e descreva a ideia. O squad monta o plano automatico.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="conversation-org">Organizacao</Label>
                  <Select value={runForm.organizationId} onValueChange={(value) => setRunForm((prev) => ({ ...prev, organizationId: value }))}>
                    <SelectTrigger id="conversation-org">
                      <SelectValue placeholder="Selecione uma organizacao" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((organization) => (
                        <SelectItem key={organization.id} value={organization.id}>
                          {organization.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conversation-client">Cliente</Label>
                  <Select value={runForm.clientId} onValueChange={(value) => setRunForm((prev) => ({ ...prev, clientId: value }))}>
                    <SelectTrigger id="conversation-client">
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientsForSelectedOrganization.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="conversation-llm">Configuracao LLM</Label>
                  <Select value={runForm.llmConfigId || 'auto'} onValueChange={(value) => setRunForm((prev) => ({ ...prev, llmConfigId: value === 'auto' ? '' : value }))}>
                    <SelectTrigger id="conversation-llm">
                      <SelectValue placeholder="Selecionar configuracao" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Resolver automaticamente</SelectItem>
                      {llmConfigs.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.provider}/{config.model} - {config.tokenReference}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="conversation-plan-name">Nome do planejamento</Label>
                  <Input
                    id="conversation-plan-name"
                    placeholder="Ex.: Abril 2026 - Clinica Odonto Premium"
                    value={runForm.campaignName}
                    onChange={(event) => setRunForm((prev) => ({ ...prev, campaignName: event.target.value }))}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-sky-200/70 bg-gradient-to-r from-sky-50 via-cyan-50 to-emerald-50 p-4 space-y-3 dark:border-sky-800/60 dark:from-sky-950/40 dark:via-cyan-950/30 dark:to-emerald-950/40">
                <p className="text-sm font-semibold">Briefing inicial</p>
                <p className="text-xs text-muted-foreground">
                  Escreva livremente e inclua links. O squad le o contexto para gerar estrategia, copy, criacao e plano de midia.
                </p>
                <Textarea
                  placeholder="Ex.: Quero captar leads para clinica odontologica em Cuiaba. Site: https://meusite.com.br"
                  value={conversationIdea}
                  onChange={(event) => setConversationIdea(event.target.value)}
                />
                <Button onClick={handleStartConversationalRun} disabled={startingConversationalRun}>
                  {startingConversationalRun ? 'Iniciando conversa...' : 'Iniciar run conversacional'}
                </Button>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Compatibilidade CS-13: formulario legado</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowLegacyForm((current) => !current)}>
                    {showLegacyForm ? 'Ocultar' : 'Mostrar'}
                  </Button>
                </div>
                {!showLegacyForm ? (
                  <p className="text-xs text-muted-foreground">Use o legado somente quando precisar de compatibilidade.</p>
                ) : null}
              </div>

              {showLegacyForm ? (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="run-campaign-name">Nome da campanha</Label>
                      <Input id="run-campaign-name" value={runForm.campaignName} onChange={(event) => setRunForm((prev) => ({ ...prev, campaignName: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="run-objective">Objetivo</Label>
                      <Input id="run-objective" value={runForm.objective} onChange={(event) => setRunForm((prev) => ({ ...prev, objective: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="run-budget-currency">Moeda</Label>
                      <Input id="run-budget-currency" value={runForm.budgetCurrency} onChange={(event) => setRunForm((prev) => ({ ...prev, budgetCurrency: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="run-budget-amount">Orcamento</Label>
                      <Input id="run-budget-amount" type="number" min="1" step="0.01" value={runForm.budgetAmount} onChange={(event) => setRunForm((prev) => ({ ...prev, budgetAmount: event.target.value }))} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-md border p-3">
                      <Checkbox checked={runForm.includeMeta} onCheckedChange={(checked) => setRunForm((prev) => ({ ...prev, includeMeta: checked === true }))} />
                      <Label>Publicar na Meta</Label>
                    </div>
                    <div className="flex items-center gap-3 rounded-md border p-3">
                      <Checkbox checked={runForm.includeGoogle} onCheckedChange={(checked) => setRunForm((prev) => ({ ...prev, includeGoogle: checked === true }))} />
                      <Label>Publicar no Google</Label>
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-3 md:col-span-2">
                      <Label>Permitir 1 refacao automatica em caso de reprovacao</Label>
                      <Switch checked={runForm.allowAutoRefine} onCheckedChange={(checked) => setRunForm((prev) => ({ ...prev, allowAutoRefine: checked }))} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="run-publication-json">publicationConfig (JSON opcional)</Label>
                    <Textarea
                      id="run-publication-json"
                      placeholder='{"meta":{"pageId":"123"},"google":{"dailyBudget":120}}'
                      value={runForm.publicationConfigJson}
                      onChange={(event) => setRunForm((prev) => ({ ...prev, publicationConfigJson: event.target.value }))}
                    />
                  </div>

                  <ReadyCreativesBuilder
                    organizationId={runForm.organizationId}
                    clientId={runForm.clientId}
                    value={readyCreatives}
                    onChange={setReadyCreatives}
                  />

                  <Button onClick={handleCreateRun} disabled={submittingRun}>
                    {submittingRun ? 'Criando run...' : 'Criar e iniciar run'}
                  </Button>
                </>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {runData ? (
          <>
            <Card className="border-2 border-slate-200 dark:border-slate-700/60">
              <CardHeader className="rounded-t-lg bg-gradient-to-r from-slate-50 via-sky-50 to-cyan-50 dark:from-slate-900/80 dark:via-sky-950/40 dark:to-cyan-950/40">
                <CardTitle>Plano de marketing para aprovacao</CardTitle>
                <CardDescription>
                  Visao executiva com estrategia, copy, criacao, squad responsavel e checklist de publicacao.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Planejamento</p>
                  <p className="text-lg font-semibold">{activePlanName}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Run: {runData.id}</Badge>
                  <Badge variant={runStatusVariant(runData.status)}>{runData.status}</Badge>
                  <Badge variant="secondary">{runData.stage}</Badge>
                  {trackedOrganizationName ? <Badge variant="outline">Conta: {trackedOrganizationName}</Badge> : null}
                  {trackedClientName ? <Badge variant="outline">Cliente: {trackedClientName}</Badge> : null}
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Agente</p>
                    <p className="text-sm font-semibold">{asString(strategistAgent?.label) || 'Estrategista'}</p>
                    <p className="text-xs text-muted-foreground">{asString(strategistAgent?.specialty) || 'Responsavel por estrategia e midia'}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {asString(asRecord(strategistAgent?.llm)?.model) || runData.llmSnapshot?.model || 'modelo nao informado'}
                    </p>
                    <Badge variant={hasPlan ? 'default' : 'secondary'} className="mt-2">{hasPlan ? 'Concluido' : 'Pendente'}</Badge>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Agente</p>
                    <p className="text-sm font-semibold">{asString(copywriterAgent?.label) || 'Copywriter'}</p>
                    <p className="text-xs text-muted-foreground">{asString(copywriterAgent?.specialty) || 'Responsavel por mensagens e ofertas'}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {asString(asRecord(copywriterAgent?.llm)?.model) || runData.llmSnapshot?.model || 'modelo nao informado'}
                    </p>
                    <Badge variant={copyAssets.length > 0 ? 'default' : 'secondary'} className="mt-2">{copyAssets.length > 0 ? 'Concluido' : 'Pendente'}</Badge>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Agente</p>
                    <p className="text-sm font-semibold">{asString(designerAgent?.label) || 'Designer'}</p>
                    <p className="text-xs text-muted-foreground">{asString(designerAgent?.specialty) || 'Responsavel por pecas e formatos'}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {asString(asRecord(designerAgent?.llm)?.model) || runData.llmSnapshot?.model || 'modelo nao informado'}
                    </p>
                    <Badge variant={mediaAssets.length > 0 ? 'default' : 'secondary'} className="mt-2">{mediaAssets.length > 0 ? 'Concluido' : 'Pendente'}</Badge>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Agente</p>
                    <p className="text-sm font-semibold">{asString(trafficManagerAgent?.label) || 'Gestor de trafego'}</p>
                    <p className="text-xs text-muted-foreground">{asString(trafficManagerAgent?.specialty) || 'Responsavel por budget e publicacao'}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {asString(asRecord(trafficManagerAgent?.llm)?.model) || runData.llmSnapshot?.model || 'modelo nao informado'}
                    </p>
                    <Badge variant={runData.stage === 'publishing' || hasPublished ? 'default' : 'secondary'} className="mt-2">
                      {runData.stage === 'publishing' || hasPublished ? 'Executando' : 'Aguardando'}
                    </Badge>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Agente</p>
                    <p className="text-sm font-semibold">{asString(qaPublisherAgent?.label) || 'QA e Publicador'}</p>
                    <p className="text-xs text-muted-foreground">{asString(qaPublisherAgent?.specialty) || 'Responsavel por validacao final'}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {asString(asRecord(qaPublisherAgent?.llm)?.model) || runData.llmSnapshot?.model || 'modelo nao informado'}
                    </p>
                    <Badge variant={runData.stage === 'awaiting_final_approval' ? 'secondary' : 'default'} className="mt-2">
                      {runData.stage === 'awaiting_final_approval' ? 'Aguardando voce' : 'Ativo'}
                    </Badge>
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Hierarquia do planejamento</p>
                  <div className="mt-2 space-y-3">
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-sm font-semibold">1. {activePlanName}</p>
                      <p className="text-xs text-muted-foreground">Resumo: {planSummary}</p>
                    </div>
                    {hierarchyCampaigns.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma campanha detalhada ainda.</p>
                    ) : (
                      hierarchyCampaigns.map((campaign, index) => (
                        <div key={campaign.id} className="rounded-md border p-3">
                          <p className="text-sm font-semibold">
                            {`1.${index + 1}`} {campaign.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Canal: {campaign.channel} | Objetivo: {campaign.objective} | Inicio: {campaign.startDate}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Criativos planejados: {campaign.creativesPlanned ?? '-'} | Criativos gerados: {campaign.assets.length}
                          </p>
                          {campaign.assets.length > 0 ? (
                            <ul className="mt-2 space-y-1">
                              {campaign.assets.map((asset) => (
                                <li key={asset.id} className="rounded border bg-muted/20 px-2 py-1 text-xs">
                                  {asset.title} ({asset.type})
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 text-xs text-muted-foreground">Sem peças geradas ainda para esta campanha.</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-xl border p-4 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Etapa 1</p>
                    <p className="text-base font-semibold">Estrategia</p>
                    <p className="text-sm">{planSummary}</p>
                    <p className="text-xs text-muted-foreground">Objetivo: {runData.objective || 'Leads'}</p>
                  </div>
                  <div className="rounded-xl border p-4 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Etapa 2</p>
                    <p className="text-base font-semibold">Planejamento de Midia</p>
                    <p className="text-sm">Canais: {planChannels.length > 0 ? planChannels.join(', ') : (runData.channels?.join(', ') || 'nao definido')}</p>
                    <p className="text-sm">Orcamento: {planBudgetAmount ?? runData.budget?.amount ?? '-'} {planBudgetCurrency || runData.budget?.currency || ''}</p>
                    <p className="text-xs text-muted-foreground">Inicio: {planStartDate || '-'} | Cadencia: {planCadence || '-'} | Duracao: {planDurationDays ?? '-'} dias</p>
                  </div>
                  <div className="rounded-xl border p-4 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Etapa 3</p>
                    <p className="text-base font-semibold">Copy</p>
                    <p className="text-xs text-muted-foreground">Tom de voz: {contextBrandVoice || 'nao definido'}</p>
                    <p className="text-xs text-muted-foreground">Proposta de valor: {contextValueProps || 'nao definida'}</p>
                    <p className="text-xs text-muted-foreground">Oferta: {contextOffers || 'nao definida'}</p>
                    {copyAssets.length > 0 ? (
                      <div className="space-y-2 pt-1">
                        {copyAssets.map((asset) => (
                          <div key={asset.id} className="rounded-md border bg-muted/20 p-2">
                            <p className="text-xs font-medium">{asset.title}</p>
                            {asset.content ? <p className="text-xs text-muted-foreground whitespace-pre-wrap">{asset.content}</p> : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Copy ainda nao gerada.</p>
                    )}
                  </div>
                  <div className="rounded-xl border p-4 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Etapa 4</p>
                    <p className="text-base font-semibold">Criacao</p>
                    {planCampaigns.length > 0 ? (
                      <div className="space-y-2">
                        {planCampaigns.map((campaign, index) => (
                          <div key={asString(campaign.id) || `campaign-${index}`} className="rounded-md border p-2">
                            <p className="text-xs font-medium">{asString(campaign.name) || `Campanha ${index + 1}`}</p>
                            <p className="text-xs text-muted-foreground">Canal: {asString(campaign.channel) || '-'} | Criativos planejados: {asNumber(campaign.creativesPlanned) ?? '-'}</p>
                            <p className="text-xs text-muted-foreground">Inicio: {asString(campaign.startDate) || '-'} | Objetivo: {asString(campaign.objective) || '-'}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Campanhas ainda nao detalhadas.</p>
                    )}
                  </div>
                  <div className="rounded-xl border p-4 space-y-2 xl:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Etapa 5</p>
                    <p className="text-base font-semibold">QA e Publicacao</p>
                    <p className="text-sm">Loops de QA por tarefa: {planMaxQaLoops ?? runData.qaLoopCount ?? 2}</p>
                    <p className="text-xs text-muted-foreground">Refacoes: {runData.refinementCount} | Pecas geradas na iteracao atual: {creativeAssets.length}</p>
                  </div>
                </div>

                {runData.mode === 'conversational' && runData.stage === 'awaiting_plan_approval' ? (
                  <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3 dark:border-amber-700/70 dark:bg-amber-950/30">
                    <p className="text-sm font-semibold">Aprovacao de planejamento</p>
                    <p className="text-xs text-muted-foreground">
                      Ajuste manualmente os campos-chave do plano ou peça para a IA refinar antes da aprovação.
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="manual-plan-name">Nome do planejamento</Label>
                        <Input
                          id="manual-plan-name"
                          value={manualPlanName}
                          onChange={(event) => setManualPlanName(event.target.value)}
                          placeholder="Nome do planejamento"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="manual-budget-currency">Moeda</Label>
                        <Input
                          id="manual-budget-currency"
                          value={manualBudgetCurrency}
                          onChange={(event) => setManualBudgetCurrency(event.target.value)}
                          placeholder="BRL"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="manual-budget-amount">Orcamento</Label>
                        <Input
                          id="manual-budget-amount"
                          type="number"
                          min="1"
                          step="0.01"
                          value={manualBudgetAmount}
                          onChange={(event) => setManualBudgetAmount(event.target.value)}
                          placeholder="1000"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="manual-plan-summary">Resumo estrategico</Label>
                        <Textarea
                          id="manual-plan-summary"
                          value={manualPlanSummary}
                          onChange={(event) => setManualPlanSummary(event.target.value)}
                          placeholder="Resumo da estrategia para este planejamento"
                        />
                      </div>
                    </div>
                    <div className="space-y-3 rounded-md border border-amber-300/60 bg-white/70 p-3 dark:border-amber-700/50 dark:bg-amber-950/20">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium">Campanhas planejadas (rascunho)</p>
                        <Button type="button" size="sm" variant="outline" onClick={handleAddManualCampaign}>
                          Adicionar campanha planejada
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Esta etapa so edita o planejamento. A campanha real so sobe apos sua aprovacao final.
                      </p>

                      {manualCampaigns.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Sem campanhas no rascunho. Adicione para estruturar o planejamento antes de aprovar.</p>
                      ) : (
                        <DragDropContext onDragEnd={handleManualCampaignDragEnd}>
                          <Droppable droppableId="manual-planned-campaigns">
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className="space-y-3"
                              >
                                {manualCampaigns.map((campaign, index) => (
                                  <Draggable key={campaign.id} draggableId={campaign.id} index={index}>
                                    {(dragProvided, snapshot) => (
                                      <div
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        className={`rounded-md border bg-background p-3 space-y-3 ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            {...dragProvided.dragHandleProps}
                                            className="cursor-grab rounded border bg-muted/30 p-1 active:cursor-grabbing"
                                              aria-label="Arrastar campanha planejada"
                                            >
                                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                                          </button>
                                          <p className="text-xs font-semibold">Campanha planejada {index + 1}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleDuplicateManualCampaign(campaign.id)}
                                          >
                                            Duplicar
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleRemoveManualCampaign(campaign.id)}
                                          >
                                            Remover
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                          <div className="space-y-2 md:col-span-2">
                                            <Label>Nome</Label>
                                            <Input
                                              value={campaign.name}
                                              onChange={(event) => handleUpdateManualCampaign(campaign.id, 'name', event.target.value)}
                                              placeholder="Nome da campanha planejada"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <Label>Canal</Label>
                                            <Select
                                              value={campaign.channel}
                                              onValueChange={(value) => handleUpdateManualCampaign(campaign.id, 'channel', value)}
                                            >
                                              <SelectTrigger>
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="meta">Meta</SelectItem>
                                                <SelectItem value="google">Google</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div className="space-y-2">
                                            <Label>Criativos planejados</Label>
                                            <Input
                                              type="number"
                                              min="1"
                                              step="1"
                                              value={campaign.creativesPlanned}
                                              onChange={(event) => handleUpdateManualCampaign(campaign.id, 'creativesPlanned', event.target.value)}
                                              placeholder="3"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <Label>Objetivo</Label>
                                            <Input
                                              value={campaign.objective}
                                              onChange={(event) => handleUpdateManualCampaign(campaign.id, 'objective', event.target.value)}
                                              placeholder="Leads"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <Label>Data de inicio planejada</Label>
                                            <Input
                                              type="date"
                                              value={campaign.startDate}
                                              onChange={(event) => handleUpdateManualCampaign(campaign.id, 'startDate', event.target.value)}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </DragDropContext>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={handleSaveManualPlan} disabled={savingManualPlan}>
                        {savingManualPlan ? 'Salvando ajustes...' : 'Salvar ajuste manual'}
                      </Button>
                    </div>

                    <div className="space-y-2 border-t border-amber-300/60 pt-3 dark:border-amber-700/50">
                      <p className="text-xs font-medium">Pedir ajuste para a IA</p>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                        <Input
                          placeholder="Ex.: reduza o orçamento para R$ 3.500 e foque em conversão para WhatsApp"
                          value={conversationMessage}
                          onChange={(event) => setConversationMessage(event.target.value)}
                        />
                        <Button onClick={handleSendConversationMessage} disabled={sendingConversationMessage || !conversationMessage.trim()}>
                          {sendingConversationMessage ? 'Enviando...' : 'Pedir ajuste IA'}
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      placeholder="Feedback opcional para aprovar ou solicitar revisao"
                      value={approvalFeedback}
                      onChange={(event) => setApprovalFeedback(event.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => handlePlanApproval('approve')} disabled={processingPlanApproval}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Aprovar plano
                      </Button>
                      <Button variant="destructive" onClick={() => handlePlanApproval('revise')} disabled={processingPlanApproval}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Solicitar revisao
                      </Button>
                    </div>
                  </div>
                ) : null}

                {runData.mode === 'conversational' && runData.stage === 'awaiting_final_approval' ? (
                  <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 space-y-3 dark:border-emerald-700/70 dark:bg-emerald-950/30">
                    <p className="text-sm font-semibold">Confirmacao final antes de publicar</p>
                    <p className="text-xs text-muted-foreground">Revise o plano, pecas e copy. A publicacao so inicia apos sua confirmacao final.</p>
                    <Textarea
                      placeholder="Ajustes finais (opcional)"
                      value={approvalFeedback}
                      onChange={(event) => setApprovalFeedback(event.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => handleFinalApproval('approve')} disabled={processingFinalApproval}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Aprovar publicacao final
                      </Button>
                      <Button variant="destructive" onClick={() => handleFinalApproval('revise')} disabled={processingFinalApproval}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Solicitar ajuste final
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {creativeAssets.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Pecas criadas pelo squad</CardTitle>
                  <CardDescription>Textos, criativos e links para aprovacao.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {creativeAssets.map((asset) => {
                    const previewUrl = resolveCreativePreviewUrl(asset.publicUrl, asset.storageUrl)
                    const owner = asString(asRecord(asset.agent)?.label) || (
                      ['copy', 'headline', 'primary-text', 'video-script'].includes(asset.type)
                        ? 'Copywriter'
                        : 'Designer de Criativos'
                    )
                    return (
                      <div key={asset.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{asset.title}</p>
                          <Badge variant="outline">{asset.type}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Responsavel: {owner}</p>
                        {asset.content ? <p className="text-sm whitespace-pre-wrap">{asset.content}</p> : null}
                        {previewUrl && asset.type === 'image' ? (
                          <img src={previewUrl} alt={asset.title} className="max-h-64 rounded-md border object-contain" />
                        ) : null}
                        {previewUrl && asset.type === 'video' ? (
                          <video controls className="max-h-64 rounded-md border">
                            <source src={previewUrl} />
                          </video>
                        ) : null}
                        {!previewUrl && (asset.type === 'image' || asset.type === 'video') ? (
                          <p className="text-xs text-amber-700 dark:text-amber-300">Preview indisponivel: envie URL publica ou arquivo no MinIO.</p>
                        ) : null}
                        {asset.publicUrl ? <p className="text-xs text-muted-foreground break-all">{asset.publicUrl}</p> : null}
                        {asset.storageUrl ? <p className="text-xs text-muted-foreground break-all">{asset.storageUrl}</p> : null}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            ) : null}

            {runData.mode !== 'conversational' && runData.approvalId && runData.status === 'awaiting_approval' ? (
              <Card>
                <CardHeader>
                  <CardTitle>Aprovacao de pecas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder="Feedback para aprovacao/reprovacao (opcional)"
                    value={approvalFeedback}
                    onChange={(event) => setApprovalFeedback(event.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => handleApproval('approve')} disabled={processingApproval}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Aprovar pecas e publicar
                    </Button>
                    <Button variant="destructive" onClick={() => handleApproval('reject')} disabled={processingApproval}>
                      <XCircle className="mr-2 h-4 w-4" />
                      Reprovar e refazer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {runData.mode === 'conversational' ? (
              <Card>
                <CardHeader>
                  <CardTitle>Conversa e refinamentos</CardTitle>
                  <CardDescription>Ajuste qualquer etapa por chat e o squad replaneja.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="max-h-80 overflow-auto rounded-md border p-2 space-y-2">
                    {(runData.messages || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma mensagem registrada.</p>
                    ) : (
                      (runData.messages || []).map((message) => (
                        <div key={message.id} className="rounded-md border p-2">
                          <p className="text-xs font-semibold uppercase">{message.role} {message.phase ? `| ${message.phase}` : ''}</p>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <p className="text-[11px] text-muted-foreground">{new Date(message.createdAt).toLocaleString('pt-BR')}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                    <Input
                      placeholder="Ex.: Refina copy para tom mais premium e reduz ticket de entrada"
                      value={conversationMessage}
                      onChange={(event) => setConversationMessage(event.target.value)}
                    />
                    <Button onClick={handleSendConversationMessage} disabled={sendingConversationMessage || !conversationMessage.trim()}>
                      {sendingConversationMessage ? 'Enviando...' : 'Enviar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {runData.publishResult?.channels && runData.publishResult.channels.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Resultado da publicacao</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {runData.publishResult.channels.map((result, index) => (
                    <div key={`${result.channel}-${index}`} className="rounded-md border p-3">
                      <p className="text-sm font-medium">{result.channel.toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground">
                        {result.success ? 'Publicado com sucesso' : result.reason || 'Falha na publicacao'}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Compartilhar aprovacao no WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Telefone com DDD (ex.: 65999999999)"
                  value={whatsappPhone}
                  onChange={(event) => setWhatsappPhone(event.target.value)}
                />
                <Textarea
                  placeholder="Mensagem personalizada (opcional)"
                  value={whatsappMessage}
                  onChange={(event) => setWhatsappMessage(event.target.value)}
                />
                <Button onClick={handleShareWhatsapp} disabled={sharingWhatsapp}>
                  {sharingWhatsapp ? 'Enviando...' : 'Enviar WhatsApp'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(runData.timeline || []).slice().reverse().map((entry, index) => (
                  <div key={`${entry.at}-${entry.event}-${index}`} className="flex gap-3">
                    <Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{entry.event}</p>
                      {entry.detail ? <p className="text-sm text-muted-foreground">{entry.detail}</p> : null}
                      <p className="text-xs text-muted-foreground">{new Date(entry.at).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </CampaignSquadShell>
  )
}
