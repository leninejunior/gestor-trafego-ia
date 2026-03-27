/**
 * Meta Token Manager
 * Handles token encryption, expiration checks and refresh for Meta API
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';

export interface RefreshTokenResult {
  access_token: string;
  expires_in: number;
  expires_at: Date;
}

export class MetaTokenManager {
  private readonly TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;
  private readonly API_VERSION = 'v22.0';

  encryptToken(token: string): string {
    const key = this.resolveEncryptionKey();
    if (!key) {
      return token;
    }

    try {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);

      const encryptedPart = Buffer.concat([
        cipher.update(token, 'utf8'),
        cipher.final()
      ]);

      const authTag = cipher.getAuthTag();

      return [
        'enc',
        'v1',
        iv.toString('hex'),
        authTag.toString('hex'),
        encryptedPart.toString('hex')
      ].join(':');
    } catch (error) {
      console.warn('[MetaTokenManager] Failed to encrypt token, storing as plain text');
      return token;
    }
  }

  decryptToken(storedToken?: string | null): string | undefined {
    if (!storedToken) {
      return undefined;
    }

    if (!storedToken.startsWith('enc:v1:')) {
      return storedToken;
    }

    const key = this.resolveEncryptionKey();
    if (!key) {
      return storedToken;
    }

    const parts = storedToken.split(':');
    if (parts.length !== 5) {
      return storedToken;
    }

    try {
      const [, , ivHex, tagHex, encryptedHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(tagHex, 'hex');
      const encrypted = Buffer.from(encryptedHex, 'hex');

      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      console.warn('[MetaTokenManager] Failed to decrypt token, falling back to raw value');
      return storedToken;
    }
  }

  isTokenExpired(tokenExpiresAt?: Date): boolean {
    if (!tokenExpiresAt) {
      return false;
    }

    return tokenExpiresAt.getTime() - Date.now() < this.TOKEN_REFRESH_THRESHOLD_MS;
  }

  async refreshAccessToken(exchangeToken: string): Promise<RefreshTokenResult> {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error('Missing META_APP_ID or META_APP_SECRET for token refresh');
    }

    const url = new URL(
      'https://graph.facebook.com/' + this.API_VERSION + '/oauth/access_token'
    );
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', appId);
    url.searchParams.set('client_secret', appSecret);
    url.searchParams.set('fb_exchange_token', exchangeToken);

    const response = await fetch(url.toString());

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        payload?.error?.message ||
        payload?.message ||
        response.statusText ||
        'Token refresh failed';
      throw new Error(message);
    }

    const expiresIn =
      typeof payload.expires_in === 'number' ? payload.expires_in : 60 * 24 * 60 * 60;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    if (!payload.access_token || typeof payload.access_token !== 'string') {
      throw new Error('Meta token refresh returned invalid access_token');
    }

    return {
      access_token: payload.access_token,
      expires_in: expiresIn,
      expires_at: expiresAt
    };
  }

  async persistTokens(
    configId: string,
    accessToken: string,
    refreshToken?: string,
    tokenExpiresAt?: Date
  ): Promise<void> {
    const supabase = await createClient();

    const updates: {
      access_token: string;
      refresh_token?: string;
      token_expires_at?: string;
      updated_at: string;
    } = {
      access_token: this.encryptToken(accessToken),
      updated_at: new Date().toISOString()
    };

    if (refreshToken) {
      updates.refresh_token = this.encryptToken(refreshToken);
    }

    if (tokenExpiresAt) {
      updates.token_expires_at = tokenExpiresAt.toISOString();
    }

    const { error } = await supabase
      .from('sync_configurations')
      .update(updates)
      .eq('id', configId);

    if (error) {
      throw new Error('Failed to persist Meta tokens: ' + error.message);
    }
  }

  private resolveEncryptionKey(): Buffer | null {
    const keySource =
      process.env.META_TOKEN_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEY;

    if (!keySource) {
      return null;
    }

    if (/^[0-9a-fA-F]{64}$/.test(keySource)) {
      return Buffer.from(keySource, 'hex');
    }

    try {
      const base64Key = Buffer.from(keySource, 'base64');
      if (base64Key.length === 32) {
        return base64Key;
      }
    } catch (error) {
      // noop: fallback to hash
    }

    return createHash('sha256').update(keySource).digest();
  }
}

export const metaTokenManager = new MetaTokenManager();
