/**
 * Google Ads Cache Service
 * Provides caching for campaigns, metrics, and aggregated data
 * 
 * Features:
 * - In-memory cache with TTL
 * - Automatic cache invalidation
 * - Cache statistics and monitoring
 * - Redis-ready architecture for future scaling
 */

import { GoogleAdsCampaign, GoogleAdsMetrics, AggregatedMetrics } from '@/lib/types/google-ads';

/**
 * Cache configuration
 */
export const CACHE_TTL = {
  campaigns: 5 * 60, // 5 minutes
  metrics: 15 * 60, // 15 minutes
  aggregated: 10 * 60, // 10 minutes
  connections: 30 * 60, // 30 minutes
  sync_status: 2 * 60 // 2 minutes
} as const;

/**
 * Cache entry with TTL
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  total_entries: number;
  total_hits: number;
  total_misses: number;
  hit_rate: number;
  memory_usage_mb: number;
  entries_by_type: Record<string, number>;
}

/**
 * Cache key builder
 */
export class CacheKeyBuilder {
  static campaigns(clientId: string, filters?: Record<string, any>): string {
    const filterStr = filters ? JSON.stringify(filters) : '';
    return `google:campaigns:${clientId}:${filterStr}`;
  }

  static campaignDetails(campaignId: string): string {
    return `google:campaign:${campaignId}`;
  }

  static metrics(campaignId: string, dateFrom: string, dateTo: string): string {
    return `google:metrics:${campaignId}:${dateFrom}:${dateTo}`;
  }

  static aggregatedMetrics(clientId: string, dateFrom: string, dateTo: string): string {
    return `google:aggregated:${clientId}:${dateFrom}:${dateTo}`;
  }

  static syncStatus(clientId: string): string {
    return `google:sync:${clientId}`;
  }

  static connection(clientId: string): string {
    return `google:connection:${clientId}`;
  }

  static unifiedMetrics(clientId: string, dateFrom: string, dateTo: string, platforms: string[]): string {
    const platformStr = platforms.sort().join(',');
    return `unified:metrics:${clientId}:${dateFrom}:${dateTo}:${platformStr}`;
  }
}

/**
 * Google Ads Cache Service
 * In-memory cache with TTL and statistics
 */
export class GoogleAdsCacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private stats = {
    hits: 0,
    misses: 0
  };

  /**
   * Get cached data
   * @param key Cache key
   * @returns Cached data or null if not found/expired
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update hit count
    entry.hits++;
    this.stats.hits++;
    
    return entry.data as T;
  }

  /**
   * Set cached data
   * @param key Cache key
   * @param data Data to cache
   * @param ttl TTL in seconds
   */
  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0
    };

    this.cache.set(key, entry);
  }

  /**
   * Delete cached data
   * @param key Cache key
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries matching pattern
   * @param pattern Pattern to match (supports wildcards)
   */
  async deletePattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let deletedCount = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    // Calculate memory usage (rough estimate)
    const memoryUsage = this.estimateMemoryUsage();

    // Count entries by type
    const entriesByType: Record<string, number> = {};
    for (const key of this.cache.keys()) {
      const type = key.split(':')[1] || 'unknown';
      entriesByType[type] = (entriesByType[type] || 0) + 1;
    }

    return {
      total_entries: this.cache.size,
      total_hits: this.stats.hits,
      total_misses: this.stats.misses,
      hit_rate: Number(hitRate.toFixed(3)),
      memory_usage_mb: Number(memoryUsage.toFixed(2)),
      entries_by_type: entriesByType
    };
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Estimate memory usage in MB
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Rough estimation: key size + JSON size of data
      totalSize += key.length * 2; // UTF-16 characters
      totalSize += JSON.stringify(entry.data).length * 2;
      totalSize += 64; // Overhead for entry metadata
    }

    return totalSize / (1024 * 1024); // Convert to MB
  }

  /**
   * Get cache entry info (for debugging)
   */
  async getEntryInfo(key: string): Promise<{
    exists: boolean;
    size_bytes?: number;
    ttl_remaining_seconds?: number;
    hits?: number;
    created_at?: Date;
  }> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return { exists: false };
    }

    const now = Date.now();
    const ageMs = now - entry.timestamp;
    const ttlRemainingMs = (entry.ttl * 1000) - ageMs;

    return {
      exists: true,
      size_bytes: JSON.stringify(entry.data).length * 2,
      ttl_remaining_seconds: Math.max(0, Math.floor(ttlRemainingMs / 1000)),
      hits: entry.hits,
      created_at: new Date(entry.timestamp)
    };
  }
}

/**
 * Specialized cache methods for Google Ads data
 */
export class GoogleAdsCache extends GoogleAdsCacheService {
  
  /**
   * Cache campaigns
   */
  async setCampaigns(clientId: string, campaigns: GoogleAdsCampaign[], filters?: Record<string, any>): Promise<void> {
    const key = CacheKeyBuilder.campaigns(clientId, filters);
    await this.set(key, campaigns, CACHE_TTL.campaigns);
  }

  /**
   * Get cached campaigns
   */
  async getCampaigns(clientId: string, filters?: Record<string, any>): Promise<GoogleAdsCampaign[] | null> {
    const key = CacheKeyBuilder.campaigns(clientId, filters);
    return await this.get<GoogleAdsCampaign[]>(key);
  }

  /**
   * Cache campaign details
   */
  async setCampaignDetails(campaignId: string, campaign: GoogleAdsCampaign): Promise<void> {
    const key = CacheKeyBuilder.campaignDetails(campaignId);
    await this.set(key, campaign, CACHE_TTL.campaigns);
  }

  /**
   * Get cached campaign details
   */
  async getCampaignDetails(campaignId: string): Promise<GoogleAdsCampaign | null> {
    const key = CacheKeyBuilder.campaignDetails(campaignId);
    return await this.get<GoogleAdsCampaign>(key);
  }

  /**
   * Cache metrics
   */
  async setMetrics(campaignId: string, dateFrom: string, dateTo: string, metrics: GoogleAdsMetrics[]): Promise<void> {
    const key = CacheKeyBuilder.metrics(campaignId, dateFrom, dateTo);
    await this.set(key, metrics, CACHE_TTL.metrics);
  }

  /**
   * Get cached metrics
   */
  async getMetrics(campaignId: string, dateFrom: string, dateTo: string): Promise<GoogleAdsMetrics[] | null> {
    const key = CacheKeyBuilder.metrics(campaignId, dateFrom, dateTo);
    return await this.get<GoogleAdsMetrics[]>(key);
  }

  /**
   * Cache aggregated metrics
   */
  async setAggregatedMetrics(clientId: string, dateFrom: string, dateTo: string, metrics: AggregatedMetrics): Promise<void> {
    const key = CacheKeyBuilder.aggregatedMetrics(clientId, dateFrom, dateTo);
    await this.set(key, metrics, CACHE_TTL.aggregated);
  }

  /**
   * Get cached aggregated metrics
   */
  async getAggregatedMetrics(clientId: string, dateFrom: string, dateTo: string): Promise<AggregatedMetrics | null> {
    const key = CacheKeyBuilder.aggregatedMetrics(clientId, dateFrom, dateTo);
    return await this.get<AggregatedMetrics>(key);
  }

  /**
   * Cache sync status
   */
  async setSyncStatus(clientId: string, status: any): Promise<void> {
    const key = CacheKeyBuilder.syncStatus(clientId);
    await this.set(key, status, CACHE_TTL.sync_status);
  }

  /**
   * Get cached sync status
   */
  async getSyncStatus(clientId: string): Promise<any | null> {
    const key = CacheKeyBuilder.syncStatus(clientId);
    return await this.get(key);
  }

  /**
   * Cache unified metrics (multi-platform)
   */
  async setUnifiedMetrics(
    clientId: string, 
    dateFrom: string, 
    dateTo: string, 
    platforms: string[], 
    metrics: any
  ): Promise<void> {
    const key = CacheKeyBuilder.unifiedMetrics(clientId, dateFrom, dateTo, platforms);
    await this.set(key, metrics, CACHE_TTL.aggregated);
  }

  /**
   * Get cached unified metrics
   */
  async getUnifiedMetrics(
    clientId: string, 
    dateFrom: string, 
    dateTo: string, 
    platforms: string[]
  ): Promise<any | null> {
    const key = CacheKeyBuilder.unifiedMetrics(clientId, dateFrom, dateTo, platforms);
    return await this.get(key);
  }

  /**
   * Invalidate all cache for a client
   */
  async invalidateClient(clientId: string): Promise<number> {
    const patterns = [
      `google:*:${clientId}:*`,
      `unified:*:${clientId}:*`
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.deletePattern(pattern);
    }

    return totalDeleted;
  }

  /**
   * Invalidate cache after sync
   */
  async invalidateAfterSync(clientId: string): Promise<void> {
    // Invalidate campaigns and metrics for this client
    await this.deletePattern(`google:campaigns:${clientId}:*`);
    await this.deletePattern(`google:metrics:*`);
    await this.deletePattern(`google:aggregated:${clientId}:*`);
    await this.deletePattern(`unified:*:${clientId}:*`);
    
    // Update sync status cache
    await this.delete(CacheKeyBuilder.syncStatus(clientId));
  }

  /**
   * Warm up cache with commonly accessed data
   */
  async warmUp(clientId: string, campaigns: GoogleAdsCampaign[]): Promise<void> {
    // Cache campaigns list
    await this.setCampaigns(clientId, campaigns);

    // Cache individual campaign details
    for (const campaign of campaigns) {
      await this.setCampaignDetails(campaign.id, campaign);
    }
  }
}

// Global cache instance
export const googleAdsCache = new GoogleAdsCache();

/**
 * Cache middleware for API responses
 */
export function withCache<T>(
  cacheKey: string,
  ttl: number,
  fetchFn: () => Promise<T>
): () => Promise<T> {
  return async (): Promise<T> => {
    // Try cache first
    const cached = await googleAdsCache.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Fetch and cache
    const data = await fetchFn();
    await googleAdsCache.set(cacheKey, data, ttl);
    
    return data;
  };
}

/**
 * Cache decorator for class methods
 */
export function Cached(ttl: number, keyBuilder?: (...args: any[]) => string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = keyBuilder 
        ? keyBuilder(...args)
        : `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;

      const cached = await googleAdsCache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      const result = await method.apply(this, args);
      await googleAdsCache.set(cacheKey, result, ttl);
      
      return result;
    };
  };
}