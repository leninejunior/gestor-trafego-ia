import { FacebookAdsApi, AdAccount, Campaign, AdSet, Ad } from 'facebook-nodejs-business-sdk';
import { META_CONFIG } from './config';

// Inicializar o SDK do Facebook
FacebookAdsApi.init(META_CONFIG.ACCESS_TOKEN);

export class MetaAdsClient {
  private api: FacebookAdsApi;

  constructor(accessToken?: string) {
    this.api = FacebookAdsApi.init(accessToken || META_CONFIG.ACCESS_TOKEN);
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
        'cost_per_conversion',
        'conversions',
        'conversion_rate'
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
}