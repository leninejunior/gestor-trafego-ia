'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { type LlmConfig, requestJson } from '@/lib/campaign-squad/dashboard'
import { RefreshCw, Wand2 } from 'lucide-react'
import { CampaignSquadShell } from '../_components/campaign-squad-shell'

type LlmFormState = {
  organizationId: string
  provider: string
  model: string
  tokenReference: string
  agentRole: string
  temperature: string
  maxTokens: string
  fallbackModel: string
}

export default function CampaignSquadLlmPage() {
  const { toast } = useToast()
  const [llmForm, setLlmForm] = useState<LlmFormState>({
    organizationId: 'default',
    provider: 'openai',
    model: 'gpt-5.4-mini',
    tokenReference: 'env:OPENAI_API_KEY',
    agentRole: 'default',
    temperature: '0.3',
    maxTokens: '4000',
    fallbackModel: 'gpt-5.4-mini'
  })

  const [llmConfigs, setLlmConfigs] = useState<LlmConfig[]>([])
  const [loadingLlmConfigs, setLoadingLlmConfigs] = useState(false)
  const [submittingLlm, setSubmittingLlm] = useState(false)

  const loadLlmConfigs = useCallback(async (organizationId: string) => {
    if (!organizationId.trim()) return
    setLoadingLlmConfigs(true)
    try {
      const query = new URLSearchParams({ organizationId }).toString()
      const data = await requestJson<{ data: LlmConfig[] }>(`/api/campaign-squad/llm-configs?${query}`)
      const configs = Array.isArray(data.data) ? data.data : []
      setLlmConfigs(configs)
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

  useEffect(() => {
    loadLlmConfigs(llmForm.organizationId)
  }, [llmForm.organizationId, loadLlmConfigs])

  const handleCreateLlmConfig = async () => {
    if (!llmForm.organizationId.trim()) {
      toast({ title: 'Informe a organização da configuração LLM', variant: 'destructive' })
      return
    }

    setSubmittingLlm(true)
    try {
      const temperature = Number(llmForm.temperature)
      const maxTokens = Number(llmForm.maxTokens)

      await requestJson('/api/campaign-squad/llm-configs', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: llmForm.organizationId.trim(),
          provider: llmForm.provider.trim(),
          model: llmForm.model.trim(),
          tokenReference: llmForm.tokenReference.trim(),
          agentRole: llmForm.agentRole.trim() || undefined,
          temperature: Number.isFinite(temperature) ? temperature : undefined,
          maxTokens: Number.isFinite(maxTokens) ? maxTokens : undefined,
          fallbackModel: llmForm.fallbackModel.trim() || undefined
        })
      })

      toast({ title: 'Configuração LLM criada com sucesso' })
      await loadLlmConfigs(llmForm.organizationId.trim())
    } catch (error) {
      toast({
        title: 'Falha ao criar configuração LLM',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setSubmittingLlm(false)
    }
  }

  return (
    <CampaignSquadShell
      title="Configuração LLM"
      description="Escolha token/modelo por organização para cada papel do squad."
      actions={(
        <>
          <Button variant="outline" onClick={() => loadLlmConfigs(llmForm.organizationId)} disabled={loadingLlmConfigs}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingLlmConfigs ? 'animate-spin' : ''}`} />
            Atualizar lista
          </Button>
        </>
      )}
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Nova configuração
            </CardTitle>
            <CardDescription>Provider, modelo e token de referência para o squad.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="llm-org">Organização</Label>
                <Input id="llm-org" value={llmForm.organizationId} onChange={(event) => setLlmForm((prev) => ({ ...prev, organizationId: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="llm-provider">Provider</Label>
                <Input id="llm-provider" value={llmForm.provider} onChange={(event) => setLlmForm((prev) => ({ ...prev, provider: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="llm-model">Modelo</Label>
                <Input id="llm-model" value={llmForm.model} onChange={(event) => setLlmForm((prev) => ({ ...prev, model: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="llm-token">Token Reference</Label>
                <Input id="llm-token" value={llmForm.tokenReference} onChange={(event) => setLlmForm((prev) => ({ ...prev, tokenReference: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="llm-role">Role do agente</Label>
                <Input id="llm-role" value={llmForm.agentRole} onChange={(event) => setLlmForm((prev) => ({ ...prev, agentRole: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="llm-fallback">Fallback Model</Label>
                <Input id="llm-fallback" value={llmForm.fallbackModel} onChange={(event) => setLlmForm((prev) => ({ ...prev, fallbackModel: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="llm-temp">Temperatura</Label>
                <Input id="llm-temp" type="number" step="0.1" value={llmForm.temperature} onChange={(event) => setLlmForm((prev) => ({ ...prev, temperature: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="llm-max">Max Tokens</Label>
                <Input id="llm-max" type="number" value={llmForm.maxTokens} onChange={(event) => setLlmForm((prev) => ({ ...prev, maxTokens: event.target.value }))} />
              </div>
            </div>

            <Button onClick={handleCreateLlmConfig} disabled={submittingLlm}>
              {submittingLlm ? 'Salvando...' : 'Salvar configuração LLM'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configurações cadastradas</CardTitle>
            <CardDescription>Escopo por organização com token mascarado.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingLlmConfigs ? (
              <p className="text-sm text-muted-foreground">Carregando configurações...</p>
            ) : llmConfigs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma configuração LLM para esta organização.</p>
            ) : (
              <div className="space-y-3">
                {llmConfigs.map((config) => (
                  <div key={config.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{config.provider}</Badge>
                      <Badge variant="secondary">{config.model}</Badge>
                      <Badge variant="outline">{config.tokenReference}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Role: {config.agentRole || 'default'} • Temp: {config.temperature ?? '-'} • Max tokens: {config.maxTokens ?? '-'}
                    </p>
                    {config.fallbackModel ? (
                      <p className="text-xs text-muted-foreground">Fallback: {config.fallbackModel}</p>
                    ) : null}
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
