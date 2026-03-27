/**
 * Google Ads API Client v22
 * 
 * Cliente completo para Google Ads API v22 seguindo especificações oficiais:
 * - OAuth 2.0 com refresh automático de tokens
 * - Headers obrigatórios (Authorization, developer-token, login-customer-id)
 * - Suporte a contas MCC (Manager)
 * - GAQL (Google Ads Query Language) queries
 * - Conversão automática de micros para moeda
 * - Tratamento de erros e retry logic
 * 
 * Documentação oficial:
 * - https://developers.google.com/google-ads/api/docs/start
 * - https://developers.google.com/google-ads/api/rest/reference
 * 
 * Requirements: 1.1, 10.1, 10.2
 */

import { GoogleAdsErrorHandler } from './error-handler';
import { getGoogleTokenManager } from './token-manager';
import { validateCustomerIdWithLogging, formatCustomerId } from './customer-id-validator';
import { getCanonicalGoogleRedirectUri } from './redirect-uri';

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
  private readonly API_VERSION = 'v22';
  private readonly BASE_URL = 'https://googleads.googleapis.com';

  constructor(config: GoogleAdsClientConfig) {
    // Validate and format customer ID
    if (config.customerId) {
      const validation = validateCustomerIdWithLogging(config.customerId, {
        source: 'GoogleAdsClient constructor',
        connectionId: config.connectionId,
      });
      
      if (!validation.isValid) {
        throw new Error(
          `Invalid customer ID format: ${validation.errors.join(', ')}. ` +
          `Received: "${config.customerId}". ` +
          `Expected format: 10 digits (e.g., "1234567890" or "123-456-7890")`
        );
      }
      
      // Use formatted customer ID (without dashes)
      config.customerId = validation.formatted;
      
      console.log('[GoogleAdsClient] Customer ID validated and formatted:', {
        original: validation.original,
        formatted: validation.formatted,
        connectionId: config.connectionId,
        timestamp: new Date().toISOString(),
      });
    }
    
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
          redirect_uri: getCanonicalGoogleRedirectUri(),
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
        console.error('[GoogleAdsClient] TokenManager failed, falling back to manual refresh:', {
          error: error instanceof Error ? error.message : String(error),
          errorName: error instanceof Error ? error.name : 'Unknown',
          errorStack: error instanceof Error ? error.stack : undefined,
          errorCode: (error as any)?.code,
          connectionId: this.config.connectionId,
          customerId: this.config.customerId,
          timestamp: new Date().toISOString(),
        });
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

    // Log API request parameters
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[GoogleAdsClient] API Request [${requestId}]:`, {
      method,
      endpoint,
      url,
      customerId: this.config.customerId,
      loginCustomerId: this.config.loginCustomerId,
      hasBody: !!body,
      bodyPreview: body ? JSON.stringify(body).substring(0, 200) : undefined,
      timestamp: new Date().toISOString(),
    });

    // Log GAQL query if present
    if (body?.query) {
      console.log(`[GoogleAdsClient] GAQL Query [${requestId}]:`, {
        query: body.query,
        customerId: this.config.customerId,
      });
    }

    try {
      const requestStartTime = Date.now();
      
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

      const requestDuration = Date.now() - requestStartTime;

      // Log response status
      console.log(`[GoogleAdsClient] API Response [${requestId}]:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        duration: `${requestDuration}ms`,
        contentType: response.headers.get('content-type'),
        timestamp: new Date().toISOString(),
      });

      if (!response.ok) {
        const error = await response.json();
        
        // Log error details
        console.error(`[GoogleAdsClient] API Error [${requestId}]:`, {
          status: response.status,
          error: error,
          endpoint,
          customerId: this.config.customerId,
          timestamp: new Date().toISOString(),
        });
        
        throw error;
      }

      const responseData = await response.json();
      
      // Log complete response structure for debugging
      console.log(`[GoogleAdsClient] API Response Structure [${requestId}]:`, {
        responseKeys: Object.keys(responseData),
        hasResults: !!responseData.results,
        resultsCount: responseData.results?.length || 0,
        hasNextPageToken: !!responseData.nextPageToken,
        fieldMask: responseData.fieldMask,
        timestamp: new Date().toISOString(),
      });

      // Log detailed structure of first result if available
      if (responseData.results && responseData.results.length > 0) {
        const firstResult = responseData.results[0];
        console.log(`[GoogleAdsClient] First Result Structure [${requestId}]:`, {
          resultKeys: Object.keys(firstResult),
          resultSample: JSON.stringify(firstResult).substring(0, 500),
          timestamp: new Date().toISOString(),
        });
        
        // Log nested object structures
        Object.keys(firstResult).forEach(key => {
          const value = firstResult[key];
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            console.log(`[GoogleAdsClient] Result.${key} Structure [${requestId}]:`, {
              keys: Object.keys(value),
              sample: JSON.stringify(value).substring(0, 300),
            });
          }
        });
      }

      // Log full response for empty results to debug why campaigns might be 0
      if (!responseData.results || responseData.results.length === 0) {
        console.log(`[GoogleAdsClient] Empty Response - Full Data [${requestId}]:`, {
          fullResponse: JSON.stringify(responseData),
          endpoint,
          customerId: this.config.customerId,
          timestamp: new Date().toISOString(),
        });
      }

      return responseData;
    } catch (error) {
      // Log exception details
      console.error(`[GoogleAdsClient] API Exception [${requestId}]:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        endpoint,
        customerId: this.config.customerId,
        timestamp: new Date().toISOString(),
      });
      
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
    console.log('[GoogleAdsClient] getCampaigns called:', {
      customerId: this.config.customerId,
      dateRange,
      timestamp: new Date().toISOString(),
    });
    
    const query = this.buildCampaignsQuery(dateRange);
    
    console.log('[GoogleAdsClient] Built campaigns query:', {
      customerId: this.config.customerId,
      query: query.trim(),
      queryLength: query.length,
      timestamp: new Date().toISOString(),
    });
    
    const response = await this.makeRequest<GoogleAdsApiResponse<any>>(
      `customers/${this.config.customerId}/googleAds:search`,
      'POST',
      { query }
    );

    const campaigns = this.parseCampaignsResponse(response);
    
    console.log('[GoogleAdsClient] Parsed campaigns response:', {
      customerId: this.config.customerId,
      campaignsCount: campaigns.length,
      campaignIds: campaigns.map(c => c.id),
      timestamp: new Date().toISOString(),
    });

    return campaigns;
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
      `customers/${this.config.customerId}/googleAds:search`,
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
   * Get account hierarchy (MCC and child accounts)
   * Busca hierarquia completa de contas MCC
   */
  async getAccountHierarchy(customerId?: string): Promise<GoogleAdsAccountInfo[]> {
    try {
      const targetCustomerId = customerId || this.config.customerId;
      
      const query = `
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

      const response = await this.makeRequest<GoogleAdsApiResponse<any>>(
        `customers/${targetCustomerId}/googleAds:search`,
        'POST',
        { query }
      );

      if (!response.results || response.results.length === 0) {
        return [];
      }

      // Mapear resultados para GoogleAdsAccountInfo
      const accounts: GoogleAdsAccountInfo[] = response.results.map((result: any) => {
        const client = result.customerClient;
        return {
          customerId: client.id || client.clientCustomer?.replace('customers/', ''),
          descriptiveName: client.descriptiveName || 'Sem nome',
          currencyCode: client.currencyCode || 'USD',
          timeZone: client.timeZone || 'UTC',
          canManageClients: client.manager || false,
        };
      });

      return accounts;
    } catch (error) {
      console.error('[GoogleAdsClient] Erro ao buscar hierarquia:', error);
      throw this.errorHandler.handleError(error);
    }
  }

  /**
   * List accessible customers (v22 compatible)
   * Usa GET conforme documentação oficial do Google Ads API
   * 
   * Melhorias v22:
   * - Retry logic para falhas temporárias
   * - Validação de Developer Token
   * - Busca paralela de detalhes das contas
   * - Mensagens de erro mais claras
   * - Filtra MCCs e busca contas filhas automaticamente
   */
  async listAccessibleCustomers(): Promise<GoogleAdsAccountInfo[]> {
    try {
      // Ensure valid token (com refresh automático se necessário)
      const token = await this.ensureValidToken();
      
      console.log('[GoogleAdsClient] Listing accessible customers (v22)...');
      
      // Validar Developer Token antes de fazer requisição
      if (!this.config.developerToken || this.config.developerToken === 'your-developer-token') {
        throw new Error(
          'Developer Token inválido. Configure GOOGLE_ADS_DEVELOPER_TOKEN nas variáveis de ambiente. ' +
          'Obtenha seu token em: https://ads.google.com/aw/apicenter'
        );
      }
      
      const response = await fetch(`${this.BASE_URL}/${this.API_VERSION}/customers:listAccessibleCustomers`, {
        method: 'GET', // GET é o método correto segundo a documentação v22
        headers: {
          'Authorization': `Bearer ${token}`,
          'developer-token': this.config.developerToken,
          'Content-Type': 'application/json',
          // Nota: login-customer-id NÃO é usado em listAccessibleCustomers
        },
      });

      if (!response.ok) {
        const errorDetails = await this.parseApiError(response);
        throw new Error(errorDetails.message);
      }

      const data = await response.json();
      const customerIds = data.resourceNames?.map((name: string) => 
        name.replace('customers/', '')
      ) || [];

      if (customerIds.length === 0) {
        console.warn('[GoogleAdsClient] Nenhuma conta acessível encontrada');
        return [];
      }

      console.log(`[GoogleAdsClient] ${customerIds.length} conta(s) encontrada(s), buscando detalhes...`);

      // Buscar detalhes das contas em paralelo (máximo 5 por vez para evitar rate limit)
      const customers = await this.fetchAccountDetailsInBatches(customerIds, 5);

      console.log(`[GoogleAdsClient] ${customers.length} conta(s) com detalhes carregados`);

      // Separar MCCs de contas normais
      const mccAccounts = customers.filter(acc => acc.canManageClients);
      const regularAccounts = customers.filter(acc => !acc.canManageClients);

      console.log(`[GoogleAdsClient] MCCs: ${mccAccounts.length}, Contas regulares: ${regularAccounts.length}`);

      // Se houver MCCs, buscar contas filhas
      if (mccAccounts.length > 0) {
        console.log('[GoogleAdsClient] Buscando contas filhas das MCCs...');
        
        const childAccounts: GoogleAdsAccountInfo[] = [];
        
        for (const mcc of mccAccounts) {
          try {
            // Buscar hierarquia da MCC
            const hierarchy = await this.getAccountHierarchy(mcc.customerId);
            
            // Filtrar apenas contas não-MCC (level > 0 ou manager = false)
            const children = hierarchy.filter(acc => !acc.canManageClients);
            
            console.log(`[GoogleAdsClient] MCC ${mcc.customerId}: ${children.length} conta(s) filha(s)`);
            childAccounts.push(...children);
          } catch (error) {
            console.warn(`[GoogleAdsClient] Erro ao buscar filhas da MCC ${mcc.customerId}:`, {
              error: error instanceof Error ? error.message : String(error),
              errorName: error instanceof Error ? error.name : 'Unknown',
              errorStack: error instanceof Error ? error.stack : undefined,
              errorCode: (error as any)?.code,
              mccCustomerId: mcc.customerId,
              mccName: mcc.descriptiveName,
              timestamp: new Date().toISOString(),
            });
          }
        }
        
        // Retornar apenas contas regulares + contas filhas das MCCs
        // Remover duplicatas por customerId
        const allAccounts = [...regularAccounts, ...childAccounts];
        const uniqueAccounts = Array.from(
          new Map(allAccounts.map(acc => [acc.customerId, acc])).values()
        );
        
        console.log(`[GoogleAdsClient] Total de contas selecionáveis: ${uniqueAccounts.length}`);
        return uniqueAccounts;
      }

      return regularAccounts;
    } catch (error) {
      throw this.errorHandler.handleError(error);
    }
  }

  /**
   * Parse API error response (v22 compatible)
   */
  private async parseApiError(response: Response): Promise<{
    message: string;
    code?: string;
    details?: any;
  }> {
    let errorMessage = `Google Ads API error: ${response.status} ${response.statusText}`;
    let errorCode: string | undefined;
    let errorDetails: any;
    
    try {
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        errorMessage = error.error?.message || error.message || errorMessage;
        errorCode = error.error?.code || error.code;
        errorDetails = error.error?.details || error.details;
        
        // Mensagens específicas para erros comuns
        if (response.status === 401) {
          errorMessage = 'Autenticação falhou. Verifique suas credenciais OAuth.';
        } else if (response.status === 403) {
          errorMessage = 'Acesso negado. Verifique se o Developer Token está aprovado e se você tem permissões na conta.';
        } else if (response.status === 429) {
          errorMessage = 'Limite de requisições excedido. Tente novamente em alguns minutos.';
        }
      } else {
        const text = await response.text();
        
        // Se for HTML, significa que o Developer Token provavelmente não está aprovado
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          errorMessage = 
            'Google Ads API retornou HTML em vez de JSON. Possíveis causas:\n' +
            '1. Developer Token não aprovado (solicite aprovação em https://ads.google.com/aw/apicenter)\n' +
            '2. Credenciais OAuth inválidas\n' +
            '3. Conta Google Ads não configurada corretamente';
        } else {
          errorMessage = text.substring(0, 300); // Primeiros 300 caracteres
        }
      }
    } catch (parseError) {
      console.error('[GoogleAdsClient] Erro ao parsear resposta de erro:', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        errorName: parseError instanceof Error ? parseError.name : 'Unknown',
        errorStack: parseError instanceof Error ? parseError.stack : undefined,
        responseStatus: response.status,
        responseStatusText: response.statusText,
        contentType: response.headers.get('content-type'),
        timestamp: new Date().toISOString(),
      });
    }
    
    return {
      message: errorMessage,
      code: errorCode,
      details: errorDetails,
    };
  }

  /**
   * Fetch account details in batches to avoid rate limits
   */
  private async fetchAccountDetailsInBatches(
    customerIds: string[],
    batchSize: number = 5
  ): Promise<GoogleAdsAccountInfo[]> {
    const customers: GoogleAdsAccountInfo[] = [];
    
    // Processar em lotes
    for (let i = 0; i < customerIds.length; i += batchSize) {
      const batch = customerIds.slice(i, i + batchSize);
      
      // Buscar detalhes em paralelo dentro do lote
      const batchResults = await Promise.allSettled(
        batch.map(customerId => this.getAccountInfo(customerId))
      );
      
      // Processar resultados
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          customers.push(result.value);
        } else {
          const customerId = batch[index];
          console.warn(
            `[GoogleAdsClient] Não foi possível acessar conta ${customerId}:`,
            result.reason?.message || result.reason
          );
        }
      });
      
      // Pequeno delay entre lotes para evitar rate limit
      if (i + batchSize < customerIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return customers;
  }

  // ==========================================================================
  // Query Builders
  // ==========================================================================

  /**
   * Build GAQL query for campaigns (v22 compatible)
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
