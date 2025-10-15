import { createClient } from '@/lib/supabase/server';
import { MetaAdsApiClient, formatInsightsData, calculateAggregatedMetrics } from './api-client';

export interface SyncResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  syncedAt: Date;
  recordsProcessed?: number;
}

export interface SyncOptions {
  dateRange?: {
    since: string;
    until: string;
  };
  forceSync?: boolean;
  syncInsights?: boolean;
  syncCampaigns?: boolean;
  syncAudience?: boolean;
}

export class MetaAdsSyncService {
  private supabase: any;
  private metaClient: MetaAdsApiClient;

  constructor(accessToken: string) {
    this.supabase = createClient();
    this.metaClient = new MetaAdsApiClient(accessToken);
  }

  // Sincronizar todas as contas de anúncios
  async syncAdAccounts(userId: string): Promise<SyncResult> {
    try {
      console.log('🔄 Iniciando sincronização de contas de anúncios...');

      // Buscar contas do Meta
      const { data: adAccounts } = await this.metaClient.getAdAccounts();

      if (!adAccounts || adAccounts.length === 0) {
        return {
          success: false,
          message: 'Nenhuma conta de anúncios encontrada',
          syncedAt: new Date()
        };
      }

      // Buscar conexões existentes do usuário
      const { data: existingConnections } = await this.supabase
        .from('client_meta_connections')
        .select('account_id, client_id')
        .eq('created_by', userId);

      const existingAccountIds = existingConnections?.map(conn => conn.account_id) || [];

      // Processar cada conta
      let syncedCount = 0;
      for (const account of adAccounts) {
        // Pular se já existe
        if (existingAccountIds.includes(account.id)) {
          continue;
        }

        // Buscar ou criar cliente padrão para o usuário
        let { data: defaultClient } = await this.supabase
          .from('clients')
          .select('id')
          .eq('created_by', userId)
          .eq('name', 'Meta Ads - Conta Principal')
          .single();

        if (!defaultClient) {
          const { data: newClient } = await this.supabase
            .from('clients')
            .insert({
              name: 'Meta Ads - Conta Principal',
              created_by: userId,
              organization_id: await this.getUserOrganizationId(userId)
            })
            .select('id')
            .single();
          
          defaultClient = newClient;
        }

        // Criar conexão
        await this.supabase
          .from('client_meta_connections')
          .insert({
            client_id: defaultClient.id,
            account_id: account.id,
            account_name: account.name,
            is_active: account.account_status === 1,
            created_by: userId,
            last_sync: new Date().toISOString(),
            sync_status: 'active'
          });

        syncedCount++;
      }

      return {
        success: true,
        message: `${syncedCount} contas sincronizadas com sucesso`,
        recordsProcessed: syncedCount,
        syncedAt: new Date()
      };

    } catch (error) {
      console.error('Erro na sincronização de contas:', error);
      return {
        success: false,
        message: 'Erro na sincronização de contas',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        syncedAt: new Date()
      };
    }
  }

  // Sincronizar campanhas de uma conta
  async syncCampaigns(accountId: string, userId: string): Promise<SyncResult> {
    try {
      console.log(`🔄 Sincronizando campanhas da conta ${accountId}...`);

      // Buscar campanhas do Meta
      const { data: campaigns } = await this.metaClient.getCampaigns(`act_${accountId}`);

      if (!campaigns || campaigns.length === 0) {
        return {
          success: true,
          message: 'Nenhuma campanha encontrada',
          recordsProcessed: 0,
          syncedAt: new Date()
        };
      }

      // Buscar conexão existente
      const { data: connection } = await this.supabase
        .from('client_meta_connections')
        .select('id, client_id')
        .eq('account_id', accountId)
        .eq('created_by', userId)
        .single();

      if (!connection) {
        throw new Error('Conexão não encontrada para esta conta');
      }

      // Processar campanhas
      let syncedCount = 0;
      for (const campaign of campaigns) {
        // Verificar se campanha já existe
        const { data: existingCampaign } = await this.supabase
          .from('meta_campaigns')
          .select('id')
          .eq('campaign_id', campaign.id)
          .single();

        const campaignData = {
          campaign_id: campaign.id,
          connection_id: connection.id,
          name: campaign.name,
          status: campaign.status,
          objective: campaign.objective,
          created_time: campaign.created_time,
          updated_time: campaign.updated_time,
          start_time: campaign.start_time,
          stop_time: campaign.stop_time,
          daily_budget: campaign.daily_budget ? parseFloat(campaign.daily_budget) : null,
          lifetime_budget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) : null,
          bid_strategy: campaign.bid_strategy,
          last_sync: new Date().toISOString()
        };

        if (existingCampaign) {
          // Atualizar campanha existente
          await this.supabase
            .from('meta_campaigns')
            .update(campaignData)
            .eq('id', existingCampaign.id);
        } else {
          // Criar nova campanha
          await this.supabase
            .from('meta_campaigns')
            .insert(campaignData);
        }

        syncedCount++;
      }

      // Atualizar status da conexão
      await this.supabase
        .from('client_meta_connections')
        .update({
          last_sync: new Date().toISOString(),
          sync_status: 'active'
        })
        .eq('id', connection.id);

      return {
        success: true,
        message: `${syncedCount} campanhas sincronizadas`,
        recordsProcessed: syncedCount,
        syncedAt: new Date()
      };

    } catch (error) {
      console.error('Erro na sincronização de campanhas:', error);
      return {
        success: false,
        message: 'Erro na sincronização de campanhas',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        syncedAt: new Date()
      };
    }
  }

  // Sincronizar insights de campanhas
  async syncInsights(
    accountId: string, 
    userId: string, 
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    try {
      console.log(`📊 Sincronizando insights da conta ${accountId}...`);

      // Definir período padrão (últimos 30 dias)
      const defaultDateRange = {
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        until: new Date().toISOString().split('T')[0]
      };

      const dateRange = options.dateRange || defaultDateRange;

      // Buscar campanhas ativas
      const { data: campaigns } = await this.supabase
        .from('meta_campaigns')
        .select('campaign_id, connection_id')
        .eq('status', 'ACTIVE')
        .in('connection_id', 
          await this.supabase
            .from('client_meta_connections')
            .select('id')
            .eq('account_id', accountId)
            .eq('created_by', userId)
        );

      if (!campaigns || campaigns.length === 0) {
        return {
          success: true,
          message: 'Nenhuma campanha ativa encontrada',
          recordsProcessed: 0,
          syncedAt: new Date()
        };
      }

      const campaignIds = campaigns.map(c => c.campaign_id);

      // Buscar insights do Meta
      const { data: insights } = await this.metaClient.getMultipleCampaignInsights(
        `act_${accountId}`,
        campaignIds,
        dateRange
      );

      if (!insights || insights.length === 0) {
        return {
          success: true,
          message: 'Nenhum insight encontrado para o período',
          recordsProcessed: 0,
          syncedAt: new Date()
        };
      }

      // Formatar e salvar insights
      const formattedInsights = formatInsightsData(insights);
      let syncedCount = 0;

      for (const insight of formattedInsights) {
        const campaign = campaigns.find(c => c.campaign_id === insight.campaignId);
        if (!campaign) continue;

        // Verificar se insight já existe
        const { data: existingInsight } = await this.supabase
          .from('meta_insights')
          .select('id')
          .eq('campaign_id', insight.campaignId)
          .eq('date_start', insight.dateStart)
          .eq('date_stop', insight.dateStop)
          .single();

        const insightData = {
          campaign_id: insight.campaignId,
          connection_id: campaign.connection_id,
          date_start: insight.dateStart,
          date_stop: insight.dateStop,
          impressions: insight.impressions,
          clicks: insight.clicks,
          spend: insight.spend,
          ctr: insight.ctr,
          cpc: insight.cpc,
          cpm: insight.cpm,
          reach: insight.reach,
          frequency: insight.frequency,
          conversions: parseInt(insight.conversions),
          synced_at: new Date().toISOString()
        };

        if (existingInsight) {
          await this.supabase
            .from('meta_insights')
            .update(insightData)
            .eq('id', existingInsight.id);
        } else {
          await this.supabase
            .from('meta_insights')
            .insert(insightData);
        }

        syncedCount++;
      }

      return {
        success: true,
        message: `${syncedCount} insights sincronizados`,
        recordsProcessed: syncedCount,
        data: calculateAggregatedMetrics(formattedInsights),
        syncedAt: new Date()
      };

    } catch (error) {
      console.error('Erro na sincronização de insights:', error);
      return {
        success: false,
        message: 'Erro na sincronização de insights',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        syncedAt: new Date()
      };
    }
  }

  // Sincronização completa (contas + campanhas + insights)
  async fullSync(userId: string, options: SyncOptions = {}): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    try {
      // 1. Sincronizar contas
      const accountsResult = await this.syncAdAccounts(userId);
      results.push(accountsResult);

      if (!accountsResult.success) {
        return results;
      }

      // 2. Buscar contas sincronizadas
      const { data: connections } = await this.supabase
        .from('client_meta_connections')
        .select('account_id')
        .eq('created_by', userId)
        .eq('is_active', true);

      if (!connections || connections.length === 0) {
        results.push({
          success: false,
          message: 'Nenhuma conta ativa encontrada',
          syncedAt: new Date()
        });
        return results;
      }

      // 3. Sincronizar campanhas e insights para cada conta
      for (const connection of connections) {
        if (options.syncCampaigns !== false) {
          const campaignsResult = await this.syncCampaigns(connection.account_id, userId);
          results.push(campaignsResult);
        }

        if (options.syncInsights !== false) {
          const insightsResult = await this.syncInsights(connection.account_id, userId, options);
          results.push(insightsResult);
        }
      }

      return results;

    } catch (error) {
      console.error('Erro na sincronização completa:', error);
      results.push({
        success: false,
        message: 'Erro na sincronização completa',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        syncedAt: new Date()
      });
      return results;
    }
  }

  // Função helper para buscar organização do usuário
  private async getUserOrganizationId(userId: string): Promise<string> {
    const { data: membership } = await this.supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    return membership?.organization_id;
  }

  // Agendar sincronização automática
  async scheduleAutoSync(userId: string, intervalHours: number = 24): Promise<SyncResult> {
    try {
      // Salvar configuração de auto-sync
      await this.supabase
        .from('sync_schedules')
        .upsert({
          user_id: userId,
          sync_type: 'meta_ads',
          interval_hours: intervalHours,
          is_active: true,
          last_run: new Date().toISOString(),
          next_run: new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString()
        });

      return {
        success: true,
        message: `Auto-sync agendado para cada ${intervalHours} horas`,
        syncedAt: new Date()
      };

    } catch (error) {
      return {
        success: false,
        message: 'Erro ao agendar auto-sync',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        syncedAt: new Date()
      };
    }
  }
}

// Função helper para criar serviço de sincronização
export function createSyncService(accessToken: string): MetaAdsSyncService {
  return new MetaAdsSyncService(accessToken);
}