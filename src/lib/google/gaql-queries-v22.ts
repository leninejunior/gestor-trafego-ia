/**
 * Google Ads Query Language (GAQL) Queries - v22 Compatible
 *
 * Queries otimizadas para Google Ads API v22
 * Inclui todas as mudanças de nomenclatura e novos campos
 */

import { DateRange } from './client';

// ============================================================================
// Query Builder Utilities
// ============================================================================

/**
 * Build GAQL query for campaigns (v22 compatible)
 * Correção: Usar endpoint correto e campos válidos da v22
 */
export function buildCampaignsQuery(dateRange?: DateRange): string {
  const dateFilter = dateRange
    ? `AND segments.date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'`
    : '';

  return `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign_budget.amount_micros,
      campaign.start_date,
      campaign.end_date,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.ctr,
      metrics.conversions_from_interactions_rate,
      metrics.average_cpc,
      metrics.cost_per_conversion,
      metrics.conversions_value
    FROM campaign
    WHERE campaign.status != 'REMOVED'
      ${dateFilter}
    ORDER BY campaign.id
  `;
}

/**
 * Build GAQL query for campaign metrics (v22 compatible)
 */
export function buildCampaignMetricsQuery(
  campaignId: string,
  dateRange: DateRange
): string {
  return `
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.ctr,
      metrics.conversions_from_interactions_rate,
      metrics.average_cpc,
      metrics.cost_per_conversion,
      metrics.conversions_value
    FROM campaign
    WHERE campaign.id = ${campaignId}
      AND segments.date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'
  `;
}

/**
 * Build GAQL query for account info (v22 compatible)
 */
export function buildAccountInfoQuery(customerId: string): string {
  return `
    SELECT
      customer.id,
      customer.descriptive_name,
      customer.currency_code,
      customer.time_zone,
      customer.manager
    FROM customer
    WHERE customer.id = ${customerId}
  `;
}

/**
 * Build GAQL query for account hierarchy (v22 compatible)
 */
export function buildAccountHierarchyQuery(): string {
  return `
    SELECT
      customer_client.client_customer,
      customer_client.level,
      customer_client.manager,
      customer_client.descriptive_name,
      customer_client.currency_code,
      customer_client.time_zone,
      customer_client.id,
      customer_client.status
    FROM customer_client
    WHERE customer_client.status = 'ENABLED'
    ORDER BY customer_client.level, customer_client.id
  `;
}

// ============================================================================
// Endpoint Definitions for v22
// ============================================================================

/**
 * Endpoint correto para busca de campanhas na v22
 * IMPORTANTE: Usar 'search' em vez de 'searchStream' para v22
 */
export const CAMPAIGNS_ENDPOINT = (customerId: string): string => 
  `customers/${customerId}/googleAds:search`;

/**
 * Endpoint para metrics de campanha
 */
export const CAMPAIGN_METRICS_ENDPOINT = (customerId: string): string => 
  `customers/${customerId}/googleAds:search`;

/**
 * Endpoint para informações da conta
 */
export const ACCOUNT_INFO_ENDPOINT = (customerId: string): string => 
  `customers/${customerId}/googleAds:search`;

/**
 * Endpoint para hierarquia de contas
 */
export const ACCOUNT_HIERARCHY_ENDPOINT = (customerId: string): string => 
  `customers/${customerId}/googleAds:search`;

/**
 * Endpoint para listar contas acessíveis
 */
export const LIST_CUSTOMERS_ENDPOINT = 'customers:listAccessibleCustomers';

// ============================================================================
// Field Mappings for v22
// ============================================================================

/**
 * Mapeamento de campos da API v22 para nosso formato interno
 */
export const CAMPAIGN_FIELD_MAPPING = {
  id: 'campaign.id',
  name: 'campaign.name',
  status: 'campaign.status',
  budget: 'campaign_budget.amount_micros',
  startDate: 'campaign.start_date',
  endDate: 'campaign.end_date',
  impressions: 'metrics.impressions',
  clicks: 'metrics.clicks',
  conversions: 'metrics.conversions',
  cost: 'metrics.cost_micros',
  ctr: 'metrics.ctr',
  conversionRate: 'metrics.conversions_from_interactions_rate',
  cpc: 'metrics.average_cpc',
  cpa: 'metrics.cost_per_conversion',
  roas: 'metrics.conversions_value'
};

/**
 * Campos obrigatórios para query de campanhas
 */
export const REQUIRED_CAMPAIGN_FIELDS = [
  'campaign.id',
  'campaign.name',
  'campaign.status',
  'campaign_budget.amount_micros',
  'campaign.start_date',
  'campaign.end_date',
  'metrics.impressions',
  'metrics.clicks',
  'metrics.conversions',
  'metrics.cost_micros',
  'metrics.ctr',
  'metrics.conversions_from_interactions_rate',
  'metrics.average_cpc',
  'metrics.cost_per_conversion',
  'metrics.conversions_value'
];

// ============================================================================
// Query Validation
// ============================================================================

/**
 * Valida se a query contém todos os campos obrigatórios
 */
export function validateCampaignsQuery(query: string): boolean {
  return REQUIRED_CAMPAIGN_FIELDS.every(field => 
    query.includes(field)
  );
}

/**
 * Valida se o endpoint está correto para a v22
 */
export function validateV22Endpoint(endpoint: string): boolean {
  const validEndpoints = [
    'googleAds:search',
    'googleAds:searchStream',
    'customers:listAccessibleCustomers'
  ];
  
  return validEndpoints.some(valid => endpoint.includes(valid));
}