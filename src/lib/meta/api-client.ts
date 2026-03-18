import { MetaAdsConfig } from './config';

export interface MetaAdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
  spend_cap?: string;
  balance?: string;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  created_time: string;
  updated_time: string;
  start_time?: string;
  stop_time?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_strategy?: string;
}

export interface MetaInsights {
  campaign_id: string;
  campaign_name: string;
  impressions: string;
  clicks: string;
  spend: string;
  ctr: string;
  cpc: string;
  cpm: string;
  reach?: string;
  frequency?: string;
  actions?: Array<{
    action_type: string;
    value: string;
  }>;
  cost_per_action_type?: Array<{
    action_type: string;
    value: string;
  }>;
  date_start: string;
  date_stop: string;
}

export interface MetaAudienceInsight {
  age: string;
  gender: string;
  country: string;
  region?: string;
  impressions: string;
  clicks: string;
  spend: string;
  actions?: number;
}

export class MetaAdsApiClient {
  private baseUrl = 'https://graph.facebook.com/v18.0';
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async makeRequest<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    // Adicionar access token
    url.searchParams.append('access_token', this.accessToken);
    
    // Adicionar outros parâmetros
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Meta API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Meta API Request failed:', error);
      throw error;
    }
  }

  // Buscar contas de anúncios do usuário
  async getAdAccounts(): Promise<{ data: MetaAdAccount[] }> {
    return this.makeRequest('/me/adaccounts', {
      fields: 'id,name,account_status,currency,timezone_name,spend_cap,balance'
    });
  }

  // Buscar campanhas de uma conta
  async getCampaigns(adAccountId: string, limit: number = 25): Promise<{ data: MetaCampaign[] }> {
    return this.makeRequest(`/${adAccountId}/campaigns`, {
      fields: 'id,name,status,objective,created_time,updated_time,start_time,stop_time,daily_budget,lifetime_budget,bid_strategy',
      limit
    });
  }

  // Buscar insights de campanhas
  async getCampaignInsights(
    campaignId: string, 
    dateRange: { since: string; until: string },
    fields?: string[]
  ): Promise<{ data: MetaInsights[] }> {
    const defaultFields = [
      'campaign_id',
      'campaign_name',
      'impressions',
      'clicks',
      'spend',
      'ctr',
      'cpc',
      'cpm',
      'reach',
      'frequency',
      'actions',
      'cost_per_action_type'
    ];

    return this.makeRequest(`/${campaignId}/insights`, {
      fields: (fields || defaultFields).join(','),
      time_range: JSON.stringify(dateRange),
      level: 'campaign'
    });
  }

  // Buscar insights de múltiplas campanhas
  async getMultipleCampaignInsights(
    adAccountId: string,
    campaignIds: string[],
    dateRange: { since: string; until: string }
  ): Promise<{ data: MetaInsights[] }> {
    return this.makeRequest(`/${adAccountId}/insights`, {
      fields: 'campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type',
      time_range: JSON.stringify(dateRange),
      level: 'campaign',
      filtering: JSON.stringify([{
        field: 'campaign.id',
        operator: 'IN',
        value: campaignIds
      }])
    });
  }

  // Buscar insights de audiência
  async getAudienceInsights(
    adAccountId: string,
    dateRange: { since: string; until: string }
  ): Promise<{ data: MetaAudienceInsight[] }> {
    return this.makeRequest(`/${adAccountId}/insights`, {
      fields: 'impressions,clicks,spend,actions',
      time_range: JSON.stringify(dateRange),
      breakdowns: 'age,gender,country,region',
      level: 'campaign'
    });
  }

  // Buscar insights por dispositivo
  async getDeviceInsights(
    adAccountId: string,
    dateRange: { since: string; until: string }
  ): Promise<{ data: any[] }> {
    return this.makeRequest(`/${adAccountId}/insights`, {
      fields: 'impressions,clicks,spend,ctr,cpc',
      time_range: JSON.stringify(dateRange),
      breakdowns: 'publisher_platform,platform_position,impression_device',
      level: 'campaign'
    });
  }

  // Buscar insights por horário
  async getHourlyInsights(
    campaignId: string,
    dateRange: { since: string; until: string }
  ): Promise<{ data: any[] }> {
    return this.makeRequest(`/${campaignId}/insights`, {
      fields: 'impressions,clicks,spend,ctr,cpc',
      time_range: JSON.stringify(dateRange),
      time_increment: 1,
      breakdowns: 'hourly_stats_aggregated_by_advertiser_time_zone'
    });
  }

  // Validar token de acesso
  async validateAccessToken(): Promise<{ is_valid: boolean; scopes: string[]; expires_at?: number }> {
    try {
      const response = await this.makeRequest('/me', {
        fields: 'id,name'
      });
      
      // Se chegou até aqui, o token é válido
      return {
        is_valid: true,
        scopes: ['ads_read'], // Simplificado, em produção verificar scopes reais
      };
    } catch (error) {
      return {
        is_valid: false,
        scopes: []
      };
    }
  }

  // Buscar informações do usuário
  async getUserInfo(): Promise<{ id: string; name: string; email?: string }> {
    return this.makeRequest('/me', {
      fields: 'id,name,email'
    });
  }

  // Buscar páginas do usuário
  async getUserPages(): Promise<{ data: Array<{ id: string; name: string; access_token: string }> }> {
    return this.makeRequest('/me/accounts', {
      fields: 'id,name,access_token'
    });
  }

  // Criar webhook para receber atualizações
  async createWebhook(adAccountId: string, callbackUrl: string): Promise<any> {
    // Nota: Webhooks do Meta Ads requerem configuração no App Dashboard
    // Este método é mais para documentação da funcionalidade
    console.log(`Webhook seria criado para ${adAccountId} com callback ${callbackUrl}`);
    return { success: true, message: 'Webhook configuration needed in Meta App Dashboard' };
  }
}

// Função helper para criar cliente com configuração
export function createMetaAdsClient(accessToken?: string): MetaAdsApiClient {
  const token = accessToken || process.env.META_ACCESS_TOKEN;
  
  if (!token) {
    throw new Error('Meta Access Token is required');
  }

  return new MetaAdsApiClient(token);
}

// Função helper para formatar dados de insights
export function formatInsightsData(insights: MetaInsights[]): any {
  return insights.map(insight => ({
    campaignId: insight.campaign_id,
    campaignName: insight.campaign_name,
    impressions: parseInt(insight.impressions) || 0,
    clicks: parseInt(insight.clicks) || 0,
    spend: parseFloat(insight.spend) || 0,
    ctr: parseFloat(insight.ctr) || 0,
    cpc: parseFloat(insight.cpc) || 0,
    cpm: parseFloat(insight.cpm) || 0,
    reach: insight.reach ? parseInt(insight.reach) : 0,
    frequency: insight.frequency ? parseFloat(insight.frequency) : 0,
    conversions: insight.actions?.find(action => 
      ['purchase', 'lead', 'complete_registration'].includes(action.action_type)
    )?.value || '0',
    dateStart: insight.date_start,
    dateStop: insight.date_stop
  }));
}

// Função helper para calcular métricas agregadas
export function calculateAggregatedMetrics(insights: any[]): {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  avgCtr: number;
  avgCpc: number;
  avgCpm: number;
  roas: number;
} {
  const totals = insights.reduce((acc, insight) => ({
    spend: acc.spend + insight.spend,
    impressions: acc.impressions + insight.impressions,
    clicks: acc.clicks + insight.clicks,
    conversions: acc.conversions + parseInt(insight.conversions)
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

  const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const avgCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const avgCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
  
  // ROAS simplificado (assumindo valor médio de conversão)
  const avgConversionValue = 50; // Valor médio estimado
  const revenue = totals.conversions * avgConversionValue;
  const roas = totals.spend > 0 ? revenue / totals.spend : 0;

  return {
    totalSpend: totals.spend,
    totalImpressions: totals.impressions,
    totalClicks: totals.clicks,
    totalConversions: totals.conversions,
    avgCtr,
    avgCpc,
    avgCpm,
    roas
  };
}