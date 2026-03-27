/**
 * Meta Ads Sync Adapter
 * Implements sync functionality for Meta Ads platform
 */

import {
  AdPlatform,
  Campaign,
  CampaignInsight,
  DateRange,
  SyncConfig
} from '@/lib/types/sync';
import { AuthCredentials, BaseSyncAdapter } from './base-sync-adapter';
import {
  metaAdsErrorHandler,
  MetaAdsError,
  MetaAdsErrorType
} from './meta-ads-error-handler';
import { metaTokenManager } from './meta-token-manager';

export interface MetaAdsCredentials extends AuthCredentials {
  access_token: string;
  refresh_token?: string;
}

interface MetaCampaignRecord {
  id: string;
  name: string;
  status: string;
}

interface MetaInsightAction {
  action_type: string;
  value: string | number;
}

interface MetaInsightRecord {
  campaign_id: string;
  campaign_name?: string;
  date_start: string;
  date_stop: string;
  impressions: string;
  clicks: string;
  spend: string;
  actions?: MetaInsightAction[];
}

interface MetaApiResponse<T> {
  data?: T[];
  paging?: {
    next?: string;
  };
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    is_transient?: boolean;
  };
}

export class MetaAdsSyncAdapter extends BaseSyncAdapter {
  readonly platform = AdPlatform.META;

  private readonly API_VERSION = 'v22.0';
  private readonly BASE_URL = 'https://graph.facebook.com';

  constructor(config: SyncConfig) {
    super(config);
  }

  async authenticate(credentials: MetaAdsCredentials): Promise<void> {
    const accessToken =
      metaTokenManager.decryptToken(credentials.access_token) ||
      credentials.access_token;
    const refreshToken = metaTokenManager.decryptToken(credentials.refresh_token);

    this.config.access_token = accessToken;
    if (refreshToken) {
      this.config.refresh_token = refreshToken;
    }

    if (metaTokenManager.isTokenExpired(this.config.token_expires_at)) {
      await this.refreshAndPersistToken(
        this.config.refresh_token || this.config.access_token
      );
    }

    try {
      await this.validateToken(this.config.access_token);
    } catch (error) {
      const parsedError = metaAdsErrorHandler.parseError(
        error,
        this.readStatusCode(error)
      );

      if (
        metaAdsErrorHandler.requiresReauth(parsedError) &&
        (this.config.refresh_token || this.config.access_token)
      ) {
        await this.refreshAndPersistToken(
          this.config.refresh_token || this.config.access_token
        );
        await this.validateToken(this.config.access_token);
        return;
      }

      throw error;
    }
  }

  async fetchCampaigns(accountId: string): Promise<Campaign[]> {
    const normalizedAccountId = this.normalizeAccountId(accountId);

    const campaigns = await metaAdsErrorHandler.executeWithRetry(async () => {
      return this.fetchPaginated<MetaCampaignRecord>(
        '/' + normalizedAccountId + '/campaigns',
        {
          fields: 'id,name,status',
          limit: '200'
        }
      );
    }, 'Fetch campaigns');

    return campaigns.map(campaign => ({
      id: campaign.id,
      name: campaign.name || 'Unnamed campaign',
      status: campaign.status || 'UNKNOWN',
      platform: AdPlatform.META,
      account_id: normalizedAccountId
    }));
  }

  async fetchInsights(
    campaignId: string,
    dateRange: DateRange
  ): Promise<CampaignInsight[]> {
    const timeRange = JSON.stringify({
      since: this.formatDate(dateRange.start),
      until: this.formatDate(dateRange.end)
    });

    const insights = await metaAdsErrorHandler.executeWithRetry(async () => {
      return this.fetchPaginated<MetaInsightRecord>(
        '/' + campaignId + '/insights',
        {
          fields:
            'campaign_id,campaign_name,date_start,date_stop,impressions,clicks,spend,actions',
          time_range: timeRange,
          time_increment: '1',
          level: 'campaign',
          limit: '500'
        }
      );
    }, 'Fetch insights');

    await this.sleep(this.getRateLimitDelay());

    return insights.map(insight => {
      const normalized = this.normalizePlatformData(insight);
      return this.calculateMetrics(normalized);
    });
  }

  protected normalizePlatformData(
    platformData: MetaInsightRecord
  ): Omit<CampaignInsight, 'ctr' | 'cpc' | 'cpm' | 'conversion_rate'> {
    const conversions = this.extractConversions(platformData.actions);

    return {
      id: platformData.campaign_id + '_' + platformData.date_start,
      platform: AdPlatform.META,
      client_id: this.config.client_id,
      campaign_id: platformData.campaign_id,
      campaign_name: platformData.campaign_name || 'Unnamed campaign',
      date: new Date(platformData.date_stop || platformData.date_start),
      impressions: parseInt(platformData.impressions || '0', 10) || 0,
      clicks: parseInt(platformData.clicks || '0', 10) || 0,
      spend: parseFloat(platformData.spend || '0') || 0,
      conversions,
      is_deleted: false,
      synced_at: new Date()
    };
  }

  protected getRateLimitDelay(): number {
    return 150;
  }

  private async validateToken(accessToken: string): Promise<void> {
    const data = await this.makeRequest<{ id: string }>('/me', {
      fields: 'id',
      access_token: accessToken
    });

    if (!data || !data.id) {
      throw new Error('Meta token validation failed');
    }
  }

  private async refreshAndPersistToken(exchangeToken: string): Promise<void> {
    const refreshed = await metaTokenManager.refreshAccessToken(exchangeToken);
    this.config.access_token = refreshed.access_token;
    this.config.token_expires_at = refreshed.expires_at;

    try {
      await metaTokenManager.persistTokens(
        this.config.id,
        refreshed.access_token,
        this.config.refresh_token,
        refreshed.expires_at
      );
    } catch (error) {
      console.warn(
        '[MetaAdsSyncAdapter] Token refreshed but persistence failed:',
        error
      );
    }
  }

  private async fetchPaginated<T>(
    path: string,
    params: Record<string, string>
  ): Promise<T[]> {
    const firstPage = await this.makeRequest<MetaApiResponse<T>>(path, params);
    const items: T[] = [...(firstPage.data || [])];
    let nextUrl = firstPage.paging?.next;
    let pageCount = 1;

    while (nextUrl && pageCount < 20) {
      const nextPage = await this.makeRequestByUrl<MetaApiResponse<T>>(nextUrl);
      items.push(...(nextPage.data || []));
      nextUrl = nextPage.paging?.next;
      pageCount++;
    }

    return items;
  }

  private async makeRequest<T>(
    path: string,
    params: Record<string, string>
  ): Promise<T> {
    const url = new URL(this.BASE_URL + '/' + this.API_VERSION + path);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    if (!url.searchParams.has('access_token')) {
      url.searchParams.set('access_token', this.config.access_token);
    }

    return this.makeRequestByUrl<T>(url.toString());
  }

  private async makeRequestByUrl<T>(url: string): Promise<T> {
    const response = await fetch(url);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.error) {
      const parsedError = metaAdsErrorHandler.parseError(payload, response.status);
      metaAdsErrorHandler.logError(parsedError, 'Meta API request');
      throw this.toThrowError(parsedError, response.status);
    }

    return payload as T;
  }

  private toThrowError(error: MetaAdsError, status: number): Error {
    const throwError = new Error(error.message);
    (throwError as Error & { status?: number }).status = status;
    (throwError as Error & { code?: string }).code = error.code;
    (throwError as Error & { type?: MetaAdsErrorType }).type = error.type;
    return throwError;
  }

  private extractConversions(actions?: MetaInsightAction[]): number {
    if (!actions || actions.length === 0) {
      return 0;
    }

    const conversionActionTypes = new Set([
      'purchase',
      'omni_purchase',
      'lead',
      'onsite_conversion.lead_grouped',
      'complete_registration'
    ]);

    return actions
      .filter(action => conversionActionTypes.has(action.action_type))
      .reduce((sum, action) => {
        const value =
          typeof action.value === 'number'
            ? action.value
            : parseFloat(action.value || '0');
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);
  }

  private normalizeAccountId(accountId: string): string {
    return accountId.startsWith('act_') ? accountId : 'act_' + accountId;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private readStatusCode(error: unknown): number | undefined {
    if (typeof error === 'object' && error !== null) {
      const status = (error as { status?: unknown }).status;
      if (typeof status === 'number') {
        return status;
      }
    }

    return undefined;
  }
}
