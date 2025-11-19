/**
 * Google Ads Sync Adapter
 * Implements sync functionality for Google Ads platform
 */

import {
  AdPlatform,
  Campaign,
  CampaignInsight,
  DateRange,
  SyncConfig
} from '@/lib/types/sync';
import { BaseSyncAdapter, AuthCredentials } from './base-sync-adapter';
import { googleAdsErrorHandler } from './google-ads-error-handler';

/**
 * Google Ads specific credentials
 */
export interface GoogleAdsCredentials extends AuthCredentials {
  access_token: string;
  refresh_token?: string;
  client_id?: string;
  client_secret?: string;
}

/**
 * Google Ads API response types
 */
interface GoogleAdsCampaign {
  resourceName: string;
  id: string;
  name: string;
  status: string;
  advertisingChannelType?: string;
}

interface GoogleAdsMetrics {
  impressions: string;
  clicks: string;
  costMicros: string;
  conversions: number;
}

interface GoogleAdsInsight {
  campaign: {
    resourceName: string;
    id: string;
    name: string;
  };
  segments: {
    date: string;
  };
  metrics: GoogleAdsMetrics;
}

/**
 * Google Ads Sync Adapter
 * Handles OAuth 2.0 authentication and data synchronization with Google Ads API
 */
export class GoogleAdsSyncAdapter extends BaseSyncAdapter {
  readonly platform = AdPlatform.GOOGLE;

  private readonly API_VERSION = 'v22';
  private readonly BASE_URL = 'https://googleads.googleapis.com';
  private readonly TOKEN_URL = 'https://oauth2.googleapis.com/token';
  
  private developerToken: string;
  private customerId: string;

  constructor(config: SyncConfig, developerToken: string) {
    super(config);
    this.developerToken = developerToken;
    this.customerId = config.account_id.replace(/-/g, ''); // Remove dashes
  }

  /**
   * Authenticate with Google Ads API using OAuth 2.0
   */
  async authenticate(credentials: GoogleAdsCredentials): Promise<void> {
    await googleAdsErrorHandler.executeWithRetry(async () => {
      // Check if token needs refresh
      if (this.config.token_expires_at) {
        const now = new Date();
        const expiresAt = new Date(this.config.token_expires_at);
        
        // If token expires in less than 5 minutes, refresh it
        if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
          await this.refreshToken(credentials);
          return;
        }
      }

      // Validate current token
      await this.validateToken(credentials.access_token);
    }, 'Authentication');
  }

  /**
   * Validate access token by making a test API call
   */
  private async validateToken(accessToken: string): Promise<void> {
    const url = `${this.BASE_URL}/${this.API_VERSION}/customers/${this.customerId}/googleAds:search`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': this.developerToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'SELECT customer.id FROM customer LIMIT 1'
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid or expired access token');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Token validation failed: ${errorData.error?.message || response.statusText}`
      );
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshToken(credentials: GoogleAdsCredentials): Promise<void> {
    if (!credentials.refresh_token || !credentials.client_id || !credentials.client_secret) {
      throw new Error('Missing refresh token or OAuth credentials');
    }

    const response = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
        refresh_token: credentials.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Token refresh failed: ${errorData.error_description || response.statusText}`
      );
    }

    const data = await response.json();
    
    // Update config with new token
    this.config.access_token = data.access_token;
    this.config.token_expires_at = new Date(Date.now() + data.expires_in * 1000);
  }

  /**
   * Fetch all campaigns for the configured account
   */
  async fetchCampaigns(accountId: string): Promise<Campaign[]> {
    return googleAdsErrorHandler.executeWithRetry(async () => {
      const customerId = accountId.replace(/-/g, '');
      const url = `${this.BASE_URL}/${this.API_VERSION}/customers/${customerId}/googleAds:search`;

      const query = `
        SELECT 
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.advertising_channel_type
        FROM campaign
        WHERE campaign.status != 'REMOVED'
        ORDER BY campaign.name
      `;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.access_token}`,
          'developer-token': this.developerToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const parsedError = googleAdsErrorHandler.parseError(error, response.status);
        googleAdsErrorHandler.logError(parsedError, 'Fetch campaigns');
        throw parsedError;
      }

      const data = await response.json();
      const results = data.results || [];

      return results.map((result: any) => ({
        id: result.campaign.id,
        name: result.campaign.name,
        status: result.campaign.status,
        platform: AdPlatform.GOOGLE,
        account_id: accountId
      }));
    }, 'Fetch campaigns');
  }

  /**
   * Fetch insights for a specific campaign
   */
  async fetchInsights(
    campaignId: string,
    dateRange: DateRange
  ): Promise<CampaignInsight[]> {
    return googleAdsErrorHandler.executeWithRetry(async () => {
      const url = `${this.BASE_URL}/${this.API_VERSION}/customers/${this.customerId}/googleAds:search`;

      const startDate = this.formatDate(dateRange.start);
      const endDate = this.formatDate(dateRange.end);

      const query = `
        SELECT 
          campaign.id,
          campaign.name,
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM campaign
        WHERE campaign.id = ${campaignId}
          AND segments.date BETWEEN '${startDate}' AND '${endDate}'
        ORDER BY segments.date DESC
      `;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.access_token}`,
          'developer-token': this.developerToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const parsedError = googleAdsErrorHandler.parseError(error, response.status);
        
        // Handle token expiration
        if (googleAdsErrorHandler.requiresReauth(parsedError)) {
          await googleAdsErrorHandler.handleTokenExpiration(
            () => this.refreshAccessToken()
          );
          // Retry with new token
          throw parsedError;
        }
        
        googleAdsErrorHandler.logError(parsedError, 'Fetch insights');
        throw parsedError;
      }

      const data = await response.json();
      const results = data.results || [];

      // Apply rate limiting
      await this.sleep(this.getRateLimitDelay());

      return results.map((result: GoogleAdsInsight) => {
        const normalized = this.normalizePlatformData(result);
        return this.calculateMetrics(normalized);
      });
    }, 'Fetch insights');
  }

  /**
   * Normalize Google Ads data to universal format
   */
  protected normalizePlatformData(
    platformData: GoogleAdsInsight
  ): Omit<CampaignInsight, 'ctr' | 'cpc' | 'cpm' | 'conversion_rate'> {
    const metrics = platformData.metrics;
    
    return {
      id: `${platformData.campaign.id}_${platformData.segments.date}`,
      platform: AdPlatform.GOOGLE,
      client_id: this.config.client_id,
      campaign_id: platformData.campaign.id,
      campaign_name: platformData.campaign.name,
      date: new Date(platformData.segments.date),
      impressions: parseInt(metrics.impressions) || 0,
      clicks: parseInt(metrics.clicks) || 0,
      spend: parseFloat(metrics.costMicros) / 1000000 || 0, // Convert micros to currency
      conversions: metrics.conversions || 0,
      is_deleted: false,
      synced_at: new Date()
    };
  }

  /**
   * Handle API errors with Google Ads specific logic
   */
  private async handleApiError(response: Response, context: string): Promise<never> {
    const errorData = await response.json().catch(() => ({}));
    
    // Handle specific Google Ads error codes
    if (response.status === 401) {
      throw new Error('Authentication failed - token may be expired');
    }
    
    if (response.status === 429) {
      throw new Error('Rate limit exceeded - please retry later');
    }
    
    if (response.status === 403) {
      throw new Error('Access denied - check API permissions');
    }

    const errorMessage = errorData.error?.message || response.statusText;
    throw new Error(`${context}: ${errorMessage}`);
  }

  /**
   * Format date for Google Ads API (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get Google Ads specific rate limit delay
   * Google Ads has stricter rate limits than Meta
   */
  protected getRateLimitDelay(): number {
    return 200; // 200ms between requests
  }

  /**
   * Refresh access token (override base implementation)
   */
  protected async refreshAccessToken(): Promise<string> {
    if (!this.config.refresh_token) {
      throw new Error('No refresh token available');
    }

    // Get OAuth credentials from environment
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Missing Google OAuth credentials in environment');
    }

    await this.refreshToken({
      access_token: this.config.access_token,
      refresh_token: this.config.refresh_token,
      client_id: clientId,
      client_secret: clientSecret
    });

    return this.config.access_token;
  }
}
