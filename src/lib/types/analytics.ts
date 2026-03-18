// Tipos para o sistema de Analytics Multi-Nível

export type AnalysisLevel = 'campaign' | 'adset' | 'ad';

export type DateRangePreset = 
  | '0'           // Hoje
  | '7'           // Últimos 7 dias
  | '14'          // Últimos 14 dias
  | '28'          // Últimos 28 dias
  | '30'          // Últimos 30 dias
  | '90'          // Últimos 90 dias
  | '180'         // Últimos 6 meses
  | '365'         // Último ano
  | 'this_week'   // Esta semana
  | 'last_week'   // Semana passada
  | 'this_month'  // Este mês
  | 'last_month'; // Mês passado

export interface CustomDateRange {
  startDate: Date;
  endDate: Date;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  reach: number;
  frequency: number;
  account_name: string;
  account_id: string;
  created_time: string;
  updated_time: string;
  start_time?: string;
  stop_time?: string;
}

export interface AdSet {
  id: string;
  name: string;
  campaign_id: string;
  campaign_name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  optimization_goal: string;
  billing_event: string;
  bid_amount?: number;
  daily_budget?: number;
  lifetime_budget?: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  reach: number;
  frequency: number;
  created_time: string;
  updated_time: string;
  start_time?: string;
  end_time?: string;
}

export interface Ad {
  id: string;
  name: string;
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  campaign_name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  creative: {
    id: string;
    title?: string;
    body?: string;
    image_url?: string;
    video_id?: string;
    thumbnail_url?: string;
    call_to_action_type?: string;
    link_url?: string;
  };
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  reach: number;
  frequency: number;
  created_time: string;
  updated_time: string;
  start_time?: string;
  end_time?: string;
}

export interface AnalyticsFilters {
  dateRange?: DateRangePreset | CustomDateRange;
  level?: AnalysisLevel;
  campaignIds?: string[];
  adsetIds?: string[];
  accountIds?: string[];
  status?: ('ACTIVE' | 'PAUSED' | 'ARCHIVED')[];
}

export interface AnalyticsMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  reach: number;
  frequency: number;
}

export interface AnalyticsResponse<T> {
  data: T[];
  metrics: AnalyticsMetrics;
  pagination: {
    hasNext: boolean;
    hasPrevious: boolean;
    cursors?: {
      before?: string;
      after?: string;
    };
  };
}