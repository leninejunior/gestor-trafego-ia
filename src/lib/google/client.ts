/**
 * Google Ads API Client
 * 
 * Handles authentication and API calls to Google Ads API
 * Requirements: 1.1, 10.1, 10.2
 */

import { GoogleAdsErrorHandler } from './error-handler';
import { googleAdsLogger } from './logger';
import { getGoogleTokenManager } from './token-manager';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface GoogleAdsClientConfig {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
  customerId: string;
  loginCustomerId?: string;
  connectionId?: string; // Para usar TokenManager
}

export interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  budget: number;
  budgetType?: 'DAILY' | 'TOTAL';
  startDate?: string;
  endDate?: string;
  metrics: GoogleAdsMetrics;
}

export interface GoogleAdsMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  ctr: number;
  conversionRate: number;
  cpc?: number;
  cpa?: number;
  roas?: number;
}

export interface GoogleAdsAccountInfo {
  customerId: string;
  descriptiveName: string;
  currencyCode: string;
  timeZone: string;
  canManageClients: boolean;
}

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface GoogleAdsApiResponse<T> {
  results: T[];
  fieldMask?: string;
  nextPageToken?: string;
}

// ============================================================================
// Google Ads Client Class
// ============================================================================

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create Google Ads client with simplified config
 */
export function getGoogleAdsClient(config: {
  accessToken: string;
  refreshToken: string;
  developerToken: string;
  customerId?: string;
  loginCustomerId?: string;
  connectionId?: string; // Para usar TokenManager com refresh automático
}): GoogleAdsClient {
  return new GoogleAdsClient({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    developerToken: config.developerToken,
    refreshToken: config.refreshToken,
    customerId: config.customerId || '',
    loginCustomerId: config.loginCustomerId,
    connectionId: config.connectionId,
  });
}

export class GoogleAdsClient {
  private config: GoogleAdsClientConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private errorHandler: GoogleAdsErrorHandler;
  private tokenManager = getGoogleTokenManager();
  private readonly API_VERSION = 'v16';
  private readonly BASE_URL = 'https://googleads.googleapis.com';

  constructor(config: GoogleAdsClientConfig) {
    this.config = config;
    this.errorHandler = new GoogleAdsErrorHandler();
  }

  // ==========================================================================
  // Authentication Methods
  // ==========================================================================

  /**
   * Authenticate using authorization code
   */
  async authenticate(code: string): Promise<TokenResponse> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`,
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Authentication failed: ${error.error_description || error.error}`);
      }

      const tokens: TokenResponse = await response.json();
      this.setAccessToken(tokens.access_token, tokens.expires_in);
      
      return tokens;
    } catch (error) {
      throw this.errorHandler.handleError(error);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken?: string): Promise<TokenResponse> {
    const token = refreshToken || this.config.refreshToken;
    
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token: token,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
      }

      const tokens: TokenResponse = await response.json();
      this.setAccessToken(tokens.access_token, tokens.expires_in);
      
      return tokens;
    } catch (error) {
      throw this.errorHandler.handleError(error);
    }
  }

  /**
   * Set access token and expiration
   */
  private setAccessToken(token: string, expiresIn: number): void {
    this.accessToken = token;
    this.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
  }

  /**
   * Ensure we have a valid access token using TokenManager
   */
  private async ensureValidToken(): Promise<string> {
    // Se temos connectionId, usar TokenManager (RECOMENDADO)
    if (this.config.connectionId) {
      try {
        const validToken = await this.tokenManager.ensureValidToken(this.config.connectionId);
        this.accessToken = validToken;
        return validToken;
      } catch (error) {
        console.error('[GoogleAdsClient] TokenManager failed, falling back to manual refresh:', error);
        // Fallback para método manual
      }
    }
    
    // Fallback: método manual (legacy)
    if (!this.accessToken || !this.tokenExpiresAt || this.isTokenExpired()) {
      await this.refreshAccessToken();
    }
    return this.accessToken!;
  }

  /**
   * Check if token is expired (with 5 minute buffer)
   */
  private isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) return true;
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    return Date.now() >= (this.tokenExpiresAt.getTime() - bufferTime);
  }

  // ==========================================================================
  // API Request Methods
  // ==========================================================================

  /**
   * Make authenticated request to Google Ads API
   */
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    body?: any
  ): Promise<T> {
    const token = await this.ensureValidToken();
    const url = `${this.BASE_URL}/${this.API_VERSION}/${endpoint}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'developer-token': this.config.developerToken,
          'Content-Type': 'application/json',
          ...(this.config.loginCustomerId && {
            'login-customer-id': this.config.loginCustomerId,
          }),
        },
        ...(body && { body: JSON.stringify(body) }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw error;
      }

      return await response.json();
    } catch (error) {
      throw this.errorHandler.handleError(error);
    }
  }

  // ==========================================================================
  // Campaign Methods
  // ==========================================================================

  /**
   * Get all campaigns for the customer
   */
  async getCampaigns(dateRange?: DateRange): Promise<GoogleAdsCampaign[]> {
    const query = this.buildCampaignsQuery(dateRange);
    
    const response = await this.makeRequest<GoogleAdsApiResponse<any>>(
      `customers/${this.config.customerId}/googleAds:searchStream`,
      'POST',
      { query }
    );

    return this.parseCampaignsResponse(response);
  }

  /**
   * Get metrics for a specific campaign
   */
  async getCampaignMetrics(
    campaignId: string,
    dateRange: DateRange
  ): Promise<GoogleAdsMetrics> {
    const query = `
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

    const response = await this.makeRequest<GoogleAdsApiResponse<any>>(
      `customers/${this.config.customerId}/googleAds:searchStream`,
      'POST',
      { query }
    );

    return this.parseMetricsResponse(response);
  }

  /**
   * Get account information
   */
  async getAccountInfo(customerId?: string): Promise<GoogleAdsAccountInfo> {
    const targetCustomerId = customerId || this.config.customerId;
    
    const query = `
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone,
        customer.manager
      FROM customer
      WHERE customer.id = ${targetCustomerId}
    `;

    const response = await this.makeRequest<GoogleAdsApiResponse<any>>(
      `customers/${targetCustomerId}/googleAds:search`,
      'POST',
      { query }
    );

    return this.parseAccountInfoResponse(response);
  }

  /**
   * List accessible customers
   * Nota: Usa GET conforme documentação oficial do Google Ads API
   */
  async listAccessibleCustomers(): Promise<GoogleAdsAccountInfo[]> {
    try {
      // Ensure valid token (com refresh automático se necessário)
      const token = await this.ensureValidToken();
      
      console.log('[GoogleAdsClient] Listing accessible customers...');
      
      const response = await fetch(`${this.BASE_URL}/${this.API_VERSION}/customers:listAccessibleCustomers`, {
        method: 'GET', // GET é o método correto segundo a documentação
        headers: {
          'Authorization': `Bearer ${token}`,
          'developer-token': this.config.developerToken,
          'Content-Type': 'application/json',
          // Nota: login-customer-id NÃO é usado em listAccessibleCustomers
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw error;
      }

      const data = await response.json();
      const customerIds = data.resourceNames?.map((name: string) => 
        name.replace('customers/', '')
      ) || [];

      // Get detailed info for each customer
      const customers: GoogleAdsAccountInfo[] = [];
      
      for (const customerId of customerIds) {
        try {
          const customerInfo = await this.getAccountInfo(customerId);
          customers.push(customerInfo);
        } catch (error) {
          // Skip customers we can't access
          console.warn(`Could not access customer ${customerId}:`, error);
        }
      }

      return customers;
    } catch (error) {
      throw this.errorHandler.handleError(error);
    }
  }

  // ==========================================================================
  // Query Builders
  // ==========================================================================

  /**
   * Build GAQL query for campaigns
   */
  private buildCampaignsQuery(dateRange?: DateRange): string {
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

  // ==========================================================================
  // Response Parsers
  // ==========================================================================

  /**
   * Parse campaigns API response
   */
  private parseCampaignsResponse(response: GoogleAdsApiResponse<any>): GoogleAdsCampaign[] {
    if (!response.results || response.results.length === 0) {
      return [];
    }

    return response.results.map((result: any) => ({
      id: result.campaign.id,
      name: result.campaign.name,
      status: result.campaign.status,
      budget: this.microsToCurrency(result.campaignBudget?.amountMicros || 0),
      startDate: result.campaign.startDate,
      endDate: result.campaign.endDate,
      metrics: {
        impressions: parseInt(result.metrics.impressions || '0'),
        clicks: parseInt(result.metrics.clicks || '0'),
        conversions: parseFloat(result.metrics.conversions || '0'),
        cost: this.microsToCurrency(result.metrics.costMicros || 0),
        ctr: parseFloat(result.metrics.ctr || '0'),
        conversionRate: parseFloat(result.metrics.conversionsFromInteractionsRate || '0'),
        cpc: this.microsToCurrency(result.metrics.averageCpc || 0),
        cpa: this.microsToCurrency(result.metrics.costPerConversion || 0),
        roas: this.calculateRoas(
          result.metrics.conversionsValue || 0,
          result.metrics.costMicros || 0
        ),
      },
    }));
  }

  /**
   * Parse metrics API response
   */
  private parseMetricsResponse(response: GoogleAdsApiResponse<any>): GoogleAdsMetrics {
    if (!response.results || response.results.length === 0) {
      return this.getEmptyMetrics();
    }

    const aggregated = response.results.reduce((acc: any, result: any) => {
      const metrics = result.metrics;
      return {
        impressions: acc.impressions + parseInt(metrics.impressions || '0'),
        clicks: acc.clicks + parseInt(metrics.clicks || '0'),
        conversions: acc.conversions + parseFloat(metrics.conversions || '0'),
        costMicros: acc.costMicros + parseInt(metrics.costMicros || '0'),
        conversionsValue: acc.conversionsValue + parseFloat(metrics.conversionsValue || '0'),
      };
    }, {
      impressions: 0,
      clicks: 0,
      conversions: 0,
      costMicros: 0,
      conversionsValue: 0,
    });

    const cost = this.microsToCurrency(aggregated.costMicros);
    const ctr = aggregated.impressions > 0 
      ? (aggregated.clicks / aggregated.impressions) * 100 
      : 0;
    const conversionRate = aggregated.clicks > 0 
      ? (aggregated.conversions / aggregated.clicks) * 100 
      : 0;

    return {
      impressions: aggregated.impressions,
      clicks: aggregated.clicks,
      conversions: aggregated.conversions,
      cost,
      ctr,
      conversionRate,
      cpc: aggregated.clicks > 0 ? cost / aggregated.clicks : 0,
      cpa: aggregated.conversions > 0 ? cost / aggregated.conversions : 0,
      roas: this.calculateRoas(aggregated.conversionsValue, aggregated.costMicros),
    };
  }

  /**
   * Parse account info response
   */
  private parseAccountInfoResponse(response: GoogleAdsApiResponse<any>): GoogleAdsAccountInfo {
    if (!response.results || response.results.length === 0) {
      throw new Error('Account not found');
    }

    const customer = response.results[0].customer;
    return {
      customerId: customer.id,
      descriptiveName: customer.descriptiveName,
      currencyCode: customer.currencyCode,
      timeZone: customer.timeZone,
      canManageClients: customer.manager || false,
    };
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Convert micros to currency (divide by 1,000,000)
   */
  private microsToCurrency(micros: number | string): number {
    const value = typeof micros === 'string' ? parseInt(micros) : micros;
    return value / 1_000_000;
  }

  /**
   * Calculate ROAS (Return on Ad Spend)
   */
  private calculateRoas(conversionsValue: number | string, costMicros: number | string): number {
    const value = typeof conversionsValue === 'string' 
      ? parseFloat(conversionsValue) 
      : conversionsValue;
    const cost = this.microsToCurrency(costMicros);
    
    return cost > 0 ? value / cost : 0;
  }

  /**
   * Get empty metrics object
   */
  private getEmptyMetrics(): GoogleAdsMetrics {
    return {
      impressions: 0,
      clicks: 0,
      conversions: 0,
      cost: 0,
      ctr: 0,
      conversionRate: 0,
      cpc: 0,
      cpa: 0,
      roas: 0,
    };
  }
}
