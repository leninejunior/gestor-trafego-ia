/**
 * Google OAuth Flow Manager
 * 
 * Gerencia todo o fluxo OAuth do Google Ads de forma centralizada
 * Responsável por: iniciação, callback, validação de state, e seleção de contas
 */

import { createClient } from '@/lib/supabase/server';
import { getGoogleOAuthService } from './oauth';
import { getGoogleAdsClient } from './client';

// ============================================================================
// Types
// ============================================================================

export interface OAuthInitiationResult {
  authUrl: string;
  state: string;
}

export interface OAuthCallbackResult {
  success: boolean;
  connectionId?: string;
  clientId?: string;
  error?: string;
  errorCode?: string;
}

export interface GoogleAdsAccountInfo {
  customerId: string;
  descriptiveName: string;
  currencyCode: string;
  timeZone: string;
  canManageClients: boolean;
}

export interface AccountSelectionResult {
  success: boolean;
  connectionIds: string[];
  primaryCustomerId: string;
  error?: string;
}

// ============================================================================
// OAuth Flow Manager Class
// ============================================================================

export class GoogleOAuthFlowManager {
  private oauthService = getGoogleOAuthService();
  
  // ==========================================================================
  // 1. INICIAÇÃO DO FLUXO OAUTH
  // ==========================================================================
  
  /**
   * Inicia o fluxo OAuth para um cliente
   */
  async initiateOAuthFlow(
    userId: string,
    clientId: string
  ): Promise<OAuthInitiationResult> {
    const supabase = await createClient();
    
    // Validar acesso do usuário ao cliente
    await this.validateUserClientAccess(userId, clientId);
    
    // Gerar URL de autorização
    const { url, state } = this.oauthService.getAuthorizationUrl({
      accessType: 'offline',
      prompt: 'consent',
      includeGrantedScopes: true,
    });
    
    // Salvar state no banco (30 minutos de validade)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    
    const { error } = await supabase
      .from('oauth_states')
      .insert({
        state,
        client_id: clientId,
        user_id: userId,
        provider: 'google',
        expires_at: expiresAt.toISOString(),
      });
    
    if (error) {
      throw new Error(`Erro ao salvar state OAuth: ${error.message}`);
    }
    
    console.log('[OAuth Flow] Fluxo iniciado:', { clientId, state });
    
    return { authUrl: url, state };
  }
  
  // ==========================================================================
  // 2. PROCESSAMENTO DO CALLBACK
  // ==========================================================================
  
  /**
   * Processa o callback do Google OAuth
   */
  async processOAuthCallback(
    code: string,
    state: string
  ): Promise<OAuthCallbackResult> {
    try {
      const supabase = await createClient();
      
      // 1. Validar e buscar state
      const oauthState = await this.validateAndGetState(state);
      
      if (!oauthState) {
        return {
          success: false,
          error: 'State OAuth inválido ou expirado',
          errorCode: 'INVALID_STATE',
        };
      }
      
      // 2. Validar acesso do usuário ao cliente
      try {
        await this.validateUserClientAccess(
          oauthState.user_id,
          oauthState.client_id
        );
      } catch (error) {
        return {
          success: false,
          error: 'Acesso negado ao cliente',
          errorCode: 'ACCESS_DENIED',
        };
      }
      
      // 3. Trocar código por tokens
      const tokens = await this.oauthService.exchangeCodeForTokens(code);
      
      // 4. Criar conexão no banco
      const { data: connection, error: connectionError } = await supabase
        .from('google_ads_connections')
        .insert({
          client_id: oauthState.client_id,
          user_id: oauthState.user_id, // ✅ Adicionar user_id
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: new Date(
            Date.now() + tokens.expires_in * 1000
          ).toISOString(),
          customer_id: 'pending', // Será atualizado na seleção de contas
          status: 'active', // ✅ Usar 'active' conforme constraint do banco
        })
        .select('id')
        .single();
      
      if (connectionError || !connection) {
        throw new Error(
          `Erro ao criar conexão: ${connectionError?.message || 'Desconhecido'}`
        );
      }
      
      // 5. Limpar state usado
      await supabase
        .from('oauth_states')
        .delete()
        .eq('state', state);
      
      console.log('[OAuth Flow] Callback processado:', {
        connectionId: connection.id,
        clientId: oauthState.client_id,
      });
      
      return {
        success: true,
        connectionId: connection.id,
        clientId: oauthState.client_id,
      };
      
    } catch (error: any) {
      console.error('[OAuth Flow] Erro no callback:', error);
      return {
        success: false,
        error: error.message || 'Erro ao processar callback',
        errorCode: 'CALLBACK_ERROR',
      };
    }
  }
  
  // ==========================================================================
  // 3. LISTAGEM DE CONTAS DISPONÍVEIS
  // ==========================================================================
  
  /**
   * Lista contas Google Ads disponíveis para uma conexão
   */
  async listAvailableAccounts(
    connectionId: string,
    clientId: string
  ): Promise<GoogleAdsAccountInfo[]> {
    const supabase = await createClient();
    
    // Buscar conexão
    const { data: connection, error } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('client_id', clientId)
      .single();
    
    if (error || !connection) {
      throw new Error('Conexão não encontrada');
    }
    
    // Verificar se token ainda é válido
    const tokenExpiry = new Date(connection.token_expires_at);
    if (tokenExpiry <= new Date()) {
      throw new Error('Token expirado, refaça a conexão');
    }
    
    // Buscar contas usando Google Ads API
    try {
      const googleAdsClient = getGoogleAdsClient({
        accessToken: connection.access_token,
        refreshToken: connection.refresh_token,
        developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        connectionId: connectionId,
      });
      
      const accounts = await googleAdsClient.listAccessibleCustomers();
      
      console.log('[OAuth Flow] Contas listadas:', {
        connectionId,
        totalAccounts: accounts.length,
      });
      
      return accounts;
    } catch (apiError: any) {
      console.error('[OAuth Flow] Erro ao buscar contas:', apiError);
      throw new Error(`Erro ao comunicar com Google Ads: ${apiError.message || 'Erro desconhecido'}`);
    }
  }
  
  // ==========================================================================
  // 4. SELEÇÃO E SALVAMENTO DE CONTAS
  // ==========================================================================
  
  /**
   * Salva as contas selecionadas pelo usuário
   */
  async saveSelectedAccounts(
    connectionId: string,
    clientId: string,
    selectedCustomerIds: string[]
  ): Promise<AccountSelectionResult> {
    try {
      if (selectedCustomerIds.length === 0) {
        throw new Error('Selecione pelo menos uma conta');
      }
      
      const supabase = await createClient();
      
      // Buscar conexão
      const { data: connection, error } = await supabase
        .from('google_ads_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('client_id', clientId)
        .single();
      
      if (error || !connection) {
        throw new Error('Conexão não encontrada');
      }
      
      // Primeira conta será a principal
      const primaryCustomerId = selectedCustomerIds[0];
      
      // Atualizar conexão principal
      const { error: updateError } = await supabase
        .from('google_ads_connections')
        .update({
          customer_id: primaryCustomerId,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectionId);
      
      if (updateError) {
        throw new Error(`Erro ao atualizar conexão: ${updateError.message}`);
      }
      
      const connectionIds = [connectionId];
      
      // Se múltiplas contas, criar conexões adicionais
      if (selectedCustomerIds.length > 1) {
        for (let i = 1; i < selectedCustomerIds.length; i++) {
          const customerId = selectedCustomerIds[i];
          
          const { data: newConnection, error: createError } = await supabase
            .from('google_ads_connections')
            .insert({
              client_id: clientId,
              user_id: connection.user_id, // ✅ Adicionar user_id da conexão original
              customer_id: customerId,
              access_token: connection.access_token,
              refresh_token: connection.refresh_token,
              token_expires_at: connection.token_expires_at,
              status: 'active',
            })
            .select('id')
            .single();
          
          if (!createError && newConnection) {
            connectionIds.push(newConnection.id);
          }
        }
      }
      
      console.log('[OAuth Flow] Contas salvas:', {
        connectionIds,
        primaryCustomerId,
        totalAccounts: selectedCustomerIds.length,
      });
      
      return {
        success: true,
        connectionIds,
        primaryCustomerId,
      };
      
    } catch (error: any) {
      console.error('[OAuth Flow] Erro ao salvar contas:', error);
      return {
        success: false,
        connectionIds: [],
        primaryCustomerId: '',
        error: error.message || 'Erro ao salvar contas',
      };
    }
  }
  
  // ==========================================================================
  // MÉTODOS AUXILIARES
  // ==========================================================================
  
  /**
   * Valida e busca state OAuth
   */
  private async validateAndGetState(state: string) {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .eq('provider', 'google')
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error || !data) {
      console.error('[OAuth Flow] State inválido:', error);
      return null;
    }
    
    return data;
  }
  
  /**
   * Valida se usuário tem acesso ao cliente
   */
  private async validateUserClientAccess(
    userId: string,
    clientId: string
  ): Promise<void> {
    const supabase = await createClient();
    
    // Buscar cliente e sua organização
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, org_id')
      .eq('id', clientId)
      .single();
    
    if (clientError || !client) {
      throw new Error('Cliente não encontrado');
    }
    
    // Verificar membership
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', userId)
      .eq('organization_id', client.org_id)
      .eq('status', 'active')
      .single();
    
    if (membershipError || !membership) {
      throw new Error('Acesso negado ao cliente');
    }
  }
  
  /**
   * Limpa states OAuth expirados (manutenção)
   */
  async cleanupExpiredStates(): Promise<number> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('oauth_states')
      .delete()
      .eq('provider', 'google')
      .lt('expires_at', new Date().toISOString())
      .select('id');
    
    if (error) {
      console.error('[OAuth Flow] Erro ao limpar states:', error);
      return 0;
    }
    
    const count = data?.length || 0;
    console.log('[OAuth Flow] States expirados removidos:', count);
    
    return count;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let flowManagerInstance: GoogleOAuthFlowManager | null = null;

export function getGoogleOAuthFlowManager(): GoogleOAuthFlowManager {
  if (!flowManagerInstance) {
    flowManagerInstance = new GoogleOAuthFlowManager();
  }
  return flowManagerInstance;
}
