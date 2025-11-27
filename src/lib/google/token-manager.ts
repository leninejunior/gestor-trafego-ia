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
  
  // Retry configuration for token refresh
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly INITIAL_RETRY_DELAY_MS = 1000; // 1 second
  private readonly MAX_RETRY_DELAY_MS = 10000; // 10 seconds

  constructor() {
    // Services handle their own initialization
  }

  // ==========================================================================
  // Token Encryption/Decryption (using CryptoService)
  // ==========================================================================

  /**
   * Encrypt a token string using crypto service
   */
  private async encryptToken(token: string, connectionId?: string, clientId?: string): Promise<string> {
    try {
      const result = await this.cryptoService.encryptToken(token, connectionId, clientId);
      
      return result.encryptedData;
    } catch (error) {
      console.error('[Token Manager] Encryption error:', error);
      throw new Error('Failed to encrypt token');
    }
  }

  /**
   * Decrypt a token string using crypto service
   * Handles both encrypted and plain text tokens for backward compatibility
   */
  private async decryptToken(encryptedToken: string, connectionId?: string, clientId?: string): Promise<string> {
    try {
      // Decrypt using crypto service (which handles plain text fallback and audit logging)
      const result = await this.cryptoService.decryptToken(encryptedToken, connectionId, clientId);
      
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
      
      // If decryption fails, assume it's plain text (migration fallback)
      console.log('[Token Manager] ⚠️ Decryption failed, treating as plain text (migration fallback)');
      return encryptedToken;
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

      // Get clientId from connection for audit logging
      const { data: connection } = await supabase
        .from('google_ads_connections')
        .select('client_id')
        .eq('id', connectionId)
        .single();

      const clientId = connection?.client_id;

      // Encrypt tokens with audit logging
      const encryptedAccessToken = await this.encryptToken(tokens.access_token, connectionId, clientId);
      const encryptedRefreshToken = tokens.refresh_token 
        ? await this.encryptToken(tokens.refresh_token, connectionId, clientId)
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
          expires_at: expiresAt.toISOString(),
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
        clientId || '',
        true,
        undefined,
        {
          expiresAt: expiresAt.toISOString(),
          hasRefreshToken: !!tokens.refresh_token,
        }
      );

      console.log('[Token Manager] Tokens saved successfully:', {
        connectionId,
        clientId,
        expiresAt,
      });
    } catch (error) {
      console.error('[Token Manager] Error saving tokens:', error);
      throw new Error('Failed to save tokens to database');
    }
  }

  /**
   * Check if a token is in plain text format
   */
  private isPlainTextToken(token: string): boolean {
    return (
      token.startsWith('ya29.') || // Access token
      token.startsWith('1//') ||   // Refresh token
      token.length < 100           // Too short to be encrypted
    );
  }

  /**
   * Migrate plain text tokens to encrypted format
   * This is called automatically when plain text tokens are detected
   */
  private async migratePlainTextTokens(
    connectionId: string,
    accessToken: string,
    refreshToken: string
  ): Promise<void> {
    let clientId: string | undefined;
    
    try {
      const supabase = createServiceClient();
      
      console.log('[Token Manager] ========================================');
      console.log('[Token Manager] Starting plain text token migration:', {
        connectionId,
        timestamp: new Date().toISOString(),
      });

      // Check which tokens need encryption
      const needsAccessTokenEncryption = accessToken && this.isPlainTextToken(accessToken);
      const needsRefreshTokenEncryption = refreshToken && this.isPlainTextToken(refreshToken);

      if (!needsAccessTokenEncryption && !needsRefreshTokenEncryption) {
        console.log('[Token Manager] No plain text tokens to migrate');
        console.log('[Token Manager] ========================================');
        return;
      }

      console.log('[Token Manager] Tokens requiring migration:', {
        accessToken: needsAccessTokenEncryption,
        refreshToken: needsRefreshTokenEncryption,
      });

      // Get clientId from connection for audit logging
      const { data: connection } = await supabase
        .from('google_ads_connections')
        .select('client_id')
        .eq('id', connectionId)
        .single();

      clientId = connection?.client_id;

      // Encrypt tokens
      const updates: any = {
        updated_at: new Date().toISOString(),
      };

      if (needsAccessTokenEncryption) {
        console.log('[Token Manager] Encrypting plain text access token...');
        updates.access_token = await this.encryptToken(accessToken, connectionId, clientId);
        console.log('[Token Manager] ✅ Access token encrypted');
      }

      if (needsRefreshTokenEncryption) {
        console.log('[Token Manager] Encrypting plain text refresh token...');
        updates.refresh_token = await this.encryptToken(refreshToken, connectionId, clientId);
        console.log('[Token Manager] ✅ Refresh token encrypted');
      }

      // Update database with encrypted tokens
      console.log('[Token Manager] Updating database with encrypted tokens...');
      const { error } = await supabase
        .from('google_ads_connections')
        .update(updates)
        .eq('id', connectionId);

      if (error) {
        console.error('[Token Manager] ❌ Failed to update encrypted tokens:', {
          connectionId,
          error: error.message,
          errorCode: error.code,
        });
        throw error;
      }

      console.log('[Token Manager] ✅ Plain text tokens migrated successfully:', {
        connectionId,
        accessTokenMigrated: needsAccessTokenEncryption,
        refreshTokenMigrated: needsRefreshTokenEncryption,
      });

      // Log migration to audit (using token_encrypt since migration involves encryption)
      await this.auditService.logTokenOperation(
        'token_encrypt',
        connectionId,
        clientId || '',
        true,
        undefined,
        {
          migration: true,
          accessTokenMigrated: needsAccessTokenEncryption,
          refreshTokenMigrated: needsRefreshTokenEncryption,
          timestamp: new Date().toISOString(),
        }
      );

      console.log('[Token Manager] ========================================');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      
      console.error('[Token Manager] ❌ Token migration failed:', {
        connectionId,
        error: err.message,
        errorType: err.constructor.name,
        stack: err.stack,
      });

      // Log failed migration to audit (using token_encrypt since migration involves encryption)
      await this.auditService.logTokenOperation(
        'token_encrypt',
        connectionId,
        clientId || '',
        false,
        err.message,
        {
          migration: true,
          timestamp: new Date().toISOString(),
        }
      );

      console.log('[Token Manager] ========================================');
      
      // Don't throw - migration failure shouldn't break token usage
      console.warn('[Token Manager] ⚠️ Continuing with plain text tokens despite migration failure');
    }
  }

  /**
   * Get tokens from database (decrypted)
   * Automatically migrates plain text tokens to encrypted format
   */
  async getTokens(connectionId: string): Promise<TokenData | null> {
    try {
      const supabase = createServiceClient();

      console.log('[Token Manager] Fetching tokens from database:', { connectionId });

      const { data, error } = await supabase
        .from('google_ads_connections')
        .select('access_token, refresh_token, token_expires_at')
        .eq('id', connectionId)
        .single();

      if (error || !data) {
        console.error('[Token Manager] Error fetching tokens from database:', {
          connectionId,
          error: error?.message || 'No data returned',
          errorCode: error?.code,
        });
        return null;
      }

      console.log('[Token Manager] Tokens fetched from database:', {
        connectionId,
        hasAccessToken: !!data.access_token,
        hasRefreshToken: !!data.refresh_token,
        tokenExpiresAt: data.token_expires_at,
        accessTokenLength: data.access_token?.length || 0,
        refreshTokenLength: data.refresh_token?.length || 0,
      });

      // Get clientId for audit logging
      const { data: connection } = await supabase
        .from('google_ads_connections')
        .select('client_id')
        .eq('id', connectionId)
        .single();

      const clientId = connection?.client_id;

      // Decrypt tokens with audit logging
      console.log('[Token Manager] Decrypting access token...');
      const accessToken = data.access_token 
        ? await this.decryptToken(data.access_token, connectionId, clientId)
        : '';
      
      console.log('[Token Manager] Decrypting refresh token...');
      const refreshToken = data.refresh_token
        ? await this.decryptToken(data.refresh_token, connectionId, clientId)
        : '';

      console.log('[Token Manager] Tokens decrypted successfully:', {
        connectionId,
        decryptedAccessTokenLength: accessToken.length,
        decryptedRefreshTokenLength: refreshToken.length,
        expiresAt: new Date(data.token_expires_at).toISOString(),
      });

      // Check if we need to migrate plain text tokens
      const hasPlainTextTokens = 
        (data.access_token && this.isPlainTextToken(data.access_token)) ||
        (data.refresh_token && this.isPlainTextToken(data.refresh_token));

      if (hasPlainTextTokens) {
        console.log('[Token Manager] ⚠️ Plain text tokens detected, initiating migration...');
        
        // Migrate in background (don't wait for it)
        this.migratePlainTextTokens(connectionId, accessToken, refreshToken)
          .catch(err => {
            console.error('[Token Manager] Background migration failed:', err);
          });
      }

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: new Date(data.token_expires_at),
      };
    } catch (error) {
      console.error('[Token Manager] Error getting tokens:', {
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      
      if (error instanceof Error && error.stack) {
        console.error('[Token Manager] Error stack trace:', error.stack);
      }
      
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

      // Decrypt tokens with audit logging
      const accessToken = data.access_token 
        ? await this.decryptToken(data.access_token, data.id, data.client_id)
        : '';
      
      const refreshToken = data.refresh_token
        ? await this.decryptToken(data.refresh_token, data.id, data.client_id)
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
   * Calculate exponential backoff delay for retry attempts
   */
  private calculateRetryDelay(attemptNumber: number): number {
    // Exponential backoff: delay = min(initialDelay * 2^attempt, maxDelay)
    const delay = Math.min(
      this.INITIAL_RETRY_DELAY_MS * Math.pow(2, attemptNumber),
      this.MAX_RETRY_DELAY_MS
    );
    
    // Add jitter (random variation of ±20%) to prevent thundering herd
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    
    return Math.floor(delay + jitter);
  }

  /**
   * Sleep for specified milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if token is expired or about to expire
   */
  isTokenExpired(expiresAt: Date): boolean {
    const now = new Date();
    const bufferMs = this.REFRESH_BUFFER_MINUTES * 60 * 1000;
    const expiresAtMs = expiresAt.getTime();
    const nowMs = now.getTime();
    const timeUntilExpiry = expiresAtMs - nowMs;
    const isExpired = this.oauthService.isTokenExpired(
      expiresAt,
      this.REFRESH_BUFFER_MINUTES
    );

    // Detailed logging for token expiration status
    console.log('[Token Manager] Token expiration check:', {
      expiresAt: expiresAt.toISOString(),
      now: now.toISOString(),
      timeUntilExpiryMs: timeUntilExpiry,
      timeUntilExpiryMinutes: Math.floor(timeUntilExpiry / 1000 / 60),
      bufferMinutes: this.REFRESH_BUFFER_MINUTES,
      isExpired,
      willExpireSoon: timeUntilExpiry < bufferMs && timeUntilExpiry > 0,
      alreadyExpired: timeUntilExpiry <= 0,
    });

    return isExpired;
  }

  /**
   * Refresh access token using refresh token with retry logic
   */
  async refreshAccessToken(
    connectionId: string,
    refreshToken: string
  ): Promise<TokenUpdateResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    
    console.log('[Token Manager] ========================================');
    console.log('[Token Manager] Starting token refresh with retry logic:', {
      connectionId,
      timestamp: new Date().toISOString(),
      hasRefreshToken: !!refreshToken,
      refreshTokenPrefix: refreshToken ? refreshToken.substring(0, 10) + '...' : 'none',
      maxRetries: this.MAX_RETRY_ATTEMPTS,
    });

    // Attempt token refresh with retries
    for (let attempt = 0; attempt < this.MAX_RETRY_ATTEMPTS; attempt++) {
      const attemptStartTime = Date.now();
      
      try {
        console.log(`[Token Manager] Refresh attempt ${attempt + 1}/${this.MAX_RETRY_ATTEMPTS}:`, {
          connectionId,
          attemptNumber: attempt + 1,
          timestamp: new Date().toISOString(),
        });

        // Call OAuth service to refresh token
        console.log('[Token Manager] Calling Google OAuth API to refresh token...');
        const newTokens = await this.oauthService.refreshToken(refreshToken);

        console.log('[Token Manager] OAuth API response received:', {
          hasAccessToken: !!newTokens.access_token,
          hasRefreshToken: !!newTokens.refresh_token,
          expiresIn: newTokens.expires_in,
          tokenType: newTokens.token_type,
          attemptNumber: attempt + 1,
        });

        // Save new tokens to database
        console.log('[Token Manager] Saving new tokens to database...');
        await this.saveTokens(connectionId, newTokens);

        const expiresAt = this.oauthService.calculateExpirationDate(
          newTokens.expires_in
        );

        const totalDuration = Date.now() - startTime;
        const attemptDuration = Date.now() - attemptStartTime;

        console.log('[Token Manager] ✅ Token refresh completed successfully:', {
          connectionId,
          expiresAt: expiresAt.toISOString(),
          expiresInMinutes: Math.floor(newTokens.expires_in / 60),
          totalDurationMs: totalDuration,
          attemptDurationMs: attemptDuration,
          attemptNumber: attempt + 1,
          retriesUsed: attempt,
          newAccessTokenPrefix: newTokens.access_token.substring(0, 10) + '...',
        });
        console.log('[Token Manager] ========================================');

        // Log successful refresh to audit
        await this.auditService.logTokenOperation(
          'token_refresh',
          connectionId,
          '', // clientId will be determined from connection
          true,
          undefined,
          {
            expiresAt: expiresAt.toISOString(),
            expiresInMinutes: Math.floor(newTokens.expires_in / 60),
            totalDurationMs: totalDuration,
            attemptNumber: attempt + 1,
            retriesUsed: attempt,
            status: 'success',
          }
        );

        return {
          success: true,
          accessToken: newTokens.access_token,
          expiresAt,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Token refresh failed');
        const attemptDuration = Date.now() - attemptStartTime;
        const errorMessage = lastError.message;
        
        console.error(`[Token Manager] ❌ Token refresh attempt ${attempt + 1}/${this.MAX_RETRY_ATTEMPTS} failed:`, {
          connectionId,
          error: errorMessage,
          errorType: lastError.constructor.name,
          attemptDurationMs: attemptDuration,
          attemptNumber: attempt + 1,
          timestamp: new Date().toISOString(),
        });

        if (lastError.stack) {
          console.error('[Token Manager] Error stack trace:', lastError.stack);
        }

        // Log retry attempt to audit
        await this.auditService.logTokenOperation(
          'token_refresh',
          connectionId,
          '',
          false,
          errorMessage,
          {
            attemptNumber: attempt + 1,
            maxAttempts: this.MAX_RETRY_ATTEMPTS,
            attemptDurationMs: attemptDuration,
            errorType: lastError.constructor.name,
            willRetry: attempt < this.MAX_RETRY_ATTEMPTS - 1,
            status: 'retry',
          }
        );

        // If this is not the last attempt, wait before retrying
        if (attempt < this.MAX_RETRY_ATTEMPTS - 1) {
          const retryDelay = this.calculateRetryDelay(attempt);
          
          console.log('[Token Manager] ⏳ Waiting before retry:', {
            connectionId,
            attemptNumber: attempt + 1,
            nextAttempt: attempt + 2,
            retryDelayMs: retryDelay,
            retryDelaySeconds: Math.round(retryDelay / 1000),
          });

          await this.sleep(retryDelay);
          
          console.log('[Token Manager] Retry delay completed, attempting again...');
        }
      }
    }

    // All retry attempts exhausted
    const totalDuration = Date.now() - startTime;
    const errorMessage = lastError?.message || 'Token refresh failed after all retry attempts';
    
    console.error('[Token Manager] ❌ Token refresh failed after all retry attempts:', {
      connectionId,
      error: errorMessage,
      errorType: lastError?.constructor.name || 'Unknown',
      totalDurationMs: totalDuration,
      totalAttempts: this.MAX_RETRY_ATTEMPTS,
      timestamp: new Date().toISOString(),
    });
    console.log('[Token Manager] ========================================');

    // Log final failure to audit
    await this.auditService.logTokenOperation(
      'token_refresh',
      connectionId,
      '',
      false,
      errorMessage,
      {
        totalDurationMs: totalDuration,
        totalAttempts: this.MAX_RETRY_ATTEMPTS,
        errorType: lastError?.constructor.name || 'Unknown',
        allRetriesExhausted: true,
        status: 'failed',
      }
    );

    // Mark connection as expired
    console.log('[Token Manager] Marking connection as expired due to refresh failure...');
    await this.markConnectionExpired(connectionId);

    return {
      success: false,
      error: errorMessage,
    };
  }

  /**
   * Mark connection as expired in database
   */
  private async markConnectionExpired(connectionId: string): Promise<void> {
    try {
      const supabase = createServiceClient();

      console.log('[Token Manager] Marking connection as expired:', {
        connectionId,
        timestamp: new Date().toISOString(),
      });

      const { error } = await supabase
        .from('google_ads_connections')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectionId);

      if (error) {
        console.error('[Token Manager] Error updating connection status:', {
          connectionId,
          error: error.message,
          errorCode: error.code,
        });
        throw error;
      }

      console.log('[Token Manager] ✅ Connection marked as expired successfully:', connectionId);

      // Log to audit using token_refresh operation with expired status
      await this.auditService.logTokenOperation(
        'token_refresh',
        connectionId,
        '',
        false,
        'Connection marked as expired due to token refresh failure',
        {
          reason: 'Token refresh failed',
          timestamp: new Date().toISOString(),
          status: 'connection_expired',
        }
      );
    } catch (error) {
      console.error('[Token Manager] Error marking connection expired:', {
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
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
      console.log('[Token Manager] ========================================');
      console.log('[Token Manager] Ensuring valid token for connection:', {
        connectionId,
        timestamp: new Date().toISOString(),
      });

      // Get current tokens
      console.log('[Token Manager] Fetching current tokens from database...');
      const tokens = await this.getTokens(connectionId);

      if (!tokens) {
        console.error('[Token Manager] ❌ No tokens found for connection:', connectionId);
        throw new Error('Connection not found or tokens unavailable');
      }

      console.log('[Token Manager] Current token status:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiresAt: tokens.expires_at.toISOString(),
        accessTokenPrefix: tokens.access_token ? tokens.access_token.substring(0, 10) + '...' : 'none',
      });

      // Check if token is expired or about to expire
      const isExpired = this.isTokenExpired(tokens.expires_at);
      
      if (isExpired) {
        const now = new Date();
        const timeUntilExpiry = tokens.expires_at.getTime() - now.getTime();
        
        console.log('[Token Manager] ⚠️ Token expired or expiring soon, initiating refresh:', {
          connectionId,
          expiresAt: tokens.expires_at.toISOString(),
          now: now.toISOString(),
          timeUntilExpiryMs: timeUntilExpiry,
          timeUntilExpiryMinutes: Math.floor(timeUntilExpiry / 1000 / 60),
          alreadyExpired: timeUntilExpiry <= 0,
        });

        // Refresh token
        const result = await this.refreshAccessToken(
          connectionId,
          tokens.refresh_token
        );

        if (!result.success || !result.accessToken) {
          console.error('[Token Manager] ❌ Token refresh failed:', {
            connectionId,
            error: result.error,
          });
          throw new Error(result.error || 'Failed to refresh token');
        }

        console.log('[Token Manager] ✅ Token refreshed, returning new access token');
        console.log('[Token Manager] ========================================');
        return result.accessToken;
      }

      // Token is still valid
      const now = new Date();
      const timeUntilExpiry = tokens.expires_at.getTime() - now.getTime();
      
      console.log('[Token Manager] ✅ Token is still valid, no refresh needed:', {
        connectionId,
        expiresAt: tokens.expires_at.toISOString(),
        timeUntilExpiryMs: timeUntilExpiry,
        timeUntilExpiryMinutes: Math.floor(timeUntilExpiry / 1000 / 60),
        timeUntilExpiryHours: Math.floor(timeUntilExpiry / 1000 / 60 / 60),
      });
      console.log('[Token Manager] ========================================');

      return tokens.access_token;
    } catch (error) {
      console.error('[Token Manager] ❌ Error ensuring valid token:', {
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      
      if (error instanceof Error && error.stack) {
        console.error('[Token Manager] Error stack trace:', error.stack);
      }
      
      console.log('[Token Manager] ========================================');
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
      const now = new Date();
      const bufferTime = new Date();
      bufferTime.setMinutes(bufferTime.getMinutes() + 10);

      console.log('[Token Manager] Checking for connections needing token refresh:', {
        now: now.toISOString(),
        bufferTime: bufferTime.toISOString(),
        bufferMinutes: 10,
      });

      const { data, error } = await supabase
        .from('google_ads_connections')
        .select('id, customer_id, token_expires_at, client_id')
        .eq('status', 'active')
        .lt('token_expires_at', bufferTime.toISOString());

      if (error) {
        console.error('[Token Manager] Error querying connections:', {
          error: error.message,
          errorCode: error.code,
        });
        throw error;
      }

      const connectionIds = data?.map(conn => conn.id) || [];

      console.log('[Token Manager] Connections needing refresh:', {
        totalFound: connectionIds.length,
        connections: data?.map(conn => ({
          id: conn.id,
          customerId: conn.customer_id,
          clientId: conn.client_id,
          expiresAt: conn.token_expires_at,
          minutesUntilExpiry: Math.floor(
            (new Date(conn.token_expires_at).getTime() - now.getTime()) / 1000 / 60
          ),
        })),
      });

      return connectionIds;
    } catch (error) {
      console.error('[Token Manager] Error getting connections needing refresh:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
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
    const startTime = Date.now();

    console.log('[Token Manager] ========================================');
    console.log('[Token Manager] Starting batch token refresh:', {
      totalConnections: connectionIds.length,
      connectionIds,
      timestamp: new Date().toISOString(),
    });

    for (let i = 0; i < connectionIds.length; i++) {
      const connectionId = connectionIds[i];
      const connectionStartTime = Date.now();
      
      try {
        console.log(`[Token Manager] Processing connection ${i + 1}/${connectionIds.length}:`, {
          connectionId,
          progress: `${Math.round((i / connectionIds.length) * 100)}%`,
        });

        await this.ensureValidToken(connectionId);
        
        const duration = Date.now() - connectionStartTime;
        successful.push(connectionId);
        
        console.log(`[Token Manager] ✅ Connection ${i + 1}/${connectionIds.length} processed successfully:`, {
          connectionId,
          durationMs: duration,
        });
      } catch (error) {
        const duration = Date.now() - connectionStartTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        console.error(`[Token Manager] ❌ Failed to refresh token for connection ${i + 1}/${connectionIds.length}:`, {
          connectionId,
          error: errorMessage,
          durationMs: duration,
        });
        
        failed.push(connectionId);
      }
    }

    const totalDuration = Date.now() - startTime;

    console.log('[Token Manager] Batch token refresh completed:', {
      totalConnections: connectionIds.length,
      successful: successful.length,
      failed: failed.length,
      successRate: `${Math.round((successful.length / connectionIds.length) * 100)}%`,
      totalDurationMs: totalDuration,
      averageDurationMs: Math.round(totalDuration / connectionIds.length),
      timestamp: new Date().toISOString(),
    });
    console.log('[Token Manager] ========================================');

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
