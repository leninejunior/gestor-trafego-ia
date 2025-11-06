/**
 * Google Ads Token Manager - Versão Simplificada
 * 
 * Versão simplificada sem criptografia complexa para resolver o problema imediato
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getGoogleOAuthService, TokenResponse } from './oauth';

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: Date;
}

export class GoogleTokenManagerSimple {
  private oauthService = getGoogleOAuthService();

  /**
   * Save tokens to database (versão simplificada)
   */
  async saveTokens(connectionId: string, tokens: TokenResponse): Promise<void> {
    try {
      console.log('[Token Manager Simple] Saving tokens for connection:', connectionId);
      
      const supabase = createServiceClient();

      // Calculate expiration date
      const expiresAt = this.oauthService.calculateExpirationDate(tokens.expires_in);

      console.log('[Token Manager Simple] Token data:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiresIn: tokens.expires_in,
        expiresAt: expiresAt.toISOString()
      });

      // Update connection with tokens (sem criptografia por enquanto)
      const { error } = await supabase
        .from('google_ads_connections')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt.toISOString(),
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectionId);

      if (error) {
        console.error('[Token Manager Simple] Database error:', error);
        throw error;
      }

      console.log('[Token Manager Simple] Tokens saved successfully');
    } catch (error) {
      console.error('[Token Manager Simple] Error saving tokens:', error);
      throw new Error(`Failed to save tokens: ${error.message}`);
    }
  }

  /**
   * Get tokens from database
   */
  async getTokens(connectionId: string): Promise<TokenData | null> {
    try {
      const supabase = createServiceClient();

      const { data, error } = await supabase
        .from('google_ads_connections')
        .select('access_token, refresh_token, expires_at')
        .eq('id', connectionId)
        .single();

      if (error || !data) {
        console.error('[Token Manager Simple] Error getting tokens:', error);
        return null;
      }

      if (!data.access_token || !data.refresh_token) {
        console.log('[Token Manager Simple] No tokens found for connection');
        return null;
      }

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(data.expires_at),
      };
    } catch (error) {
      console.error('[Token Manager Simple] Error getting tokens:', error);
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(expiresAt: Date): boolean {
    const now = new Date();
    const buffer = 5 * 60 * 1000; // 5 minutes buffer
    return now.getTime() >= (expiresAt.getTime() - buffer);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(connectionId: string): Promise<string | null> {
    try {
      const tokens = await this.getTokens(connectionId);
      if (!tokens || !tokens.refresh_token) {
        console.log('[Token Manager Simple] No refresh token available');
        return null;
      }

      console.log('[Token Manager Simple] Refreshing access token...');
      
      const newTokens = await this.oauthService.refreshAccessToken(tokens.refresh_token);
      
      // Save new tokens
      await this.saveTokens(connectionId, {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token || tokens.refresh_token,
        expires_in: newTokens.expires_in,
      });

      console.log('[Token Manager Simple] Access token refreshed successfully');
      return newTokens.access_token;
    } catch (error) {
      console.error('[Token Manager Simple] Error refreshing token:', error);
      return null;
    }
  }

  /**
   * Ensure we have a valid access token
   */
  async ensureValidToken(connectionId: string): Promise<string> {
    try {
      const tokens = await this.getTokens(connectionId);
      
      if (!tokens) {
        throw new Error('No tokens found for connection');
      }

      // Check if token is expired
      if (this.isTokenExpired(tokens.expires_at)) {
        console.log('[Token Manager Simple] Token expired, refreshing...');
        const newAccessToken = await this.refreshAccessToken(connectionId);
        
        if (!newAccessToken) {
          throw new Error('Failed to refresh access token');
        }
        
        return newAccessToken;
      }

      return tokens.access_token;
    } catch (error) {
      console.error('[Token Manager Simple] Error ensuring valid token:', error);
      throw error;
    }
  }
}

// Singleton instance
let tokenManagerInstance: GoogleTokenManagerSimple | null = null;

export function getGoogleTokenManagerSimple(): GoogleTokenManagerSimple {
  if (!tokenManagerInstance) {
    tokenManagerInstance = new GoogleTokenManagerSimple();
  }
  return tokenManagerInstance;
}