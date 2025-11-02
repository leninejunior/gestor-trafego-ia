/**
 * Google Ads Token Manager
 * 
 * Manages Google Ads OAuth tokens with encryption and automatic refresh
 * Requirements: 1.3, 10.2
 */

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getGoogleOAuthService, TokenResponse } from './oauth';
import { getGoogleAdsCryptoService, EncryptionResult, DecryptionResult } from './crypto-service';
import { getGoogleAdsAuditService } from './audit-service';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: Date;
}

export interface ConnectionTokens {
  connectionId: string;
  clientId: string;
  customerId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  status: 'active' | 'expired' | 'revoked';
}

export interface TokenUpdateResult {
  success: boolean;
  accessToken?: string;
  expiresAt?: Date;
  error?: string;
}

// ============================================================================
// Token Manager Class
// ============================================================================

export class GoogleTokenManager {
  private oauthService = getGoogleOAuthService();
  private cryptoService = getGoogleAdsCryptoService();
  private auditService = getGoogleAdsAuditService();
  
  // Token refresh buffer (refresh 5 minutes before expiration)
  private readonly REFRESH_BUFFER_MINUTES = 5;

  constructor() {
    // Services handle their own initialization
  }

  // ==========================================================================
  // Token Encryption/Decryption (using CryptoService)
  // ==========================================================================

  /**
   * Encrypt a token string using crypto service
   */
  private async encryptToken(token: string): Promise<string> {
    try {
      const result = await this.cryptoService.encryptToken(token);
      
      // Log encryption operation for audit
      await this.auditService.logTokenOperation(
        'token_encrypt',
        '', // connectionId not available at this level
        '', // clientId not available at this level
        true,
        undefined,
        {
          keyVersion: result.keyVersion,
          algorithm: result.algorithm,
        }
      );
      
      return result.encryptedData;
    } catch (error) {
      console.error('[Token Manager] Encryption error:', error);
      
      // Log failed encryption
      await this.auditService.logTokenOperation(
        'token_encrypt',
        '',
        '',
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      throw new Error('Failed to encrypt token');
    }
  }

  /**
   * Decrypt a token string using crypto service
   */
  private async decryptToken(encryptedToken: string): Promise<string> {
    try {
      const result = await this.cryptoService.decryptToken(encryptedToken);
      
      // Log decryption operation for audit
      await this.auditService.logTokenOperation(
        'token_decrypt',
        '',
        '',
        true,
        undefined,
        {
          keyVersion: result.keyVersion,
        }
      );
      
      return result.decryptedData;
    } catch (error) {
      console.error('[Token Manager] Decryption error:', error);
      
      // Log failed decryption
      await this.auditService.logTokenOperation(
        'token_decrypt',
        '',
        '',
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      throw new Error('Failed to decrypt token');
    }
  }

  // ==========================================================================
  // Token Storage
  // ==========================================================================

  /**
   * Save tokens to database (encrypted)
   */
  async saveTokens(
    connectionId: string,
    tokens: TokenResponse
  ): Promise<void> {
    try {
      const supabase = createServiceClient();

      // Encrypt tokens
      const encryptedAccessToken = await this.encryptToken(tokens.access_token);
      const encryptedRefreshToken = tokens.refresh_token 
        ? await this.encryptToken(tokens.refresh_token)
        : null;

      // Calculate expiration date
      const expiresAt = this.oauthService.calculateExpirationDate(
        tokens.expires_in
      );

      // Update connection with encrypted tokens
      const { error } = await supabase
        .from('google_ads_connections')
        .update({
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: expiresAt.toISOString(),
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectionId);

      if (error) {
        throw error;
      }

      // Log token save operation
      await this.auditService.logTokenOperation(
        'token_refresh',
        connectionId,
        '', // clientId will be determined from connection
        true,
        undefined,
        {
          expiresAt: expiresAt.toISOString(),
          hasRefreshToken: !!tokens.refresh_token,
        }
      );

      console.log('[Token Manager] Tokens saved successfully:', {
        connectionId,
        expiresAt,
      });
    } catch (error) {
      console.error('[Token Manager] Error saving tokens:', error);
      throw new Error('Failed to save tokens to database');
    }
  }

  /**
   * Get tokens from database (decrypted)
   */
  async getTokens(connectionId: string): Promise<TokenData | null> {
    try {
      const supabase = createServiceClient();

      const { data, error } = await supabase
        .from('google_ads_connections')
        .select('access_token, refresh_token, token_expires_at')
        .eq('id', connectionId)
        .single();

      if (error || !data) {
        console.error('[Token Manager] Error fetching tokens:', error);
        return null;
      }

      // Decrypt tokens
      const accessToken = data.access_token 
        ? await this.decryptToken(data.access_token)
        : '';
      
      const refreshToken = data.refresh_token
        ? await this.decryptToken(data.refresh_token)
        : '';

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: new Date(data.token_expires_at),
      };
    } catch (error) {
      console.error('[Token Manager] Error getting tokens:', error);
      return null;
    }
  }

  /**
   * Get connection details with tokens
   */
  async getConnection(connectionId: string): Promise<ConnectionTokens | null> {
    try {
      const supabase = createServiceClient();

      const { data, error } = await supabase
        .from('google_ads_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (error || !data) {
        console.error('[Token Manager] Error fetching connection:', error);
        return null;
      }

      // Decrypt tokens
      const accessToken = data.access_token 
        ? await this.decryptToken(data.access_token)
        : '';
      
      const refreshToken = data.refresh_token
        ? await this.decryptToken(data.refresh_token)
        : '';

      return {
        connectionId: data.id,
        clientId: data.client_id,
        customerId: data.customer_id,
        accessToken,
        refreshToken,
        expiresAt: new Date(data.token_expires_at),
        status: data.status,
      };
    } catch (error) {
      console.error('[Token Manager] Error getting connection:', error);
      return null;
    }
  }

  // ==========================================================================
  // Token Refresh Logic
  // ==========================================================================

  /**
   * Check if token is expired or about to expire
   */
  isTokenExpired(expiresAt: Date): boolean {
    return this.oauthService.isTokenExpired(
      expiresAt,
      this.REFRESH_BUFFER_MINUTES
    );
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    connectionId: string,
    refreshToken: string
  ): Promise<TokenUpdateResult> {
    try {
      console.log('[Token Manager] Refreshing access token:', { connectionId });

      // Call OAuth service to refresh token
      const newTokens = await this.oauthService.refreshToken(refreshToken);

      // Save new tokens to database
      await this.saveTokens(connectionId, newTokens);

      const expiresAt = this.oauthService.calculateExpirationDate(
        newTokens.expires_in
      );

      console.log('[Token Manager] Token refreshed successfully:', {
        connectionId,
        expiresAt,
      });

      return {
        success: true,
        accessToken: newTokens.access_token,
        expiresAt,
      };
    } catch (error) {
      console.error('[Token Manager] Error refreshing token:', error);

      // Mark connection as expired
      await this.markConnectionExpired(connectionId);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed',
      };
    }
  }

  /**
   * Mark connection as expired in database
   */
  private async markConnectionExpired(connectionId: string): Promise<void> {
    try {
      const supabase = createServiceClient();

      await supabase
        .from('google_ads_connections')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectionId);

      console.log('[Token Manager] Connection marked as expired:', connectionId);
    } catch (error) {
      console.error('[Token Manager] Error marking connection expired:', error);
    }
  }

  // ==========================================================================
  // Main Token Management Method
  // ==========================================================================

  /**
   * Ensure valid access token (refresh if needed)
   * This is the main method to use before making API calls
   */
  async ensureValidToken(connectionId: string): Promise<string> {
    try {
      // Get current tokens
      const tokens = await this.getTokens(connectionId);

      if (!tokens) {
        throw new Error('Connection not found or tokens unavailable');
      }

      // Check if token is expired or about to expire
      if (this.isTokenExpired(tokens.expires_at)) {
        console.log('[Token Manager] Token expired, refreshing...', {
          connectionId,
          expiresAt: tokens.expires_at,
        });

        // Refresh token
        const result = await this.refreshAccessToken(
          connectionId,
          tokens.refresh_token
        );

        if (!result.success || !result.accessToken) {
          throw new Error(result.error || 'Failed to refresh token');
        }

        return result.accessToken;
      }

      // Token is still valid
      console.log('[Token Manager] Token is valid:', {
        connectionId,
        expiresAt: tokens.expires_at,
      });

      return tokens.access_token;
    } catch (error) {
      console.error('[Token Manager] Error ensuring valid token:', error);
      throw error;
    }
  }

  /**
   * Ensure valid token for a client (finds active connection)
   */
  async ensureValidTokenForClient(clientId: string): Promise<{
    accessToken: string;
    connectionId: string;
    customerId: string;
  }> {
    try {
      const supabase = createServiceClient();

      // Find active connection for client
      const { data, error } = await supabase
        .from('google_ads_connections')
        .select('id, customer_id')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        throw new Error('No active Google Ads connection found for client');
      }

      // Ensure valid token
      const accessToken = await this.ensureValidToken(data.id);

      return {
        accessToken,
        connectionId: data.id,
        customerId: data.customer_id,
      };
    } catch (error) {
      console.error('[Token Manager] Error ensuring token for client:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Token Revocation
  // ==========================================================================

  /**
   * Revoke tokens and mark connection as revoked
   */
  async revokeTokens(connectionId: string): Promise<void> {
    try {
      // Get tokens
      const tokens = await this.getTokens(connectionId);

      if (tokens && tokens.access_token) {
        // Revoke access token
        await this.oauthService.revokeToken(tokens.access_token);
      }

      // Mark connection as revoked
      const supabase = createServiceClient();
      await supabase
        .from('google_ads_connections')
        .update({
          status: 'revoked',
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectionId);

      console.log('[Token Manager] Tokens revoked:', connectionId);
    } catch (error) {
      console.error('[Token Manager] Error revoking tokens:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get all connections that need token refresh
   */
  async getConnectionsNeedingRefresh(): Promise<string[]> {
    try {
      const supabase = createServiceClient();

      // Get connections expiring in the next 10 minutes
      const bufferTime = new Date();
      bufferTime.setMinutes(bufferTime.getMinutes() + 10);

      const { data, error } = await supabase
        .from('google_ads_connections')
        .select('id')
        .eq('status', 'active')
        .lt('token_expires_at', bufferTime.toISOString());

      if (error) {
        throw error;
      }

      return data?.map(conn => conn.id) || [];
    } catch (error) {
      console.error('[Token Manager] Error getting connections needing refresh:', error);
      return [];
    }
  }

  /**
   * Batch refresh tokens for multiple connections
   */
  async batchRefreshTokens(connectionIds: string[]): Promise<{
    successful: string[];
    failed: string[];
  }> {
    const successful: string[] = [];
    const failed: string[] = [];

    for (const connectionId of connectionIds) {
      try {
        await this.ensureValidToken(connectionId);
        successful.push(connectionId);
      } catch (error) {
        console.error(`[Token Manager] Failed to refresh token for ${connectionId}:`, error);
        failed.push(connectionId);
      }
    }

    return { successful, failed };
  }

  /**
   * Validate token encryption/decryption
   */
  async testEncryption(): Promise<boolean> {
    try {
      const testResult = await this.cryptoService.testEncryption();
      return testResult.success;
    } catch (error) {
      console.error('[Token Manager] Encryption test failed:', error);
      return false;
    }
  }

  // ==========================================================================
  // Audit Logging
  // ==========================================================================

  // Audit logging is now handled by the audit service
}

// ============================================================================
// Singleton Instance
// ============================================================================

let tokenManagerInstance: GoogleTokenManager | null = null;

/**
 * Get singleton instance of GoogleTokenManager
 */
export function getGoogleTokenManager(): GoogleTokenManager {
  if (!tokenManagerInstance) {
    tokenManagerInstance = new GoogleTokenManager();
  }
  return tokenManagerInstance;
}
