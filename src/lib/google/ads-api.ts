/**
 * Google Ads API Client
 * Handles communication with Google Ads API with proper error handling
 */

import { google } from 'googleapis';

interface GoogleAdsConfig {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  redirectUri: string;
}

interface AccessToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export class GoogleAdsApiClient {
  private config: GoogleAdsConfig;
  private readonly API_VERSION = 'v22';
  private readonly BASE_URL = 'https://googleads.googleapis.com';

  constructor(config: GoogleAdsConfig) {
    this.config = config;
  }

  /**
   * Create authenticated fetch client
   */
  private getAuthHeaders(accessToken: string) {
    return {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': this.config.developerToken,
      'Content-Type': 'application/json',
    };
  }

  /**
   * List accessible Google Ads accounts
   */
  async listAccessibleAccounts(accessToken: string): Promise<any> {
    try {
      console.log('[Google Ads API] 🚀 Iniciando listAccessibleAccounts');
      console.log('[Google Ads API] 🎯 Access Token:', accessToken ? `${accessToken.substring(0, 10)}...` : 'NÃO INFORMADO');
      console.log('[Google Ads API] 🎯 Headers:', this.getAuthHeaders(accessToken));
      
      const response = await fetch(
        `${this.BASE_URL}/${this.API_VERSION}/customers:listAccessibleCustomers`,
        {
          method: 'GET',
          headers: this.getAuthHeaders(accessToken),
        }
      );

      console.log('[Google Ads API] 📡 Resposta recebida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      // Verificar se a resposta está vazia
      const responseText = await response.text();
      console.log('[Google Ads API] 📄 Texto da resposta (primeiros 500 chars):', responseText.substring(0, 500));
      
      if (!responseText) {
        console.warn('[Google Ads API] Empty response received');
        return { resourceNames: [] };
      }

      if (!response.ok) {
        console.error('[Google Ads API] Error response:', {
          status: response.status,
          statusText: response.statusText,
          body: responseText.substring(0, 1000)
        });

        // Tratar erros específicos
        if (response.status === 501) {
          const error = new Error('API_NOT_ENABLED: Google Ads API não está habilitada ou Developer Token não aprovado');
          (error as any).status = 501;
          throw error;
        }

        if (response.status === 403) {
          throw new Error('PERMISSION_DENIED: Developer Token inválido ou não tem permissão');
        }

        if (response.status === 401) {
          throw new Error('UNAUTHENTICATED: Token OAuth inválido ou expirado');
        }

        throw new Error(`API_ERROR: ${response.status} - ${response.statusText}`);
      }

      // Tentar parsear JSON
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('[Google Ads API] ✅ JSON parseado com sucesso');
      } catch (parseError: any) {
        console.error('[Google Ads API] Failed to parse JSON response:', responseText.substring(0, 500));
        throw new Error('INVALID_RESPONSE: Resposta inválida da API do Google Ads');
      }

      console.log('[Google Ads API] ✅ Dados retornados:', data);
      return data;
    } catch (error: any) {
      console.error('[Google Ads API] List accounts error:', error);
      console.error('[Google Ads API] List accounts error - Tipo:', typeof error);
      console.error('[Google Ads API] List accounts error - Mensagem:', error?.message);
      console.error('[Google Ads API] List accounts error - Stack:', error?.stack);
      throw error;
    }
  }

  /**
   * Get customer details
   */
  async getCustomerDetails(accessToken: string, customerId: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.BASE_URL}/${this.API_VERSION}/customers/${customerId}`,
        {
          method: 'GET',
          headers: this.getAuthHeaders(accessToken),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get customer details: ${response.status} - ${errorText.substring(0, 500)}`);
      }

      const responseText = await response.text();
      
      // Tentar parsear JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError: any) {
        console.error('[Google Ads API] Failed to parse customer details JSON:', responseText.substring(0, 500));
        throw new Error('INVALID_CUSTOMER_RESPONSE: Resposta inválida ao buscar detalhes do cliente');
      }

      return data;
    } catch (error: any) {
      console.error('[Google Ads API] Get customer error:', error);
      throw error;
    }
  }

  /**
   * Search Google Ads data using GAQL
   */
  async searchAdsData(accessToken: string, customerId: string, query: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.BASE_URL}/${this.API_VERSION}/customers/${customerId}/googleAds:search`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(accessToken),
          body: JSON.stringify({ query }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Search failed: ${response.status} - ${errorText.substring(0, 500)}`);
      }

      const responseText = await response.text();
      
      // Tentar parsear JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError: any) {
        console.error('[Google Ads API] Failed to parse search JSON:', responseText.substring(0, 500));
        throw new Error('INVALID_SEARCH_RESPONSE: Resposta inválida na busca de dados');
      }

      return data;
    } catch (error: any) {
      console.error('[Google Ads API] Search error:', error);
      throw error;
    }
  }

  /**
   * Test API connectivity
   */
  async testConnection(accessToken: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.listAccessibleAccounts(accessToken);
      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
}

// Singleton instance
let googleAdsClient: GoogleAdsApiClient | null = null;

export function getGoogleAdsClient(): GoogleAdsApiClient {
  console.log('[Google Ads Client] 🚀 Criando/obtendo cliente da API');
  console.log('[Google Ads Client] 📋 Configuração:', {
    hasClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasDeveloperToken: !!process.env.GOOGLE_DEVELOPER_TOKEN,
    appUrl: process.env.NEXT_PUBLIC_APP_URL
  });
  
  if (!googleAdsClient) {
    console.log('[Google Ads Client] 🆕 Criando nova instância do cliente');
    googleAdsClient = new GoogleAdsApiClient({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      developerToken: process.env.GOOGLE_DEVELOPER_TOKEN || '',
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`,
    });
  } else {
    console.log('[Google Ads Client] ♻️ Usando instância existente');
  }
  
  console.log('[Google Ads Client] ✅ Cliente retornado');
  return googleAdsClient;
}