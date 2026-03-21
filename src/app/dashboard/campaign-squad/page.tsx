'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { type ServiceHealth, requestJson } from '@/lib/campaign-squad/dashboard'
import { CalendarClock, ListTodo, RefreshCw, Rocket, ShieldCheck, Wand2 } from 'lucide-react'
import { CampaignSquadShell } from './_components/campaign-squad-shell'

type JiraBacklogResult = {
  success: boolean
  epic?: { key?: string | null; created?: boolean; existing?: boolean }
  stories?: {
    created?: Array<{ key: string; summary: string }>
    existing?: Array<{ key: string; summary: string }>
    failed?: Array<{ summary: string; reason: string }>
  }
}

const SECTION_CARDS = [
  {
    href: '/dashboard/campaign-squad/runs',
    title: 'Runs e Aprovação',
    description: 'Start manual da campanha, criativos prontos, aprovação e envio para WhatsApp.',
    icon: Rocket
  },
  {
    href: '/dashboard/campaign-squad/schedules',
    title: 'Agendamentos',
    description: 'Planejamento recorrente mensal/semanal com trigger manual dos vencidos.',
    icon: CalendarClock
  },
  {
    href: '/dashboard/campaign-squad/llm',
    title: 'Configuração LLM',
    description: 'Gerencie provider, token reference e modelo por organização.',
    icon: Wand2
  }
]

export default function CampaignSquadOverviewPage() {
  const { toast } = useToast()
  const [healthInfo, setHealthInfo] = useState<ServiceHealth | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(false)
  const [jiraSyncMode, setJiraSyncMode] = useState<'dry-run' | 'apply' | null>(null)

  const loadHealth = useCallback(async () => {
    setLoadingHealth(true)
    try {
      const data = await requestJson<ServiceHealth>('/api/campaign-squad/health')
      setHealthInfo(data)
    } catch (error) {
      toast({
        title: 'Falha ao consultar saúde do serviço',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setLoadingHealth(false)
    }
  }, [toast])

  useEffect(() => {
    loadHealth()
  }, [loadHealth])

  const handleCreateJiraBacklog = async (mode: 'dry-run' | 'apply') => {
    setJiraSyncMode(mode)
    try {
      const response = await requestJson<JiraBacklogResult>('/api/campaign-squad/jira/backlog', {
        method: 'POST',
        body: JSON.stringify({
          skipIfExists: true,
          dryRun: mode === 'dry-run'
        })
      })

      const createdCount = response.stories?.created?.length || 0
      const existingCount = response.stories?.existing?.length || 0
      const failedCount = response.stories?.failed?.length || 0
      const epicKey = response.epic?.key ? ` Epic: ${response.epic.key}.` : ''

      toast({
        title: mode === 'dry-run' ? 'Dry-run do backlog Jira concluído' : 'Backlog Jira sincronizado',
        description: `Criadas: ${createdCount}, existentes: ${existingCount}, falhas: ${failedCount}.${epicKey}`
      })
    } catch (error) {
      toast({
        title: 'Falha ao sincronizar backlog no Jira',
        description: error instanceof Error ? error.message : 'Erro inesperado',
        variant: 'destructive'
      })
    } finally {
      setJiraSyncMode(null)
    }
  }

  return (
    <CampaignSquadShell
      title="Visão Geral"
      description="Fluxo do squad organizado por páginas para planejamento, produção, aprovação e publicação."
      actions={(
        <>
          <Badge variant={healthInfo?.ok ? 'default' : 'destructive'}>
            {healthInfo?.ok ? 'Serviço online' : 'Serviço indisponível'}
          </Badge>
          <Badge variant="outline">{healthInfo?.queueMode || 'sem fila'}</Badge>
          <Button variant="outline" onClick={() => handleCreateJiraBacklog('dry-run')} disabled={jiraSyncMode !== null}>
            <ListTodo className="mr-2 h-4 w-4" />
            {jiraSyncMode === 'dry-run' ? 'Validando Jira...' : 'Dry-run Jira'}
          </Button>
          <Button variant="outline" onClick={() => handleCreateJiraBacklog('apply')} disabled={jiraSyncMode !== null}>
            <ListTodo className="mr-2 h-4 w-4" />
            {jiraSyncMode === 'apply' ? 'Sincronizando Jira...' : 'Enviar backlog ao Jira'}
          </Button>
          <Button variant="outline" onClick={loadHealth} disabled={loadingHealth}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingHealth ? 'animate-spin' : ''}`} />
            Saúde
          </Button>
        </>
      )}
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {SECTION_CARDS.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.href}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  {item.title}
                </CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={item.href}>Abrir página</Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Fluxo operacional
          </CardTitle>
          <CardDescription>Execução recomendada dentro do Campaign Squad.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Configure ou revise modelos/tokens na página de LLM.</p>
          <p>2. Dispare runs manuais para campanhas pontuais e aprove materiais no painel.</p>
          <p>3. Crie agendamentos recorrentes para rotina mensal/semanal de criativos e anúncios.</p>
          <p>4. Use o envio por WhatsApp para aprovação externa quando necessário.</p>
        </CardContent>
      </Card>
    </CampaignSquadShell>
  )
}
