// Tipos para Meta Ads API

export class MetaApiError extends Error {
  constructor(
    message: string,
    public code?: number,
    public type?: string,
    public subcode?: number
  ) {
    super(message);
    this.name = 'MetaApiError';
  }
}

export interface MetaAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
  spend_cap?: string;
  balance?: string;
}

export interface MetaInsights {
  impressions: string;
  clicks: string;
  spend: string;
  reach: string;
  frequency: string;
  cpm: string;
  cpc: string;
  ctr: string;
  cost_per_conversion?: string;
  conversions?: string;
  conversion_rate?: string;
  date_start: string;
  date_stop: string;
}

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
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  objective: string;
  created_time: string;
  updated_time: string;
  start_time?: string;
  stop_time?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  budget_remaining?: string;
}

export interface MetaCampaignInsights {
  impressions: string;
  clicks: string;
  spend: string;
  reach: string;
  frequency: string;
  cpm: string;
  cpc: string;
  ctr: string;
  cost_per_conversion?: string;
  conversions?: string;
  conversion_rate?: string;
  date_start: string;
  date_stop: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  created_time: string;
  updated_time: string;
  start_time?: string;
  end_time?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal: string;
  billing_event: string;
}

export interface MetaAd {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  created_time: string;
  updated_time: string;
  creative: {
    id: string;
    name: string;
  };
}

export interface ClientMetaConnection {
  id: string;
  client_id: string;
  ad_account_id: string;
  access_token: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}