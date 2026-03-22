'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { type ClientSummary, type SquadRun, requestJson, runStatusVariant } from '@/lib/campaign-squad/dashboard'
import { Clipboard, ExternalLink, RefreshCw } from 'lucide-react'
import { CampaignSquadShell } from '../_components/campaign-squad-shell'

type OrganizationSummary = {
  id: string
  name: string
}

type RunStatusFilter =
  | 'all'
  | 'briefing'
  | 'planning'
  | 'awaiting_plan_approval'
  | 'executing'
  | 'qa_review'
  | 'needs_manual_intervention'
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'publishing'
  | 'completed'
  | 'rejected'
  | 'failed'

const STATUS_OPTIONS: Array<{ value: RunStatusFilter; label: string }> = [
  { value: 'all', label: 'Todos os status' },
  { value: 'briefing', label: 'Briefing' },
  { value: 'planning', label: 'Planning' },
  { value: 'awaiting_plan_approval', label: 'Awaiting Plan Approval' },
  { value: 'executing', label: 'Executing' },
  { value: 'qa_review', label: 'QA Review' },
  { value: 'needs_manual_intervention', label: 'Needs Manual Intervention' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'awaiting_approval', label: 'Awaiting Approval' },
  { value: 'publishing', label: 'Publishing' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'failed', label: 'Failed' }
]

export default function CampaignSquadHistoryPage() {
  const { toast } = useToast()

  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([])
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loadingContext, setLoadingContext] = useState(false)

  const [organizationFilter, setOrganizationFilter] = useState<string>('all')
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<RunStatusFilter>('all')
  const [limitFilter, setLimitFilter] = useState<string>('50')
  const [searchTerm, setSearchTerm] = useState('')

  const [runs, setRuns] = useState<SquadRun[]>([])
  const [loadingRuns, setLoadingRuns] = useState(false)

  const organizationNameById = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization.name])),
    [organizations]
  )
  const clientNameById = useMemo(
    () => new Map(clients.map((client) => [client.id, client.name])),
    [clients]
  )

  const clientsForSelectedOrganization = useMemo(() => {
    if (organizationFilter === 'all') return clients
    return clients.filter((client) => client.organization_id === organizationFilter)
  }, [clients, organizationFilter])

  const filteredRunsBySearch = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase()
    if (!normalized) return runs
    return runs.filter((run) => {
      const campaignName = run.campaignName?.toLowerCase() || ''
      const runId = run.id?.toLowerCase() || ''
      return campaignName.includes(normalized) || runId.includes(normalized)
    })
  }, [runs, searchTerm])

  const loadContext = useCallback(async () => {
    setLoadingContext(true)
    try {
      const data = await requestJson<{
        clients: Array<{
          id: string
          name: string
          organization_id?: string | null
          organization_name?: string | null
        }>
        organizations?: Array<{ id: string; name: string }>
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
    } catch (error) {
      toast({
        title: 'Falha ao carregar organizacoes e clientes',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setLoadingContext(false)
    }
  }, [toast])

  const loadRuns = useCallback(async () => {
    setLoadingRuns(true)
    try {
      const query = new URLSearchParams()
      if (organizationFilter !== 'all') query.set('organizationId', organizationFilter)
      if (clientFilter !== 'all') query.set('clientId', clientFilter)
      if (statusFilter !== 'all') query.set('status', statusFilter)
      query.set('limit', limitFilter || '50')

      const data = await requestJson<{ data: SquadRun[] }>(`/api/campaign-squad/runs?${query.toString()}`)
      setRuns(Array.isArray(data.data) ? data.data : [])
    } catch (error) {
      toast({
        title: 'Falha ao carregar historico de runs',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setLoadingRuns(false)
    }
  }, [clientFilter, limitFilter, organizationFilter, statusFilter, toast])

  useEffect(() => {
    loadContext()
  }, [loadContext])

  useEffect(() => {
    setClientFilter((prev) => {
      if (organizationFilter === 'all') return prev
      const allowed = clients.filter((client) => client.organization_id === organizationFilter)
      if (prev === 'all') return prev
      const stillExists = allowed.some((client) => client.id === prev)
      return stillExists ? prev : 'all'
    })
  }, [clients, organizationFilter])

  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  const handleCopyRunId = async (runId: string) => {
    try {
      await navigator.clipboard.writeText(runId)
      toast({
        title: 'Run ID copiado',
        description: runId
      })
    } catch {
      toast({
        title: 'Nao foi possivel copiar o Run ID',
        variant: 'destructive'
      })
    }
  }

  return (
    <CampaignSquadShell
      title="Historico de Runs"
      description="Lista de runs executados para acompanhamento e consulta rapida."
      actions={(
        <Button variant="outline" onClick={loadRuns} disabled={loadingRuns}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loadingRuns ? 'animate-spin' : ''}`} />
          Atualizar lista
        </Button>
      )}
    >
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Refine a busca por organizacao, cliente, status e texto.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="space-y-2">
            <Label>Organizacao</Label>
            <Select value={organizationFilter} onValueChange={setOrganizationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {organizations.map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {clientsForSelectedOrganization.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(value: RunStatusFilter) => setStatusFilter(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Limite</Label>
            <Select value={limitFilter} onValueChange={setLimitFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Busca</Label>
            <Input
              placeholder="Nome da campanha ou Run ID"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runs</CardTitle>
          <CardDescription>
            {loadingContext ? 'Carregando contexto...' : `${filteredRunsBySearch.length} run(s) encontrado(s).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRuns ? (
            <p className="text-sm text-muted-foreground">Carregando runs...</p>
          ) : filteredRunsBySearch.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum run encontrado com os filtros atuais.</p>
          ) : (
            <div className="space-y-3">
              {filteredRunsBySearch.map((run) => (
                <div key={run.id} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={runStatusVariant(run.status)}>{run.status}</Badge>
                    <Badge variant="secondary">{run.stage}</Badge>
                    <Badge variant="outline">ID: {run.id}</Badge>
                  </div>

                  <p className="mt-2 text-sm font-semibold">{run.campaignName}</p>
                  <p className="text-xs text-muted-foreground">
                    Organizacao: {organizationNameById.get(run.organizationId) || 'Conta não carregada'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cliente: {clientNameById.get(run.clientId) || 'Cliente não carregado'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Criado em: {run.createdAt ? new Date(run.createdAt).toLocaleString('pt-BR') : '-'}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={`/dashboard/campaign-squad/runs?runId=${encodeURIComponent(run.id)}`}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir acompanhamento
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleCopyRunId(run.id)}>
                      <Clipboard className="mr-2 h-4 w-4" />
                      Copiar Run ID
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </CampaignSquadShell>
  )
}
