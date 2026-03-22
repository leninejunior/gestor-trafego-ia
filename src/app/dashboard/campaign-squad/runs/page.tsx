'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { CheckCircle2, Clock3, MessageSquare, RefreshCw, Rocket, ShieldCheck, XCircle } from 'lucide-react'
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
  const [approvalFeedback, setApprovalFeedback] = useState('')
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [whatsappMessage, setWhatsappMessage] = useState('')
  const [conversationIdea, setConversationIdea] = useState('')
  const [conversationMessage, setConversationMessage] = useState('')

  const [submittingRun, setSubmittingRun] = useState(false)
  const [startingConversationalRun, setStartingConversationalRun] = useState(false)
  const [sendingConversationMessage, setSendingConversationMessage] = useState(false)
  const [processingPlanApproval, setProcessingPlanApproval] = useState(false)
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

  useEffect(() => {
    loadClients()
  }, [loadClients])

  useEffect(() => {
    loadLlmConfigs(runForm.organizationId)
  }, [loadLlmConfigs, runForm.organizationId])

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
          mode: 'conversational',
          idea: conversationIdea.trim(),
          llmConfigId: runForm.llmConfigId || undefined
        })
      })

      setRunData(created)
      setTrackedRunId(created.id)
      setConversationMessage('')
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
      description="Inicie pela conversa. O formulário legado permanece como compatibilidade secundária."
      actions={(
        <>
          <Button variant="outline" onClick={() => loadLlmConfigs(runForm.organizationId)} disabled={loadingLlmConfigs}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingLlmConfigs ? 'animate-spin' : ''}`} />
            Atualizar LLM
          </Button>
        </>
      )}
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Modo conversacional
            </CardTitle>
            <CardDescription>Planejamento, criativos e aprovação seguem o fluxo principal por conversa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 space-y-3">
              <p className="text-sm font-semibold">CS-11</p>
              <p className="text-xs text-muted-foreground">
                Descreva o objetivo e deixe o squad conduzir briefing, plano e próximos passos. A aprovação manual de peças fica fora desse fluxo.
              </p>
              <Textarea
                placeholder="Ex.: Quero campanha de captacao para clinica odontologica, foco em implante, publico 30+ em Cuiaba."
                value={conversationIdea}
                onChange={(event) => setConversationIdea(event.target.value)}
              />
              <Button onClick={handleStartConversationalRun} disabled={startingConversationalRun}>
                {startingConversationalRun ? 'Iniciando conversa...' : 'Iniciar run conversacional'}
              </Button>
            </div>

            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-semibold">Compatibilidade CS-13: formulário legado</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="run-org">Organização</Label>
                <Select value={runForm.organizationId || undefined} onValueChange={(value) => setRunForm((prev) => ({ ...prev, organizationId: value }))}>
                  <SelectTrigger id="run-org">
                    <SelectValue placeholder="Selecione uma organização" />
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
                <Label htmlFor="run-client">Cliente</Label>
                <Select value={runForm.clientId || undefined} onValueChange={(value) => setRunForm((prev) => ({ ...prev, clientId: value }))}>
                  <SelectTrigger id="run-client">
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
                {loadingClients ? <p className="text-xs text-muted-foreground">Carregando clientes...</p> : null}
              </div>
              <div className="space-y-2 md:col-span-2">
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
                <Label htmlFor="run-budget-amount">Orçamento</Label>
                <Input id="run-budget-amount" type="number" min="1" step="0.01" value={runForm.budgetAmount} onChange={(event) => setRunForm((prev) => ({ ...prev, budgetAmount: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="run-llm-config">Configuração LLM</Label>
                <Select value={runForm.llmConfigId || 'auto'} onValueChange={(value) => setRunForm((prev) => ({ ...prev, llmConfigId: value === 'auto' ? '' : value }))}>
                  <SelectTrigger id="run-llm-config">
                    <SelectValue placeholder="Selecionar configuração" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Usar resolução automática</SelectItem>
                    {llmConfigs.map((config) => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.provider}/{config.model} - {config.tokenReference}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Label>Permitir 1 refação automática em caso de reprovação</Label>
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
            <p className="text-xs text-muted-foreground">
              Canais selecionados: {selectedChannels.length > 0 ? selectedChannels.join(', ') : 'nenhum'}.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Aprovação, publicação e WhatsApp
            </CardTitle>
            <CardDescription>Busque um run, aprove/reprove peças e envie link no WhatsApp.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
              <Input
                placeholder="ID do run para acompanhar"
                value={trackedRunId}
                onChange={(event) => setTrackedRunId(event.target.value)}
              />
              <Button onClick={() => refreshRun(trackedRunId)} disabled={refreshingRun || !trackedRunId.trim()}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshingRun ? 'animate-spin' : ''}`} />
                Atualizar run
              </Button>
            </div>

            {runData ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Run: {runData.id}</Badge>
                  <Badge variant={runStatusVariant(runData.status)}>{runData.status}</Badge>
                  <Badge variant="secondary">{runData.stage}</Badge>
                  <Badge variant="outline">Refações: {runData.refinementCount}</Badge>
                  <Badge variant="outline">Criativos prontos: {runData.readyCreatives?.length || 0}</Badge>
                </div>

                {runData.mode === 'conversational' ? (
                  <div className="rounded-lg border p-4 space-y-3">
                    <p className="text-sm font-medium">Conversa do run</p>
                    <div className="max-h-56 space-y-2 overflow-auto rounded-md border p-2">
                      {(runData.messages || []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhuma mensagem registrada.</p>
                      ) : (
                        (runData.messages || []).map((message) => (
                          <div key={message.id} className="rounded-md border p-2">
                            <p className="text-xs font-semibold uppercase">{message.role} {message.phase ? `| ${message.phase}` : ''}</p>
                            <p className="text-sm">{message.content}</p>
                            <p className="text-[11px] text-muted-foreground">{new Date(message.createdAt).toLocaleString('pt-BR')}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                      <Input
                        placeholder="Envie uma mensagem para briefing/ajustes"
                        value={conversationMessage}
                        onChange={(event) => setConversationMessage(event.target.value)}
                      />
                      <Button onClick={handleSendConversationMessage} disabled={sendingConversationMessage || !conversationMessage.trim()}>
                        {sendingConversationMessage ? 'Enviando...' : 'Enviar'}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {runData.mode === 'conversational' && runData.stage === 'awaiting_plan_approval' ? (
                  <div className="rounded-lg border p-4 space-y-3">
                    <p className="text-sm font-medium">Plano aguardando aprovacao</p>
                    {runData.planDraft ? (
                      <pre className="max-h-56 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
                        {JSON.stringify(runData.planDraft, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-xs text-muted-foreground">Plano ainda indisponivel.</p>
                    )}
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


                {runData.creativeBatch?.assets && runData.creativeBatch.assets.length > 0 ? (
                  <div className="rounded-lg border p-4">
                    <p className="text-sm font-medium">Peças geradas (iteração {runData.creativeBatch.iteration})</p>
                    <div className="mt-2 space-y-2">
                      {runData.creativeBatch.assets.map((asset) => (
                        <div key={asset.id} className="rounded-md border p-3">
                          <p className="text-sm font-medium">{asset.title}</p>
                          <p className="text-xs text-muted-foreground">Tipo: {asset.type}</p>
                          {asset.content ? <p className="mt-2 text-sm">{asset.content}</p> : null}
                          {asset.storageUrl ? <p className="mt-2 text-xs text-muted-foreground">{asset.storageUrl}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {runData.mode !== 'conversational' && runData.approvalId && runData.status === 'awaiting_approval' ? (
                  <div className="rounded-lg border p-4 space-y-3">
                    <p className="text-sm font-medium">Aguardando aprovação do usuário</p>
                    <Textarea
                      placeholder="Feedback para aprovação/reprovação (opcional)"
                      value={approvalFeedback}
                      onChange={(event) => setApprovalFeedback(event.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => handleApproval('approve')} disabled={processingApproval}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Aprovar peças e publicar
                      </Button>
                      <Button variant="destructive" onClick={() => handleApproval('reject')} disabled={processingApproval}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Reprovar e refazer
                      </Button>
                    </div>
                  </div>
                ) : null}

                {runData.publishResult?.channels && runData.publishResult.channels.length > 0 ? (
                  <div className="rounded-lg border p-4">
                    <p className="text-sm font-medium">Resultado da publicação</p>
                    <div className="mt-2 space-y-2">
                      {runData.publishResult.channels.map((result, index) => (
                        <div key={`${result.channel}-${index}`} className="rounded-md border p-3">
                          <p className="text-sm font-medium">{result.channel.toUpperCase()}</p>
                          <p className="text-xs text-muted-foreground">
                            {result.success ? 'Publicado com sucesso' : result.reason || 'Falha na publicação'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <p className="text-sm font-medium">Enviar link de aprovação no WhatsApp</p>
                  </div>
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
                </div>

                <div className="rounded-lg border p-4">
                  <p className="mb-3 text-sm font-medium">Timeline</p>
                  <div className="space-y-3">
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
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum run carregado ainda.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </CampaignSquadShell>
  )
}
