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

export default function CampaignSquadRunsPage() {
  const { toast } = useToast()
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

  const [submittingRun, setSubmittingRun] = useState(false)
  const [refreshingRun, setRefreshingRun] = useState(false)
  const [processingApproval, setProcessingApproval] = useState(false)
  const [sharingWhatsapp, setSharingWhatsapp] = useState(false)

  const selectedChannels = useMemo(() => {
    const channels: SquadChannel[] = []
    if (runForm.includeMeta) channels.push('meta')
    if (runForm.includeGoogle) channels.push('google')
    return channels
  }, [runForm.includeGoogle, runForm.includeMeta])

  const loadClients = useCallback(async () => {
    setLoadingClients(true)
    try {
      const data = await requestJson<{
        clients: Array<{ id: string; name: string }>
        organizationId?: string | null
      }>('/api/dashboard/clients')

      const fetchedClients = Array.isArray(data.clients) ? data.clients : []
      setClients(fetchedClients)

      const suggestedOrg = typeof data.organizationId === 'string' && data.organizationId.trim().length > 0
        ? data.organizationId
        : null
      if (suggestedOrg) {
        setRunForm((prev) => ({ ...prev, organizationId: prev.organizationId === 'default' ? suggestedOrg : prev.organizationId }))
      }

      if (fetchedClients.length > 0) {
        setRunForm((prev) => ({ ...prev, clientId: prev.clientId || fetchedClients[0].id }))
      }
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
    if (!organizationId.trim()) return
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
      title="Runs e Aprovação"
      description="Dispare campanhas sob demanda, acompanhe o run e publique após aprovação."
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
              Start manual de campanha
            </CardTitle>
            <CardDescription>Planejamento, criativos e fluxo de aprovação em execução imediata.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="run-org">Organização</Label>
                <Input id="run-org" value={runForm.organizationId} onChange={(event) => setRunForm((prev) => ({ ...prev, organizationId: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="run-client">Cliente</Label>
                <Input
                  id="run-client"
                  list="campaign-squad-clients-runs"
                  value={runForm.clientId}
                  onChange={(event) => setRunForm((prev) => ({ ...prev, clientId: event.target.value }))}
                />
                <datalist id="campaign-squad-clients-runs">
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </datalist>
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

                {runData.approvalId && runData.status === 'awaiting_approval' ? (
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
