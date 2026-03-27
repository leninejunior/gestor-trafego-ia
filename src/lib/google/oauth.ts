/**
 * Google OAuth Service
 * 
 * Manages OAuth 2.0 flow for Google Ads API
 * Requirements: 1.1, 1.3
 */

import { randomBytes } from 'crypto';
import { getCanonicalGoogleRedirectUri } from './redirect-uri';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface AuthorizationUrlOptions {
  state?: string;
  accessType?: 'online' | 'offline';
  prompt?: 'none' | 'consent' | 'select_account';
  includeGrantedScopes?: boolean;
}

// ============================================================================
// Google OAuth Service Class
// ============================================================================

export class GoogleOAuthService {
  private config: GoogleOAuthConfig;
  private readonly AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly TOKEN_URL = 'https://oauth2.googleapis.com/token';
  private readonly REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

  // Default scopes for Google Ads API
  private readonly DEFAULT_SCOPES = [
    'https://www.googleapis.com/auth/adwords',
  ];

  constructor(config?: Partial<GoogleOAuthConfig>) {
    this.config = {
      clientId: config?.clientId || process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: config?.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: config?.redirectUri || getCanonicalGoogleRedirectUri(),
      scopes: config?.scopes || this.DEFAULT_SCOPES,
    };

    this.validateConfig();
  }

  /**
   * Validate OAuth configuration
   */
  private validateConfig(): void {
    if (!this.config.clientId) {
      throw new Error('Google Client ID is required');
    }
    if (!this.config.clientSecret) {
      throw new Error('Google Client Secret is required');
    }
    if (!this.config.redirectUri) {
      throw new Error('Redirect URI is required');
    }
  }

  // ==========================================================================
  // Authorization URL Generation
  // ==========================================================================

  /**
   * Generate authorization URL for OAuth flow
   */
  getAuthorizationUrl(options: AuthorizationUrlOptions = {}): {
    url: string;
    state: string;
  } {
    const state = options.state || this.generateState();
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      state,
      access_type: options.accessType || 'offline',
      prompt: options.prompt || 'consent',
      ...(options.includeGrantedScopes && {
        include_granted_scopes: 'true',
      }),
    });

    return {
      url: `${this.AUTH_URL}?${params.toString()}`,
      state,
    };
  }

  /**
   * Generate secure random state parameter
   */
  generateState(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Validate state parameter
   */
  validateState(receivedState: string, expectedState: string): boolean {
    if (!receivedState || !expectedState) {
      return false;
    }
    
    // Constant-time comparison to prevent timing attacks
    return this.constantTimeCompare(receivedState, expectedState);
  }

  /**
   * Constant-time string comparison
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  // ==========================================================================
  // Token Exchange
  // ==========================================================================

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    try {
      const response = await fetch(this.TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Token exchange failed: ${error.error_description || error.error}`
        );
      }

      const tokens: TokenResponse = await response.json();
      
      // Validate token response
      this.validateTokenResponse(tokens);
      
      return tokens;
    } catch (error) {
      console.error('[Google OAuth] Token exchange error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      const response = await fetch(this.TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Token refresh failed: ${error.error_description || error.error}`
        );
      }

      const tokens: TokenResponse = await response.json();
      
      // Refresh token response doesn't include refresh_token
      // Keep the original refresh token
      if (!tokens.refresh_token) {
        tokens.refresh_token = refreshToken;
      }
      
      this.validateTokenResponse(tokens);
      
      return tokens;
    } catch (error) {
      console.error('[Google OAuth] Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Validate token response
   */
  private validateTokenResponse(tokens: TokenResponse): void {
    if (!tokens.access_token) {
      throw new Error('Invalid token response: missing access_token');
    }
    if (!tokens.expires_in) {
      throw new Error('Invalid token response: missing expires_in');
    }
  }

  // ==========================================================================
  // Token Revocation
  // ==========================================================================

  /**
   * Revoke access or refresh token
   */
  async revokeToken(token: string): Promise<void> {
    try {
      const response = await fetch(this.REVOKE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token revocation failed: ${error}`);
      }
    } catch (error) {
      console.error('[Google OAuth] Token revocation error:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Check if token is expired
   */
  isTokenExpired(expiresAt: Date, bufferMinutes: number = 5): boolean {
    const bufferTime = bufferMinutes * 60 * 1000;
    return Date.now() >= (expiresAt.getTime() - bufferTime);
  }

  /**
   * Calculate token expiration date
   */
  calculateExpirationDate(expiresIn: number): Date {
    return new Date(Date.now() + expiresIn * 1000);
  }

  /**
   * Parse error from OAuth response
   */
  parseOAuthError(error: any): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error.error_description) {
      return error.error_description;
    }

    if (error.error) {
      return error.error;
    }

    if (error.message) {
      return error.message;
    }

    return 'Unknown OAuth error';
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyError(error: any): string {
    const errorMessage = this.parseOAuthError(error);
    const errorLower = errorMessage.toLowerCase();

    if (errorLower.includes('access_denied')) {
      return 'Acesso negado. Você precisa autorizar o aplicativo para continuar.';
    }

    if (errorLower.includes('invalid_grant')) {
      return 'Token inválido ou expirado. Por favor, reconecte sua conta.';
    }

    if (errorLower.includes('invalid_client')) {
      return 'Configuração inválida do aplicativo. Entre em contato com o suporte.';
    }

    if (errorLower.includes('redirect_uri_mismatch')) {
      return 'Erro de configuração. Entre em contato com o suporte.';
    }

    if (errorLower.includes('invalid_scope')) {
      return 'Permissões inválidas solicitadas. Entre em contato com o suporte.';
    }

    return `Erro de autenticação: ${errorMessage}`;
  }

  /**
   * Get configuration (without secrets)
   */
  getConfig(): Omit<GoogleOAuthConfig, 'clientSecret'> {
    return {
      clientId: this.config.clientId,
      redirectUri: this.config.redirectUri,
      scopes: this.config.scopes,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let oauthServiceInstance: GoogleOAuthService | null = null;

/**
 * Get singleton instance of GoogleOAuthService
 */
export function getGoogleOAuthService(): GoogleOAuthService {
  if (!oauthServiceInstance) {
    oauthServiceInstance = new GoogleOAuthService();
  }
  return oauthServiceInstance;
}
