/**
 * Base Sync Adapter
 * Abstract class for implementing platform-specific sync adapters
 */

import {
  AdPlatform,
  Campaign,
  CampaignInsight,
  DateRange,
  SyncConfig,
  ValidationResult
} from '@/lib/types/sync';

/**
 * Authentication credentials (platform-specific)
 */
export interface AuthCredentials {
  [key: string]: any;
}

/**
 * Abstract base class for all sync adapters
 * Each platform (Meta, Google) must extend this class
 */
export abstract class BaseSyncAdapter {
  /**
   * Platform identifier
   */
  abstract readonly platform: AdPlatform;

  /**
   * Sync configuration
   */
  protected config: SyncConfig;

  constructor(config: SyncConfig) {
    this.config = config;
  }

  /**
   * Authenticate with the platform's API
   * @param credentials Platform-specific authentication credentials
   * @throws Error if authentication fails
   */
  abstract authenticate(credentials: AuthCredentials): Promise<void>;

  /**
   * Fetch all campaigns for the configured account
   * @param accountId Platform-specific account ID
   * @returns Array of campaigns
   * @throws Error if fetch fails
   */
  abstract fetchCampaigns(accountId: string): Promise<Campaign[]>;

  /**
   * Fetch insights for a specific campaign
   * @param campaignId Platform-specific campaign ID
   * @param dateRange Date range for insights
   * @returns Array of campaign insights
   * @throws Error if fetch fails
   */
  abstract fetchInsights(
    campaignId: string,
    dateRange: DateRange
  ): Promise<CampaignInsight[]>;

  /**
   * Validate connection to the platform
   * Tests if credentials are valid and API is accessible
   * @returns Validation result
   */
  async validateConnection(): Promise<ValidationResult> {
    try {
      // Attempt to authenticate
      await this.authenticate({
        access_token: this.config.access_token,
        refresh_token: this.config.refresh_token
      });

      // Try to fetch campaigns as a connection test
      await this.fetchCampaigns(this.config.account_id);

      return {
        valid: true
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          error instanceof Error 
            ? error.message 
            : 'Unknown connection error'
        ]
      };
    }
  }

  /**
   * Handle API errors with platform-specific logic
   * @param error The error to handle
   * @throws Formatted error with context
   */
  protected handleError(error: unknown, context: string): never {
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error';
    
    throw new Error(
      `[${this.platform.toUpperCase()}] ${context}: ${errorMessage}`
    );
  }

  /**
   * Calculate derived metrics from raw data
   * @param insight Raw insight data
   * @returns Insight with calculated metrics
   */
  protected calculateMetrics(
    insight: Omit<CampaignInsight, 'ctr' | 'cpc' | 'cpm' | 'conversion_rate'>
  ): CampaignInsight {
    const ctr = insight.impressions > 0 
      ? (insight.clicks / insight.impressions) * 100 
      : 0;
    
    const cpc = insight.clicks > 0 
      ? insight.spend / insight.clicks 
      : 0;
    
    const cpm = insight.impressions > 0 
      ? (insight.spend / insight.impressions) * 1000 
      : 0;
    
    const conversion_rate = insight.clicks > 0 
      ? (insight.conversions / insight.clicks) * 100 
      : 0;

    return {
      ...insight,
      ctr: Number(ctr.toFixed(2)),
      cpc: Number(cpc.toFixed(2)),
      cpm: Number(cpm.toFixed(2)),
      conversion_rate: Number(conversion_rate.toFixed(2))
    };
  }

  /**
   * Refresh access token if expired
   * @returns New access token
   * @throws Error if refresh fails
   */
  protected async refreshAccessToken(): Promise<string> {
    if (!this.config.refresh_token) {
      throw new Error('No refresh token available');
    }

    if (!this.config.token_expires_at) {
      // Token expiration not tracked, assume valid
      return this.config.access_token;
    }

    const now = new Date();
    const expiresAt = new Date(this.config.token_expires_at);

    // Check if token is expired or will expire in next 5 minutes
    if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
      // Token still valid
      return this.config.access_token;
    }

    // Token expired or expiring soon - subclass must implement refresh
    throw new Error('Token refresh must be implemented by platform adapter');
  }

  /**
   * Normalize platform-specific data to universal format
   * @param platformData Platform-specific data
   * @returns Normalized campaign insight
   */
  protected abstract normalizePlatformData(
    platformData: any
  ): Omit<CampaignInsight, 'ctr' | 'cpc' | 'cpm' | 'conversion_rate'>;

  /**
   * Get platform-specific rate limit delay
   * @returns Delay in milliseconds
   */
  protected getRateLimitDelay(): number {
    // Default: 100ms between requests
    // Subclasses can override for platform-specific limits
    return 100;
  }

  /**
   * Sleep for specified milliseconds
   * @param ms Milliseconds to sleep
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
