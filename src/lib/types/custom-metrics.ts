// Tipos para o Sistema de Métricas Personalizadas

export interface CustomMetric {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
  description?: string;
  formula: string;
  base_metrics: string[]; // Array de métricas base (ex: ['spend', 'clicks', 'impressions'])
  currency_type: 'BRL' | 'USD' | 'EUR' | 'POINTS';
  display_symbol: string;
  decimal_places: number;
  is_percentage: boolean;
  category: 'CPC' | 'CTR' | 'ROAS' | 'CPA' | 'CUSTOM';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomMetricValue {
  id: string;
  custom_metric_id: string;
  campaign_id?: string;
  ad_account_id?: string;
  date_range_start: string;
  date_range_end: string;
  calculated_value: number;
  raw_data: Record<string, any>;
  calculated_at: string;
}

export interface MetricObjective {
  id: string;
  user_id: string;
  organization_id: string;
  metric_name: string;
  metric_type: 'standard' | 'custom';
  custom_metric_id?: string;
  min_value?: number;
  max_value?: number;
  target_value?: number;
  campaign_objective?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PerformanceAlert {
  id: string;
  user_id: string;
  organization_id: string;
  metric_objective_id: string;
  campaign_id?: string;
  alert_type: 'above_max' | 'below_min' | 'target_reached';
  current_value: number;
  threshold_value: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  is_read: boolean;
  is_resolved: boolean;
  triggered_at: string;
  resolved_at?: string;
}

export interface CustomDashboardView {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
  description?: string;
  view_config: DashboardViewConfig;
  is_default: boolean;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardViewConfig {
  columns: DashboardColumn[];
  filters: DashboardFilter[];
  sorting: DashboardSort[];
  grouping?: string[];
  chart_type?: 'table' | 'line' | 'bar' | 'pie';
}

export interface DashboardColumn {
  key: string;
  label: string;
  type: 'metric' | 'dimension' | 'custom_metric';
  visible: boolean;
  width?: number;
  format?: 'currency' | 'percentage' | 'number' | 'date';
  custom_metric_id?: string;
}

export interface DashboardFilter {
  key: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'between';
  value: any;
  values?: any[]; // Para filtros 'between' ou múltiplos valores
}

export interface DashboardSort {
  key: string;
  direction: 'asc' | 'desc';
}

// Tipos para Integrações E-commerce
export interface EcommerceIntegration {
  id: string;
  user_id: string;
  organization_id: string;
  platform: 'shopify' | 'nuvemshop' | 'hotmart' | 'kiwify' | 'cakto' | 'yampi' | 'cartpanda';
  store_name: string;
  api_credentials: Record<string, any>; // Criptografado
  webhook_url?: string;
  sync_settings: EcommerceSyncSettings;
  last_sync_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EcommerceSyncSettings {
  auto_sync: boolean;
  sync_interval: number; // em minutos
  attribution_window: number; // em dias
  sync_products: boolean;
  sync_orders: boolean;
  sync_customers: boolean;
}

export interface EcommerceConversion {
  id: string;
  integration_id: string;
  order_id: string;
  campaign_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  customer_email?: string;
  order_value: number;
  currency: string;
  products: EcommerceProduct[];
  conversion_date: string;
  attribution_window: number;
  created_at: string;
}

export interface EcommerceProduct {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  sku?: string;
}

// Tipos para UTMs Inteligentes
export interface SmartUTM {
  id: string;
  user_id: string;
  organization_id: string;
  campaign_name?: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content?: string;
  utm_term?: string;
  full_url: string;
  short_url?: string;
  clicks: number;
  conversions: number;
  revenue: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UTMSuggestion {
  field: 'source' | 'medium' | 'campaign' | 'content' | 'term';
  suggestions: string[];
  based_on: 'history' | 'best_practices' | 'ai';
}

// Tipos para Fórmulas de Métricas
export interface MetricFormula {
  expression: string;
  variables: MetricVariable[];
  result_type: 'number' | 'percentage' | 'currency';
}

export interface MetricVariable {
  name: string;
  type: 'metric' | 'constant' | 'custom_metric';
  metric_key?: string; // Para métricas padrão (spend, clicks, etc.)
  custom_metric_id?: string; // Para métricas customizadas
  value?: number; // Para constantes
}

// Tipos para Calculadora de Métricas
export interface MetricCalculationContext {
  campaign_data: Record<string, any>;
  date_range: {
    start: string;
    end: string;
  };
  custom_metrics: CustomMetric[];
  base_metrics: Record<string, number>;
}

export interface MetricCalculationResult {
  value: number;
  formatted_value: string;
  calculation_steps: CalculationStep[];
  errors?: string[];
}

export interface CalculationStep {
  step: number;
  operation: string;
  input_values: Record<string, number>;
  result: number;
  description: string;
}

// Tipos para Sistema de Alertas
export interface AlertRule {
  id: string;
  metric_objective_id: string;
  condition: AlertCondition;
  notification_settings: NotificationSettings;
  is_active: boolean;
}

export interface AlertCondition {
  type: 'threshold' | 'percentage_change' | 'trend';
  operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  value: number;
  time_window?: number; // em horas
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  slack?: boolean;
  webhook?: string;
  frequency: 'immediate' | 'hourly' | 'daily';
}

// Tipos para Análise de Performance
export interface PerformanceAnalysis {
  metric_name: string;
  current_value: number;
  target_value?: number;
  previous_period_value?: number;
  change_percentage: number;
  trend: 'up' | 'down' | 'stable';
  status: 'excellent' | 'good' | 'warning' | 'critical';
  recommendations: string[];
}

// Tipos para Exportação
export interface ExportConfig {
  format: 'csv' | 'xlsx' | 'pdf';
  columns: string[];
  filters: DashboardFilter[];
  date_range: {
    start: string;
    end: string;
  };
  include_charts: boolean;
  include_summary: boolean;
}

// Tipos para Templates de Métricas
export interface MetricTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  formula: string;
  base_metrics: string[];
  currency_type: string;
  display_symbol: string;
  is_percentage: boolean;
  tags: string[];
}

// Constantes úteis
export const METRIC_CATEGORIES = [
  'CPC',
  'CTR', 
  'ROAS',
  'CPA',
  'CUSTOM'
] as const;

export const CURRENCY_TYPES = [
  'BRL',
  'USD', 
  'EUR',
  'POINTS'
] as const;

export const ECOMMERCE_PLATFORMS = [
  'shopify',
  'nuvemshop', 
  'hotmart',
  'kiwify',
  'cakto',
  'yampi',
  'cartpanda'
] as const;

export const ALERT_SEVERITIES = [
  'low',
  'medium',
  'high', 
  'critical'
] as const;