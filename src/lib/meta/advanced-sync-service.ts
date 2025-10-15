/**
 * Serviço de Sincronização Avançado Meta Ads
 * - Sincronização incremental
 * - Detecção de mudanças
 * - Processamento em lote
 * - Recuperação de falhas
 * - Monitoramento de performance
 */

import { createClient } from '@/lib/supabase/server'
import AdvancedMetaClient from './advanced-client'
import { MetaAccount, MetaCampaign, MetaInsights } from './types'

interface SyncJob {
  id: string
  organizationId: string
  connectionId: string
  type: 'full' | 'incremental' | 'insights'
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt?: Date
  completedAt?: Date
  error?: string
  progress: {
    total: number
    completed: number
    failed: number
  }
  metadata: Record<string, any>
}

interface SyncResult {
  success: boolean
  jobId: string
  duration: number
  itemsProcessed: number
  itemsFailed: number
  errors: string[]
}

interface SyncConfig {
  batchSize: number
  maxConcurrency: number
  retryAttempts: number
  insightsLookbackDays: number
  enableIncrementalSync: boolean
}

export class AdvancedSyncService {
  private supabase = createClient()
  private runningJobs = new Map<string, SyncJob>()
  private config: SyncConfig = {
    batchSize: 50,
    maxConcurrency: 3,
    retryAttempts: 3,
    insightsLookbackDays: 30,
    enableIncrementalSync: true
  }

  /**
   * Inicia sincronização completa para uma conexão
   */
  async startFullSync(connectionId: string, organizationId: string): Promise<string> {
    const jobId = this.generateJobId()
    
    const job: SyncJob = {
      id: jobId,
      organizationId,
      connectionId,
      type: 'full',
      status: 'pending',
      progress: { total: 0, completed: 0, failed: 0 },
      metadata: {}
    }

    this.runningJobs.set(jobId, job)
    
    // Executar em background
    this.executeFullSync(job).catch(error => {
      console.error(`Full sync job ${jobId} failed:`, error)
      job.status = 'failed'
      job.error = error.message
      job.completedAt = new Date()
    })

    return jobId
  }

  /**
   * Inicia sincronização incremental
   */
  async startIncrementalSync(connectionId: string, organizationId: string): Promise<string> {
    if (!this.config.enableIncrementalSync) {
      return this.startFullSync(connectionId, organizationId)
    }

    const jobId = this.generateJobId()
    
    const job: SyncJob = {
      id: jobId,
      organizationId,
      connectionId,
      type: 'incremental',
      status: 'pending',
      progress: { total: 0, completed: 0, failed: 0 },
      metadata: {}
    }

    this.runningJobs.set(jobId, job)
    
    // Executar em background
    this.executeIncrementalSync(job).catch(error => {
      console.error(`Incremental sync job ${jobId} failed:`, error)
      job.status = 'failed'
      job.error = error.message
      job.completedAt = new Date()
    })

    return jobId
  }

  /**
   * Executa sincronização completa
   */
  private async executeFullSync(job: SyncJob): Promise<void> {
    job.status = 'running'
    job.startedAt = new Date()

    try {
      // Buscar dados da conexão
      const { data: connection } = await this.supabase
        .from('meta_connections')
        .select('*')
        .eq('id', job.connectionId)
        .single()

      if (!connection) {
        throw new Error('Connection not found')
      }

      const client = new AdvancedMetaClient(connection.access_token)

      // 1. Sincronizar contas
      await this.syncAccounts(client, job)

      // 2. Sincronizar campanhas
      await this.syncCampaigns(client, job)

      // 3. Sincronizar insights
      await this.syncInsights(client, job)

      job.status = 'completed'
      job.completedAt = new Date()

      // Registrar log de sucesso
      await this.logSyncResult(job, {
        success: true,
        jobId: job.id,
        duration: job.completedAt.getTime() - job.startedAt!.getTime(),
        itemsProcessed: job.progress.completed,
        itemsFailed: job.progress.failed,
        errors: []
      })

    } catch (error) {
      job.status = 'failed'
      job.error = error instanceof Error ? error.message : 'Unknown error'
      job.completedAt = new Date()

      await this.logSyncResult(job, {
        success: false,
        jobId: job.id,
        duration: job.completedAt.getTime() - (job.startedAt?.getTime() || Date.now()),
        itemsProcessed: job.progress.completed,
        itemsFailed: job.progress.failed + 1,
        errors: [job.error]
      })

      throw error
    }
  }

  /**
   * Executa sincronização incremental
   */
  private async executeIncrementalSync(job: SyncJob): Promise<void> {
    job.status = 'running'
    job.startedAt = new Date()

    try {
      // Buscar última sincronização
      const { data: lastSync } = await this.supabase
        .from('sync_logs')
        .select('completed_at')
        .eq('connection_id', job.connectionId)
        .eq('success', true)
        .order('completed_at', { ascending: false })
        .limit(1)
        .single()

      const lastSyncDate = lastSync?.completed_at ? new Date(lastSync.completed_at) : new Date(Date.now() - 24 * 60 * 60 * 1000)

      // Buscar dados da conexão
      const { data: connection } = await this.supabase
        .from('meta_connections')
        .select('*')
        .eq('id', job.connectionId)
        .single()

      if (!connection) {
        throw new Error('Connection not found')
      }

      const client = new AdvancedMetaClient(connection.access_token)

      // Sincronizar apenas insights recentes
      await this.syncRecentInsights(client, job, lastSyncDate)

      job.status = 'completed'
      job.completedAt = new Date()

      await this.logSyncResult(job, {
        success: true,
        jobId: job.id,
        duration: job.completedAt.getTime() - job.startedAt!.getTime(),
        itemsProcessed: job.progress.completed,
        itemsFailed: job.progress.failed,
        errors: []
      })

    } catch (error) {
      job.status = 'failed'
      job.error = error instanceof Error ? error.message : 'Unknown error'
      job.completedAt = new Date()

      await this.logSyncResult(job, {
        success: false,
        jobId: job.id,
        duration: job.completedAt.getTime() - (job.startedAt?.getTime() || Date.now()),
        itemsProcessed: job.progress.completed,
        itemsFailed: job.progress.failed + 1,
        errors: [job.error]
      })

      throw error
    }
  }

  /**
   * Sincroniza contas de anúncios
   */
  private async syncAccounts(client: AdvancedMetaClient, job: SyncJob): Promise<void> {
    const accounts = await client.getAdAccounts(false) // Não usar cache
    job.progress.total += accounts.length

    for (const account of accounts) {
      try {
        await this.supabase
          .from('meta_accounts')
          .upsert({
            id: account.id,
            connection_id: job.connectionId,
            organization_id: job.organizationId,
            name: account.name,
            account_status: account.account_status,
            currency: account.currency,
            timezone_name: account.timezone_name,
            business_id: account.business?.id,
            business_name: account.business?.name,
            updated_at: new Date().toISOString()
          })

        job.progress.completed++
      } catch (error) {
        console.error(`Failed to sync account ${account.id}:`, error)
        job.progress.failed++
      }
    }
  }

  /**
   * Sincroniza campanhas
   */
  private async syncCampaigns(client: AdvancedMetaClient, job: SyncJob): Promise<void> {
    // Buscar contas sincronizadas
    const { data: accounts } = await this.supabase
      .from('meta_accounts')
      .select('id')
      .eq('connection_id', job.connectionId)

    if (!accounts) return

    for (const account of accounts) {
      try {
        const campaigns = await client.getCampaigns(account.id, false)
        job.progress.total += campaigns.length

        // Processar em lotes
        for (let i = 0; i < campaigns.length; i += this.config.batchSize) {
          const batch = campaigns.slice(i, i + this.config.batchSize)
          
          await Promise.all(batch.map(async (campaign) => {
            try {
              await this.supabase
                .from('meta_campaigns')
                .upsert({
                  id: campaign.id,
                  account_id: account.id,
                  connection_id: job.connectionId,
                  organization_id: job.organizationId,
                  name: campaign.name,
                  status: campaign.status,
                  objective: campaign.objective,
                  created_time: campaign.created_time,
                  updated_time: campaign.updated_time,
                  start_time: campaign.start_time,
                  stop_time: campaign.stop_time,
                  daily_budget: campaign.daily_budget,
                  lifetime_budget: campaign.lifetime_budget,
                  updated_at: new Date().toISOString()
                })

              job.progress.completed++
            } catch (error) {
              console.error(`Failed to sync campaign ${campaign.id}:`, error)
              job.progress.failed++
            }
          }))
        }
      } catch (error) {
        console.error(`Failed to sync campaigns for account ${account.id}:`, error)
      }
    }
  }

  /**
   * Sincroniza insights
   */
  private async syncInsights(client: AdvancedMetaClient, job: SyncJob): Promise<void> {
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - this.config.insightsLookbackDays * 24 * 60 * 60 * 1000)

    // Buscar campanhas para sincronizar insights
    const { data: campaigns } = await this.supabase
      .from('meta_campaigns')
      .select('id, account_id')
      .eq('connection_id', job.connectionId)

    if (!campaigns) return

    job.progress.total += campaigns.length

    for (const campaign of campaigns) {
      try {
        const insights = await client.getInsights(
          campaign.id,
          'campaign',
          {
            since: startDate.toISOString().split('T')[0],
            until: endDate.toISOString().split('T')[0]
          },
          [],
          false // Não usar cache
        )

        for (const insight of insights) {
          await this.supabase
            .from('meta_insights')
            .upsert({
              campaign_id: campaign.id,
              account_id: campaign.account_id,
              connection_id: job.connectionId,
              organization_id: job.organizationId,
              date_start: insight.date_start,
              date_stop: insight.date_stop,
              impressions: parseInt(insight.impressions || '0'),
              clicks: parseInt(insight.clicks || '0'),
              spend: parseFloat(insight.spend || '0'),
              reach: parseInt(insight.reach || '0'),
              ctr: parseFloat(insight.ctr || '0'),
              cpc: parseFloat(insight.cpc || '0'),
              cpp: parseFloat(insight.cpp || '0'),
              cpm: parseFloat(insight.cpm || '0'),
              updated_at: new Date().toISOString()
            })
        }

        job.progress.completed++
      } catch (error) {
        console.error(`Failed to sync insights for campaign ${campaign.id}:`, error)
        job.progress.failed++
      }
    }
  }

  /**
   * Sincroniza insights recentes (incremental)
   */
  private async syncRecentInsights(client: AdvancedMetaClient, job: SyncJob, since: Date): Promise<void> {
    const endDate = new Date()
    
    // Buscar campanhas ativas
    const { data: campaigns } = await this.supabase
      .from('meta_campaigns')
      .select('id, account_id')
      .eq('connection_id', job.connectionId)
      .in('status', ['ACTIVE', 'PAUSED'])

    if (!campaigns) return

    job.progress.total += campaigns.length

    for (const campaign of campaigns) {
      try {
        const insights = await client.getInsights(
          campaign.id,
          'campaign',
          {
            since: since.toISOString().split('T')[0],
            until: endDate.toISOString().split('T')[0]
          },
          [],
          false
        )

        for (const insight of insights) {
          await this.supabase
            .from('meta_insights')
            .upsert({
              campaign_id: campaign.id,
              account_id: campaign.account_id,
              connection_id: job.connectionId,
              organization_id: job.organizationId,
              date_start: insight.date_start,
              date_stop: insight.date_stop,
              impressions: parseInt(insight.impressions || '0'),
              clicks: parseInt(insight.clicks || '0'),
              spend: parseFloat(insight.spend || '0'),
              reach: parseInt(insight.reach || '0'),
              ctr: parseFloat(insight.ctr || '0'),
              cpc: parseFloat(insight.cpc || '0'),
              cpp: parseFloat(insight.cpp || '0'),
              cpm: parseFloat(insight.cpm || '0'),
              updated_at: new Date().toISOString()
            })
        }

        job.progress.completed++
      } catch (error) {
        console.error(`Failed to sync recent insights for campaign ${campaign.id}:`, error)
        job.progress.failed++
      }
    }
  }

  /**
   * Registra resultado da sincronização
   */
  private async logSyncResult(job: SyncJob, result: SyncResult): Promise<void> {
    await this.supabase
      .from('sync_logs')
      .insert({
        id: result.jobId,
        connection_id: job.connectionId,
        organization_id: job.organizationId,
        sync_type: job.type,
        success: result.success,
        started_at: job.startedAt?.toISOString(),
        completed_at: job.completedAt?.toISOString(),
        duration_ms: result.duration,
        items_processed: result.itemsProcessed,
        items_failed: result.itemsFailed,
        error_message: result.errors.join('; ') || null,
        metadata: job.metadata
      })
  }

  /**
   * Obtém status de um job
   */
  getJobStatus(jobId: string): SyncJob | null {
    return this.runningJobs.get(jobId) || null
  }

  /**
   * Lista jobs em execução
   */
  getRunningJobs(): SyncJob[] {
    return Array.from(this.runningJobs.values())
  }

  /**
   * Cancela um job
   */
  cancelJob(jobId: string): boolean {
    const job = this.runningJobs.get(jobId)
    if (job && job.status === 'running') {
      job.status = 'failed'
      job.error = 'Cancelled by user'
      job.completedAt = new Date()
      return true
    }
    return false
  }

  /**
   * Configura parâmetros de sincronização
   */
  configure(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Limpa jobs antigos da memória
   */
  cleanupJobs(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000 // 24 horas
    
    for (const [jobId, job] of this.runningJobs.entries()) {
      if (job.completedAt && job.completedAt.getTime() < cutoff) {
        this.runningJobs.delete(jobId)
      }
    }
  }

  private generateJobId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export default AdvancedSyncService