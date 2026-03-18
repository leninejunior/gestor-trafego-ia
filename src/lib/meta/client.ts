import { FacebookAdsApi, AdAccount, Campaign, AdSet, Ad } from 'facebook-nodejs-business-sdk';
import { META_CONFIG } from './config';

// Inicializar o SDK do Facebook
FacebookAdsApi.init(META_CONFIG.ACCESS_TOKEN);

export class MetaAdsClient {
  private api: FacebookAdsApi;
  private accessToken: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken || META_CONFIG.ACCESS_TOKEN;
    this.api = FacebookAdsApi.init(this.accessToken);
  }

  // Obter contas de anúncios
  async getAdAccounts() {
    try {
      const adAccounts = await new AdAccount().getAdAccounts([
        'id',
        'name',
        'account_status',
        'currency',
        'timezone_name',
        'spend_cap',
        'balance'
      ]);
      
      return adAccounts;
    } catch (error) {
      console.error('Erro ao buscar contas de anúncios:', error);
      throw error;
    }
  }

  // Obter campanhas de uma conta específica
  async getCampaigns(adAccountId: string) {
    try {
      const adAccount = new AdAccount(adAccountId);
      const campaigns = await adAccount.getCampaigns([
        'id',
        'name',
        'status',
        'objective',
        'created_time',
        'updated_time',
        'start_time',
        'stop_time',
        'daily_budget',
        'lifetime_budget',
        'budget_remaining'
      ]);

      return campaigns;
    } catch (error) {
      console.error('Erro ao buscar campanhas:', error);
      throw error;
    }
  }

  // Obter insights de uma campanha
  async getCampaignInsights(campaignId: string, dateRange?: { since: string; until: string }) {
    try {
      const campaign = new Campaign(campaignId);
      const insights = await campaign.getInsights([
        'impressions',
        'clicks',
        'spend',
        'reach',
        'frequency',
        'cpm',
        'cpc',
        'ctr',
        'actions',
        'cost_per_action_type'
      ], {
        time_range: dateRange || {
          since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          until: new Date().toISOString().split('T')[0]
        }
      });

      return insights;
    } catch (error) {
      console.error('Erro ao buscar insights da campanha:', error);
      throw error;
    }
  }

  // Obter conjuntos de anúncios de uma campanha
  async getAdSets(campaignId: string) {
    try {
      const campaign = new Campaign(campaignId);
      const adSets = await campaign.getAdSets([
        'id',
        'name',
        'status',
        'created_time',
        'updated_time',
        'start_time',
        'end_time',
        'daily_budget',
        'lifetime_budget',
        'optimization_goal',
        'billing_event'
      ]);

      return adSets;
    } catch (error) {
      console.error('Erro ao buscar conjuntos de anúncios:', error);
      throw error;
    }
  }

  // Obter insights de um conjunto de anúncios
  async getAdSetInsights(adSetId: string, dateRange?: { since: string; until: string }) {
    try {
      const adSet = new AdSet(adSetId);
      const insights = await adSet.getInsights([
        'impressions',
        'clicks',
        'spend',
        'reach',
        'frequency',
        'cpm',
        'cpc',
        'ctr',
        'actions',
        'cost_per_action_type'
      ], {
        time_range: dateRange || {
          since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          until: new Date().toISOString().split('T')[0]
        }
      });

      return insights;
    } catch (error) {
      console.error('Erro ao buscar insights do conjunto de anúncios:', error);
      throw error;
    }
  }

  // Obter insights de um anúncio
  async getAdInsights(adId: string, dateRange?: { since: string; until: string }) {
    try {
      const ad = new Ad(adId);
      const insights = await ad.getInsights([
        'impressions',
        'clicks',
        'spend',
        'reach',
        'frequency',
        'cpm',
        'cpc',
        'ctr',
        'actions',
        'cost_per_action_type'
      ], {
        time_range: dateRange || {
          since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          until: new Date().toISOString().split('T')[0]
        }
      });

      return insights;
    } catch (error) {
      console.error('Erro ao buscar insights do anúncio:', error);
      throw error;
    }
  }

  // Obter anúncios de um conjunto de anúncios
  async getAds(adSetId: string) {
    try {
      const adSet = new AdSet(adSetId);
      const ads = await adSet.getAds([
        'id',
        'name',
        'status',
        'created_time',
        'updated_time',
        'creative'
      ]);

      return ads;
    } catch (error) {
      console.error('Erro ao buscar anúncios:', error);
      throw error;
    }
  }

  // =====================================================
  // LEAD ADS - Métodos para captura de leads
  // =====================================================

  // Obter formulários de lead ads de uma conta
  async getLeadForms(adAccountId: string) {
    try {
      // Garantir que o ID da conta tem o prefixo 'act_'
      const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
      
      console.log('[MetaClient] Buscando formulários de lead para:', accountId);
      
      // Usar API REST diretamente para melhor controle de erros
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${accountId}/leadgen_forms?fields=id,name,status,locale,questions,privacy_policy_url,created_time&access_token=${this.accessToken}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[MetaClient] Erro na API de formulários:', errorData);
        
        // Verificar tipos específicos de erro
        if (errorData.error?.code === 190) {
          throw new Error('Token de acesso inválido ou expirado');
        }
        if (errorData.error?.code === 10 || errorData.error?.code === 200) {
          throw new Error('Sem permissão para acessar Lead Ads. Verifique as permissões do app.');
        }
        
        throw new Error(errorData.error?.message || `Erro ao buscar formulários: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[MetaClient] Formulários encontrados:', data.data?.length || 0);
      
      return data.data || [];
    } catch (error: any) {
      console.error('[MetaClient] Erro ao buscar formulários de lead:', error);
      throw error;
    }
  }

  // Obter leads de um formulário específico
  async getLeadsFromForm(formId: string, options?: { limit?: number; after?: string }) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${formId}/leads?access_token=${this.accessToken}&limit=${options?.limit || 100}${options?.after ? `&after=${options.after}` : ''}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar leads: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erro ao buscar leads do formulário:', error);
      throw error;
    }
  }

  // Obter todos os leads de uma conta (de todos os formulários)
  async getAllLeads(adAccountId: string, options?: { since?: string; until?: string }) {
    try {
      // Primeiro, buscar todos os formulários
      const forms = await this.getLeadForms(adAccountId);
      
      const allLeads = [];
      
      // Para cada formulário, buscar os leads
      for (const form of forms) {
        try {
          const leadsData = await this.getLeadsFromForm(form.id);
          
          if (leadsData.data && leadsData.data.length > 0) {
            // Adicionar informações do formulário aos leads
            const leadsWithFormInfo = leadsData.data.map((lead: any) => ({
              ...lead,
              form_id: form.id,
              form_name: form.name
            }));
            
            allLeads.push(...leadsWithFormInfo);
          }
        } catch (formError) {
          console.error(`Erro ao buscar leads do formulário ${form.id}:`, formError);
          // Continuar com os próximos formulários mesmo se um falhar
        }
      }

      return allLeads;
    } catch (error) {
      console.error('Erro ao buscar todos os leads:', error);
      throw error;
    }
  }

  // Obter detalhes de um lead específico
  async getLeadDetails(leadId: string) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${leadId}?fields=id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data,is_organic,platform&access_token=${this.accessToken}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar detalhes do lead: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erro ao buscar detalhes do lead:', error);
      throw error;
    }
  }
}