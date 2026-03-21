'use client'

import { useCallback, useEffect, useState } from 'react'
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
  cadence: 'monthly' | 'weekly'
  timezone: string
  dayOfMonth: string
  hour: string
  minute: string
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

export default function CampaignSquadSchedulesPage() {
  const { toast } = useToast()
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [readyCreatives, setReadyCreatives] = useState<ReadyCreativeInput[]>([])
  const [llmConfigs, setLlmConfigs] = useState<LlmConfig[]>([])
  const [loadingLlmConfigs, setLoadingLlmConfigs] = useState(false)

  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>({
    organizationId: 'default',
    clientId: '',
    cadence: 'monthly',
    timezone: 'America/Sao_Paulo',
    dayOfMonth: '1',
    hour: '9',
    minute: '0',
    nextRunAt: datetimeLocalFromNow(60),
    campaignName: 'Planejamento recorrente',
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
        setScheduleForm((prev) => ({ ...prev, organizationId: prev.organizationId === 'default' ? suggestedOrg : prev.organizationId }))
      }

      if (fetchedClients.length > 0) {
        setScheduleForm((prev) => ({ ...prev, clientId: prev.clientId || fetchedClients[0].id }))
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

  const loadSchedules = useCallback(async (organizationId: string) => {
    if (!organizationId.trim()) return
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

  const handleCreateSchedule = async () => {
    if (!scheduleForm.organizationId.trim() || !scheduleForm.clientId.trim()) {
      toast({ title: 'Informe organização e cliente para o agendamento', variant: 'destructive' })
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
      toast({ title: 'Orçamento do template inválido', variant: 'destructive' })
      return
    }

    const nextRunAt = new Date(scheduleForm.nextRunAt)
    if (Number.isNaN(nextRunAt.getTime())) {
      toast({ title: 'Data/hora do primeiro disparo inválida', variant: 'destructive' })
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
          cadence: scheduleForm.cadence,
          timezone: scheduleForm.timezone.trim(),
          dayOfMonth: Number(scheduleForm.dayOfMonth),
          hour: Number(scheduleForm.hour),
          minute: Number(scheduleForm.minute),
          nextRunAt: nextRunAt.toISOString(),
          payloadTemplate: {
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

      toast({ title: 'Agendamento criado com sucesso' })
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
      description="Planejamento recorrente de criativos e anúncios com controle de ativação."
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
            <CardTitle>Novo agendamento recorrente</CardTitle>
            <CardDescription>Configure cron mensal/semanal e template da campanha.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="schedule-org">Organização</Label>
                <Input id="schedule-org" value={scheduleForm.organizationId} onChange={(event) => setScheduleForm((prev) => ({ ...prev, organizationId: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-client">Cliente</Label>
                <Input id="schedule-client" list="campaign-squad-clients-schedules" value={scheduleForm.clientId} onChange={(event) => setScheduleForm((prev) => ({ ...prev, clientId: event.target.value }))} />
                <datalist id="campaign-squad-clients-schedules">
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </datalist>
                {loadingClients ? <p className="text-xs text-muted-foreground">Carregando clientes...</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-cadence">Cadência</Label>
                <Select value={scheduleForm.cadence} onValueChange={(value: 'monthly' | 'weekly') => setScheduleForm((prev) => ({ ...prev, cadence: value }))}>
                  <SelectTrigger id="schedule-cadence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-timezone">Timezone</Label>
                <Input id="schedule-timezone" value={scheduleForm.timezone} onChange={(event) => setScheduleForm((prev) => ({ ...prev, timezone: event.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="schedule-day">Dia do mês</Label>
                <Input id="schedule-day" type="number" min="1" max="31" value={scheduleForm.dayOfMonth} onChange={(event) => setScheduleForm((prev) => ({ ...prev, dayOfMonth: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-hour">Hora</Label>
                <Input id="schedule-hour" type="number" min="0" max="23" value={scheduleForm.hour} onChange={(event) => setScheduleForm((prev) => ({ ...prev, hour: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-minute">Minuto</Label>
                <Input id="schedule-minute" type="number" min="0" max="59" value={scheduleForm.minute} onChange={(event) => setScheduleForm((prev) => ({ ...prev, minute: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-next">Primeiro disparo</Label>
                <Input id="schedule-next" type="datetime-local" value={scheduleForm.nextRunAt} onChange={(event) => setScheduleForm((prev) => ({ ...prev, nextRunAt: event.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="schedule-campaign-name">Nome base da campanha</Label>
                <Input id="schedule-campaign-name" value={scheduleForm.campaignName} onChange={(event) => setScheduleForm((prev) => ({ ...prev, campaignName: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-objective">Objetivo</Label>
                <Input id="schedule-objective" value={scheduleForm.objective} onChange={(event) => setScheduleForm((prev) => ({ ...prev, objective: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-budget-amount">Orçamento</Label>
                <Input id="schedule-budget-amount" type="number" min="1" step="0.01" value={scheduleForm.budgetAmount} onChange={(event) => setScheduleForm((prev) => ({ ...prev, budgetAmount: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-budget-currency">Moeda</Label>
                <Input id="schedule-budget-currency" value={scheduleForm.budgetCurrency} onChange={(event) => setScheduleForm((prev) => ({ ...prev, budgetCurrency: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="schedule-llm-select">Configuração LLM</Label>
                <Select value={scheduleForm.llmConfigId || 'none'} onValueChange={(value) => setScheduleForm((prev) => ({ ...prev, llmConfigId: value === 'none' ? '' : value }))}>
                  <SelectTrigger id="schedule-llm-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (resolução automática)</SelectItem>
                    {llmConfigs.map((config) => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.provider}/{config.model} - {config.tokenReference}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {loadingLlmConfigs ? <p className="text-xs text-muted-foreground">Atualizando configs LLM...</p> : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label>Refação automática no template</Label>
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
              <Label htmlFor="schedule-publication-json">publicationConfig no template (JSON opcional)</Label>
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

            <Button onClick={handleCreateSchedule} disabled={submittingSchedule}>
              {submittingSchedule ? 'Criando agendamento...' : 'Criar agendamento recorrente'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agendamentos ativos</CardTitle>
            <CardDescription>Controle de status e próximos disparos.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSchedules ? (
              <p className="text-sm text-muted-foreground">Carregando agendamentos...</p>
            ) : schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum agendamento encontrado para esta organização.</p>
            ) : (
              <div className="space-y-3">
                {schedules.map((schedule) => (
                  <div key={schedule.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{schedule.id}</Badge>
                      <Badge variant="secondary">{schedule.cadence}</Badge>
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
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Próximo disparo: {schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString('pt-BR') : 'não definido'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Cliente: {schedule.clientId} • Timezone: {schedule.timezone} • Hora: {String(schedule.hour).padStart(2, '0')}:{String(schedule.minute).padStart(2, '0')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CampaignSquadShell>
  )
}
