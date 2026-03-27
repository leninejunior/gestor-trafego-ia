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
  type SquadSchedule,
  datetimeLocalFromNow,
  parsePublicationConfig,
  requestJson
} from '@/lib/campaign-squad/dashboard'
import { CalendarClock, RefreshCw } from 'lucide-react'
import { CampaignSquadShell } from '../_components/campaign-squad-shell'
import { ReadyCreativesBuilder } from '../_components/ready-creatives-builder'

type ScheduleFormState = {
  organizationId: string
  clientId: string
  timezone: string
  nextRunAt: string
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

function addDaysToDatetimeLocal(input: string, days = 1): string {
  const base = new Date(input)
  if (Number.isNaN(base.getTime())) return datetimeLocalFromNow(60 * 24)
  base.setDate(base.getDate() + days)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`
}

export default function CampaignSquadSchedulesPage() {
  const { toast } = useToast()
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([])
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [readyCreatives, setReadyCreatives] = useState<ReadyCreativeInput[]>([])
  const [llmConfigs, setLlmConfigs] = useState<LlmConfig[]>([])
  const [loadingLlmConfigs, setLoadingLlmConfigs] = useState(false)

  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>({
    organizationId: 'default',
    clientId: '',
    timezone: 'America/Sao_Paulo',
    nextRunAt: datetimeLocalFromNow(60),
    campaignName: 'Planejamento de campanha',
    objective: 'Leads',
    budgetAmount: '1000',
    budgetCurrency: 'BRL',
    includeMeta: true,
    includeGoogle: false,
    allowAutoRefine: true,
    llmConfigId: '',
    publicationConfigJson: ''
  })

  const [schedules, setSchedules] = useState<SquadSchedule[]>([])
  const [loadingSchedules, setLoadingSchedules] = useState(false)
  const [submittingSchedule, setSubmittingSchedule] = useState(false)
  const [triggeringDueSchedules, setTriggeringDueSchedules] = useState(false)
  const [togglingScheduleId, setTogglingScheduleId] = useState<string | null>(null)
  const [duplicatingScheduleId, setDuplicatingScheduleId] = useState<string | null>(null)

  const hasSelectedOrganization =
    scheduleForm.organizationId.trim().length > 0 && scheduleForm.organizationId !== 'default'
  const hasSelectedClient = scheduleForm.clientId.trim().length > 0

  const clientsForSelectedOrganization = useMemo(
    () => clients.filter((client) => client.organization_id === scheduleForm.organizationId),
    [clients, scheduleForm.organizationId]
  )
  const organizationNameById = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization.name])),
    [organizations]
  )
  const clientNameById = useMemo(
    () => new Map(clients.map((client) => [client.id, client.name])),
    [clients]
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
      setScheduleForm((prev) => {
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
        title: 'Falha ao listar configuracoes LLM',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setLoadingLlmConfigs(false)
    }
  }, [toast])

  const loadSchedules = useCallback(async (organizationId: string) => {
    if (!organizationId.trim() || organizationId === 'default') {
      setSchedules([])
      return
    }
    setLoadingSchedules(true)
    try {
      const query = new URLSearchParams({ organizationId }).toString()
      const data = await requestJson<{ data: SquadSchedule[] }>(`/api/campaign-squad/schedules?${query}`)
      setSchedules(Array.isArray(data.data) ? data.data : [])
    } catch (error) {
      toast({
        title: 'Falha ao listar agendamentos',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setLoadingSchedules(false)
    }
  }, [toast])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  useEffect(() => {
    loadLlmConfigs(scheduleForm.organizationId)
    loadSchedules(scheduleForm.organizationId)
  }, [loadLlmConfigs, loadSchedules, scheduleForm.organizationId])

  useEffect(() => {
    setScheduleForm((prev) => {
      const clientsInOrganization = clients.filter((client) => client.organization_id === prev.organizationId)
      if (clientsInOrganization.length === 0) {
        if (!prev.clientId) return prev
        return { ...prev, clientId: '' }
      }

      const hasSelectedClient = clientsInOrganization.some((client) => client.id === prev.clientId)
      if (hasSelectedClient) return prev
      return { ...prev, clientId: clientsInOrganization[0].id }
    })
  }, [clients, scheduleForm.organizationId])

  const handleCreateSchedule = async (options?: { continueSequence?: boolean }) => {
    if (!hasSelectedOrganization || !hasSelectedClient) {
      toast({ title: 'Informe conta e cliente pela lista para criar o agendamento', variant: 'destructive' })
      return
    }

    const channels: SquadChannel[] = []
    if (scheduleForm.includeMeta) channels.push('meta')
    if (scheduleForm.includeGoogle) channels.push('google')
    if (channels.length === 0) {
      toast({ title: 'Selecione ao menos um canal no template do agendamento', variant: 'destructive' })
      return
    }

    const budgetAmount = Number(scheduleForm.budgetAmount)
    if (!Number.isFinite(budgetAmount) || budgetAmount <= 0) {
      toast({ title: 'Orcamento do template invalido', variant: 'destructive' })
      return
    }

    const nextRunAt = new Date(scheduleForm.nextRunAt)
    if (Number.isNaN(nextRunAt.getTime())) {
      toast({ title: 'Data/hora do disparo invalida', variant: 'destructive' })
      return
    }

    setSubmittingSchedule(true)
    try {
      const publicationConfig = parsePublicationConfig(scheduleForm.publicationConfigJson)

      await requestJson('/api/campaign-squad/schedules', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: scheduleForm.organizationId.trim(),
          clientId: scheduleForm.clientId.trim(),
          cadence: 'monthly',
          timezone: scheduleForm.timezone.trim(),
          dayOfMonth: nextRunAt.getDate(),
          hour: nextRunAt.getHours(),
          minute: nextRunAt.getMinutes(),
          nextRunAt: nextRunAt.toISOString(),
          payloadTemplate: {
            scheduleMode: 'one_time',
            campaignName: scheduleForm.campaignName.trim(),
            objective: scheduleForm.objective.trim(),
            budget: {
              amount: budgetAmount,
              currency: scheduleForm.budgetCurrency.trim().toUpperCase()
            },
            channels,
            allowAutoRefine: scheduleForm.allowAutoRefine,
            llmConfigId: scheduleForm.llmConfigId || undefined,
            publicationConfig,
            readyCreatives: readyCreatives.length > 0 ? readyCreatives : undefined
          }
        })
      })

      toast({ title: options?.continueSequence ? 'Agendamento criado e proximo pronto' : 'Agendamento criado com sucesso' })
      if (options?.continueSequence) {
        setScheduleForm((prev) => ({
          ...prev,
          nextRunAt: addDaysToDatetimeLocal(prev.nextRunAt, 1)
        }))
      }
      await loadSchedules(scheduleForm.organizationId)
    } catch (error) {
      toast({
        title: 'Falha ao criar agendamento',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setSubmittingSchedule(false)
    }
  }

  const handleDuplicateSchedulePlusOneDay = async (schedule: SquadSchedule) => {
    const sourceDate = schedule.nextRunAt ? new Date(schedule.nextRunAt) : new Date()
    if (Number.isNaN(sourceDate.getTime())) {
      toast({ title: 'Nao foi possivel duplicar: data invalida no agendamento base', variant: 'destructive' })
      return
    }
    sourceDate.setDate(sourceDate.getDate() + 1)

    setDuplicatingScheduleId(schedule.id)
    try {
      await requestJson('/api/campaign-squad/schedules', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: schedule.organizationId,
          clientId: schedule.clientId,
          cadence: 'monthly',
          timezone: schedule.timezone || 'America/Sao_Paulo',
          dayOfMonth: sourceDate.getDate(),
          hour: sourceDate.getHours(),
          minute: sourceDate.getMinutes(),
          nextRunAt: sourceDate.toISOString(),
          payloadTemplate: {
            ...(schedule.payloadTemplate || {}),
            scheduleMode: 'one_time'
          }
        })
      })

      toast({ title: 'Sequencia criada', description: 'Novo agendamento criado com +1 dia da campanha base.' })
      await loadSchedules(schedule.organizationId)
    } catch (error) {
      toast({
        title: 'Falha ao criar sequencia da campanha',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setDuplicatingScheduleId(null)
    }
  }

  const handleTriggerDueSchedules = async () => {
    setTriggeringDueSchedules(true)
    try {
      const data = await requestJson<{ triggered: number; runs: SquadRun[] }>('/api/campaign-squad/schedules/trigger-due', {
        method: 'POST'
      })
      toast({
        title: 'Disparo de agendamentos executado',
        description: `${data.triggered} run(s) iniciados.`
      })
      await loadSchedules(scheduleForm.organizationId)
    } catch (error) {
      toast({
        title: 'Falha ao disparar agendamentos vencidos',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setTriggeringDueSchedules(false)
    }
  }

  const handleToggleSchedule = async (schedule: SquadSchedule) => {
    setTogglingScheduleId(schedule.id)
    try {
      const updated = await requestJson<SquadSchedule>(`/api/campaign-squad/schedules/${schedule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          isActive: !schedule.isActive
        })
      })
      setSchedules((prev) => prev.map((item) => (item.id === schedule.id ? updated : item)))
      toast({
        title: updated.isActive ? 'Agendamento ativado' : 'Agendamento desativado',
        description: `Schedule ${updated.id} atualizado com sucesso.`
      })
    } catch (error) {
      toast({
        title: 'Falha ao atualizar agendamento',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setTogglingScheduleId(null)
    }
  }

  return (
    <CampaignSquadShell
      title="Agendamentos"
      description="Agende por data e horario exatos, com opcao de sequencia da mesma campanha."
      actions={(
        <>
          <Button variant="outline" onClick={() => loadSchedules(scheduleForm.organizationId)} disabled={loadingSchedules}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingSchedules ? 'animate-spin' : ''}`} />
            Atualizar agendamentos
          </Button>
          <Button variant="outline" onClick={handleTriggerDueSchedules} disabled={triggeringDueSchedules}>
            <CalendarClock className="mr-2 h-4 w-4" />
            {triggeringDueSchedules ? 'Executando...' : 'Executar vencidos agora'}
          </Button>
        </>
      )}
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Novo agendamento por data/hora</CardTitle>
            <CardDescription>Defina campanha, orcamento e data/hora exata. Para sequencia, use o botao de criar +1 dia.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="schedule-org">Organizacao</Label>
                <Select value={scheduleForm.organizationId} onValueChange={(value) => setScheduleForm((prev) => ({ ...prev, organizationId: value }))}>
                  <SelectTrigger id="schedule-org" disabled={loadingClients || organizations.length === 0}>
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
                <Label htmlFor="schedule-client">Cliente</Label>
                <Select value={scheduleForm.clientId} onValueChange={(value) => setScheduleForm((prev) => ({ ...prev, clientId: value }))}>
                  <SelectTrigger id="schedule-client" disabled={loadingClients || !hasSelectedOrganization || clientsForSelectedOrganization.length === 0}>
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
              <div className="space-y-2">
                <Label htmlFor="schedule-next">Data e horario do disparo</Label>
                <Input id="schedule-next" type="datetime-local" value={scheduleForm.nextRunAt} onChange={(event) => setScheduleForm((prev) => ({ ...prev, nextRunAt: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-timezone">Timezone</Label>
                <Input id="schedule-timezone" value={scheduleForm.timezone} onChange={(event) => setScheduleForm((prev) => ({ ...prev, timezone: event.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="schedule-campaign-name">Nome da campanha</Label>
                <Input id="schedule-campaign-name" value={scheduleForm.campaignName} onChange={(event) => setScheduleForm((prev) => ({ ...prev, campaignName: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-objective">Objetivo</Label>
                <Input id="schedule-objective" value={scheduleForm.objective} onChange={(event) => setScheduleForm((prev) => ({ ...prev, objective: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-budget-amount">Orcamento</Label>
                <Input id="schedule-budget-amount" type="number" min="1" step="0.01" value={scheduleForm.budgetAmount} onChange={(event) => setScheduleForm((prev) => ({ ...prev, budgetAmount: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-budget-currency">Moeda</Label>
                <Input id="schedule-budget-currency" value={scheduleForm.budgetCurrency} onChange={(event) => setScheduleForm((prev) => ({ ...prev, budgetCurrency: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="schedule-llm-select">Configuracao LLM</Label>
                <Select value={scheduleForm.llmConfigId || 'none'} onValueChange={(value) => setScheduleForm((prev) => ({ ...prev, llmConfigId: value === 'none' ? '' : value }))}>
                  <SelectTrigger id="schedule-llm-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (resolucao automatica)</SelectItem>
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
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label>Refacao automatica no template</Label>
                <Switch checked={scheduleForm.allowAutoRefine} onCheckedChange={(checked) => setScheduleForm((prev) => ({ ...prev, allowAutoRefine: checked }))} />
              </div>
              <div className="flex items-center gap-3 rounded-md border p-3">
                <Checkbox checked={scheduleForm.includeMeta} onCheckedChange={(checked) => setScheduleForm((prev) => ({ ...prev, includeMeta: checked === true }))} />
                <Label>Canal Meta</Label>
              </div>
              <div className="flex items-center gap-3 rounded-md border p-3 md:col-span-2">
                <Checkbox checked={scheduleForm.includeGoogle} onCheckedChange={(checked) => setScheduleForm((prev) => ({ ...prev, includeGoogle: checked === true }))} />
                <Label>Canal Google</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule-publication-json">publicationConfig (JSON opcional)</Label>
              <Textarea
                id="schedule-publication-json"
                placeholder='{"meta":{"pageId":"123"},"google":{"dailyBudget":120}}'
                value={scheduleForm.publicationConfigJson}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, publicationConfigJson: event.target.value }))}
              />
            </div>

            <ReadyCreativesBuilder
              organizationId={scheduleForm.organizationId}
              clientId={scheduleForm.clientId}
              value={readyCreatives}
              onChange={setReadyCreatives}
            />

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleCreateSchedule()} disabled={submittingSchedule}>
                {submittingSchedule ? 'Criando agendamento...' : 'Criar agendamento'}
              </Button>
              <Button type="button" variant="outline" onClick={() => handleCreateSchedule({ continueSequence: true })} disabled={submittingSchedule}>
                {submittingSchedule ? 'Criando...' : 'Criar e preparar proximo (+1 dia)'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agendamentos</CardTitle>
            <CardDescription>Disparos por data/hora com opcao de sequencia da mesma campanha.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSchedules ? (
              <p className="text-sm text-muted-foreground">Carregando agendamentos...</p>
            ) : schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum agendamento encontrado para esta organizacao.</p>
            ) : (
              <div className="space-y-3">
                {schedules.map((schedule) => {
                  const template = (schedule.payloadTemplate || {}) as Record<string, unknown>
                  const campaignName = typeof template.campaignName === 'string' ? template.campaignName : 'Campanha sem nome'
                  const templateBudget = template.budget && typeof template.budget === 'object'
                    ? template.budget as { amount?: number; currency?: string }
                    : null
                  const budgetLabel = templateBudget
                    ? `${templateBudget.amount ?? '-'} ${templateBudget.currency ?? ''}`.trim()
                    : '-'

                  return (
                    <div key={schedule.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{schedule.id}</Badge>
                        <Badge variant="secondary">data fixa</Badge>
                        <Badge variant={schedule.isActive ? 'default' : 'destructive'}>
                          {schedule.isActive ? 'ativo' : 'inativo'}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={togglingScheduleId === schedule.id}
                          onClick={() => handleToggleSchedule(schedule)}
                        >
                          {togglingScheduleId === schedule.id ? 'Atualizando...' : schedule.isActive ? 'Desativar' : 'Ativar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={duplicatingScheduleId === schedule.id}
                          onClick={() => handleDuplicateSchedulePlusOneDay(schedule)}
                        >
                          {duplicatingScheduleId === schedule.id ? 'Duplicando...' : 'Sequencia +1 dia'}
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Data/hora: {schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString('pt-BR') : 'nao definido'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Campanha: {campaignName} | Orcamento: {budgetLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Conta: {organizationNameById.get(schedule.organizationId) || 'Conta nao carregada'} | Cliente: {clientNameById.get(schedule.clientId) || 'Cliente nao carregado'} | Timezone: {schedule.timezone}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CampaignSquadShell>
  )
}
