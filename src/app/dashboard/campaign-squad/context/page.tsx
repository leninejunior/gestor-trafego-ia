'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { type ClientSummary, requestJson } from '@/lib/campaign-squad/dashboard'
import { RefreshCw, Save } from 'lucide-react'
import { CampaignSquadShell } from '../_components/campaign-squad-shell'

type OrganizationSummary = {
  id: string
  name: string
}

type ContextFormState = {
  companyOverview: string
  productsServices: string
  targetAudience: string
  valueProps: string
  brandVoice: string
  constraints: string
  offers: string
  notes: string
}

const EMPTY_CONTEXT: ContextFormState = {
  companyOverview: '',
  productsServices: '',
  targetAudience: '',
  valueProps: '',
  brandVoice: '',
  constraints: '',
  offers: '',
  notes: ''
}

export default function CampaignSquadContextPage() {
  const { toast } = useToast()
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([])
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [loadingContext, setLoadingContext] = useState(false)
  const [savingContext, setSavingContext] = useState(false)
  const [organizationId, setOrganizationId] = useState<string>('')
  const [clientId, setClientId] = useState<string>('')
  const [contextForm, setContextForm] = useState<ContextFormState>(EMPTY_CONTEXT)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const clientsForSelectedOrganization = useMemo(
    () => clients.filter((client) => client.organization_id === organizationId),
    [clients, organizationId]
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
                .map((client) => [
                  client.organization_id as string,
                  { id: client.organization_id as string, name: client.organization_name as string }
                ])
            ).values()
          )
      setOrganizations(derivedOrganizations)

      const suggestedOrg = typeof data.organizationId === 'string' ? data.organizationId : ''
      const defaultOrg = suggestedOrg || derivedOrganizations[0]?.id || ''
      setOrganizationId((prev) => prev || defaultOrg)

      const clientsForOrg = fetchedClients.filter((client) => client.organization_id === defaultOrg)
      if (clientsForOrg.length > 0) {
        setClientId((prev) => (prev && clientsForOrg.some((client) => client.id === prev) ? prev : clientsForOrg[0].id))
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

  const loadContext = useCallback(async (targetClientId: string) => {
    if (!targetClientId) {
      setContextForm(EMPTY_CONTEXT)
      setUpdatedAt(null)
      return
    }

    setLoadingContext(true)
    try {
      const data = await requestJson<{
        context: ContextFormState & { updatedAt?: string | null }
      }>(`/api/clients/${targetClientId}/context`)

      setContextForm({
        companyOverview: data.context.companyOverview || '',
        productsServices: data.context.productsServices || '',
        targetAudience: data.context.targetAudience || '',
        valueProps: data.context.valueProps || '',
        brandVoice: data.context.brandVoice || '',
        constraints: data.context.constraints || '',
        offers: data.context.offers || '',
        notes: data.context.notes || ''
      })
      setUpdatedAt(data.context.updatedAt || null)
    } catch (error) {
      toast({
        title: 'Falha ao carregar contexto',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
      setContextForm(EMPTY_CONTEXT)
      setUpdatedAt(null)
    } finally {
      setLoadingContext(false)
    }
  }, [toast])

  const handleSaveContext = async () => {
    if (!clientId) {
      toast({ title: 'Selecione um cliente', variant: 'destructive' })
      return
    }

    setSavingContext(true)
    try {
      const payload = {
        companyOverview: contextForm.companyOverview,
        productsServices: contextForm.productsServices,
        targetAudience: contextForm.targetAudience,
        valueProps: contextForm.valueProps,
        brandVoice: contextForm.brandVoice,
        constraints: contextForm.constraints,
        offers: contextForm.offers,
        notes: contextForm.notes
      }

      const data = await requestJson<{ context: { updatedAt?: string | null } }>(`/api/clients/${clientId}/context`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })

      setUpdatedAt(data.context.updatedAt || null)
      toast({ title: 'Contexto salvo com sucesso' })
    } catch (error) {
      toast({
        title: 'Falha ao salvar contexto',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setSavingContext(false)
    }
  }

  useEffect(() => {
    loadClients()
  }, [loadClients])

  useEffect(() => {
    if (!organizationId) return
    setClientId((prev) => {
      const allowed = clients.filter((client) => client.organization_id === organizationId)
      if (allowed.length === 0) return ''
      if (prev && allowed.some((client) => client.id === prev)) return prev
      return allowed[0].id
    })
  }, [clients, organizationId])

  useEffect(() => {
    loadContext(clientId)
  }, [clientId, loadContext])

  return (
    <CampaignSquadShell
      title="Contexto do Cliente"
      description="RAG fixo por cliente aplicado automaticamente em runs conversacionais."
      actions={(
        <Button variant="outline" onClick={loadClients} disabled={loadingClients}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loadingClients ? 'animate-spin' : ''}`} />
          Atualizar clientes
        </Button>
      )}
    >
      <Card>
        <CardHeader>
          <CardTitle>Selecionar Cliente</CardTitle>
          <CardDescription>Escolha conta e cliente para editar contexto fixo.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Conta</Label>
            <Select value={organizationId} onValueChange={setOrganizationId}>
              <SelectTrigger>
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
            <Label>Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campos de Contexto (RAG)</CardTitle>
          <CardDescription>
            {updatedAt
              ? `Ultima atualizacao: ${new Date(updatedAt).toLocaleString('pt-BR')}`
              : 'Sem atualizacao registrada ainda.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Visao geral da empresa</Label>
            <Textarea
              value={contextForm.companyOverview}
              onChange={(event) => setContextForm((prev) => ({ ...prev, companyOverview: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Produtos e servicos</Label>
            <Textarea
              value={contextForm.productsServices}
              onChange={(event) => setContextForm((prev) => ({ ...prev, productsServices: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Publico alvo</Label>
            <Textarea
              value={contextForm.targetAudience}
              onChange={(event) => setContextForm((prev) => ({ ...prev, targetAudience: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Diferenciais e proposta de valor</Label>
            <Textarea
              value={contextForm.valueProps}
              onChange={(event) => setContextForm((prev) => ({ ...prev, valueProps: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Tom de voz da marca</Label>
            <Textarea
              value={contextForm.brandVoice}
              onChange={(event) => setContextForm((prev) => ({ ...prev, brandVoice: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Restricoes</Label>
            <Textarea
              value={contextForm.constraints}
              onChange={(event) => setContextForm((prev) => ({ ...prev, constraints: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Ofertas ativas</Label>
            <Textarea
              value={contextForm.offers}
              onChange={(event) => setContextForm((prev) => ({ ...prev, offers: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Notas adicionais</Label>
            <Textarea
              value={contextForm.notes}
              onChange={(event) => setContextForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>

          <Button onClick={handleSaveContext} disabled={savingContext || loadingContext || !clientId}>
            <Save className="mr-2 h-4 w-4" />
            {savingContext ? 'Salvando...' : 'Salvar contexto'}
          </Button>
        </CardContent>
      </Card>
    </CampaignSquadShell>
  )
}
