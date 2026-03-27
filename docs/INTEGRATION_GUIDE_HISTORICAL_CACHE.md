# Historical Data Cache Integration Guide

## Overview

This guide provides step-by-step instructions for integrating the Historical Data Cache system into your application. The system provides intelligent caching of advertising campaign data with plan-based limits and multi-platform support.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Setup](#setup)
3. [Basic Usage](#basic-usage)
4. [Advanced Features](#advanced-features)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Install Dependencies

The Historical Data Cache system is already integrated into the main application. No additional dependencies are required.

### 2. Configure Environment Variables

Ensure the following environment variables are set:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Ads Configuration (if using Google Ads)
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token

# Meta Ads Configuration (if using Meta Ads)
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret

# Cron Secret (for scheduled jobs)
CRON_SECRET=your_cron_secret
```

### 3. Run Database Migrations

Execute the historical data cache schema:

```bash
# Using Supabase SQL Editor
# Run: database/historical-data-cache-schema.sql
```

---

## Setup

### Step 1: Configure Plan Limits

Set up plan limits for your subscription tiers:

```typescript
import { planConfigurationService } from '@/lib/services/plan-configuration-service';

// Create limits for a plan
const limits = await planConfigurationService.createPlanLimits('plan-basic', {
  max_clients: 5,
  max_campaigns_per_client: 25,
  data_retention_days: 90,
  sync_interval_hours: 24,
  allow_csv_export: true,
  allow_json_export: false,
});

// Update existing limits
const updated = await planConfigurationService.updatePlanLimits('plan-pro', {
  max_clients: 20,
  data_retention_days: 180,
  sync_interval_hours: 12,
  allow_json_export: true,
});
```

### Step 2: Set Up Sync Configuration

Configure sync for a client:

```typescript
import { createClient } from '@/lib/supabase/server';

const supabase = await createClient();

// Create sync configuration for Meta Ads
const { data: metaConfig } = await supabase
  .from('sync_configurations')
  .insert({
    client_id: 'client-1',
    platform: 'meta',
    account_id: 'act_123456',
    access_token: 'user_access_token',
    refresh_token: 'refresh_token',
    sync_status: 'active',
  })
  .select()
  .single();

// Create sync configuration for Google Ads
const { data: googleConfig } = await supabase
  .from('sync_configurations')
  .insert({
    client_id: 'client-1',
    platform: 'google',
    account_id: '123-456-7890',
    access_token: 'user_access_token',
    refresh_token: 'refresh_token',
    sync_status: 'active',
  })
  .select()
  .single();
```

### Step 3: Configure Cron Jobs

Set up plataforma de deploy cron jobs in `deploy.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-scheduler",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/sync-executor",
      "schedule": "15 * * * *"
    },
    {
      "path": "/api/cron/data-cleanup",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/export-cleanup",
      "schedule": "0 3 * * *"
    }
  ]
}
```

---

## Basic Usage

### Checking Feature Gates

Before performing operations, check if the user has permission:

```typescript
import { cacheFeatureGate } from '@/lib/services/cache-feature-gate';

// Check if user can access 90 days of data
const retentionCheck = await cacheFeatureGate.checkDataRetention(userId, 90);
if (!retentionCheck.allowed) {
  console.error(retentionCheck.reason);
  return;
}

// Check if user can add more clients
const clientCheck = await cacheFeatureGate.checkClientLimit(userId);
if (!clientCheck.allowed) {
  console.error(clientCheck.reason);
  return;
}

// Check if user can export to CSV
const exportCheck = await cacheFeatureGate.checkExportPermission(userId, 'csv');
if (!exportCheck.allowed) {
  console.error(exportCheck.reason);
  return;
}
```

### Fetching Campaign Insights

Use the Hybrid Data Service to fetch insights:

```typescript
import { HybridDataService } from '@/lib/services/hybrid-data-service';
import { GoogleAdsSyncAdapter } from '@/lib/sync/google-ads-sync-adapter';

const service = new HybridDataService();

// Fetch insights (automatically uses cache or API based on date range)
const result = await service.getData({
  client_id: 'client-1',
  platform: 'google',
  date_from: new Date('2025-01-01'),
  date_to: new Date('2025-01-27'),
  campaign_ids: ['campaign-1', 'campaign-2'],
});

console.log('Data source:', result.source); // 'cache', 'api', or 'hybrid'
console.log('Insights:', result.data);
console.log('API status:', result.api_status);
console.log('Cache hit rate:', result.cache_hit_rate);
```

### Triggering Manual Sync

Manually trigger a sync for a client:

```typescript
import { MultiPlatformSyncEngine } from '@/lib/sync/multi-platform-sync-engine';

const syncEngine = new MultiPlatformSyncEngine();

// Sync Meta Ads data
const metaResult = await syncEngine.syncClient('client-1', 'meta');
console.log('Synced records:', metaResult.records_synced);

// Sync Google Ads data
const googleResult = await syncEngine.syncClient('client-1', 'google');
console.log('Synced records:', googleResult.records_synced);
```

### Exporting Data

Export campaign insights to CSV or JSON:

```typescript
import { ExportService } from '@/lib/services/export-service';

const exportService = new ExportService();

// Export to CSV
const csvExport = await exportService.exportToCSV({
  userId: 'user-1',
  clientId: 'client-1',
  platform: 'meta',
  dateFrom: new Date('2025-01-01'),
  dateTo: new Date('2025-01-27'),
  campaignIds: ['campaign-1', 'campaign-2'],
});

console.log('Export ID:', csvExport.exportId);
console.log('Download URL:', `/api/exports/${csvExport.exportId}/download`);
```

---

## Advanced Features

### Custom Sync Adapters

Create a custom sync adapter for a new platform:

```typescript
import { BaseSyncAdapter, AuthCredentials } from '@/lib/sync/base-sync-adapter';
import { AdPlatform, Campaign, CampaignInsight, DateRange } from '@/lib/types/sync';

export class CustomPlatformAdapter extends BaseSyncAdapter {
  readonly platform = 'custom' as AdPlatform;

  async authenticate(credentials: AuthCredentials): Promise<void> {
    // Implement authentication logic
  }

  async fetchCampaigns(accountId: string): Promise<Campaign[]> {
    // Implement campaign fetching
  }

  async fetchInsights(
    campaignId: string,
    dateRange: DateRange
  ): Promise<CampaignInsight[]> {
    // Implement insights fetching
  }

  protected normalizePlatformData(platformData: any): Omit<CampaignInsight, 'ctr' | 'cpc' | 'cpm' | 'conversion_rate'> {
    // Normalize platform-specific data to universal format
    return {
      id: platformData.id,
      platform: this.platform,
      client_id: this.config.client_id,
      campaign_id: platformData.campaign_id,
      campaign_name: platformData.campaign_name,
      date: new Date(platformData.date),
      impressions: platformData.impressions,
      clicks: platformData.clicks,
      spend: platformData.spend,
      conversions: platformData.conversions,
      is_deleted: false,
      synced_at: new Date(),
    };
  }
}
```

### Proactive Health Checks

Use health checks before fetching data:

```typescript
import { HybridDataService } from '@/lib/services/hybrid-data-service';

const service = new HybridDataService();

// Check API health before fetching
const result = await service.getDataWithHealthCheck(
  {
    client_id: 'client-1',
    platform: 'google',
    date_from: new Date('2025-01-20'),
    date_to: new Date('2025-01-27'),
  },
  adapter,
  false // Set to true to force cache-only mode
);

if (result.fallback_used) {
  console.warn('API unavailable, using cached data');
}
```

### Batch Operations

Process multiple clients concurrently:

```typescript
import { MultiPlatformSyncEngine } from '@/lib/sync/multi-platform-sync-engine';

const syncEngine = new MultiPlatformSyncEngine();

const clientIds = ['client-1', 'client-2', 'client-3'];

// Sync all clients concurrently
const results = await Promise.all(
  clientIds.map(clientId => 
    syncEngine.syncClient(clientId, 'meta')
  )
);

results.forEach((result, index) => {
  console.log(`Client ${clientIds[index]}: ${result.records_synced} records synced`);
});
```

### Data Validation

Validate data freshness before using:

```typescript
import { HybridDataService } from '@/lib/services/hybrid-data-service';

const service = new HybridDataService();

// Fetch data
const result = await service.getData(query);

// Validate freshness
const validation = await service.validateDataFreshness(result.data, 24);

if (!validation.is_fresh) {
  console.warn(`Data is ${validation.age_hours} hours old, refreshing...`);
  await service.refreshRecentData(clientId, platform, adapter);
}
```

---

## Best Practices

### 1. Always Check Limits First

```typescript
// âŒ Bad: Fetch data without checking limits
const data = await service.getData(query);

// âœ… Good: Check limits before fetching
const retentionCheck = await cacheFeatureGate.checkDataRetention(
  userId,
  calculateDaysBetween(query.date_from, query.date_to)
);

if (!retentionCheck.allowed) {
  throw new Error(retentionCheck.reason);
}

const data = await service.getData(query);
```

### 2. Handle Fallback Scenarios

```typescript
// âœ… Good: Handle API failures gracefully
const result = await service.getData(query, adapter);

if (result.fallback_used) {
  // Notify user that data might be slightly outdated
  showWarning('Using cached data due to API unavailability');
}

if (result.api_status === 'failed') {
  // Log error for monitoring
  logError('API fetch failed', result.error_message);
}
```

### 3. Optimize Date Ranges

```typescript
// âŒ Bad: Always fetch maximum range
const data = await service.getData({
  client_id: 'client-1',
  date_from: new Date('2024-01-01'),
  date_to: new Date(),
});

// âœ… Good: Fetch only what's needed
const data = await service.getData({
  client_id: 'client-1',
  date_from: new Date('2025-01-20'), // Last 7 days
  date_to: new Date(),
});
```

### 4. Use Campaign Filters

```typescript
// âŒ Bad: Fetch all campaigns
const data = await service.getData({
  client_id: 'client-1',
  date_from: startDate,
  date_to: endDate,
});

// âœ… Good: Filter to specific campaigns
const data = await service.getData({
  client_id: 'client-1',
  date_from: startDate,
  date_to: endDate,
  campaign_ids: ['campaign-1', 'campaign-2'], // Only fetch needed campaigns
});
```

### 5. Implement Retry Logic

```typescript
// âœ… Good: Retry with exponential backoff
async function fetchWithRetry(query: DataQuery, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await service.getData(query, adapter);
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### 6. Monitor Performance

```typescript
// âœ… Good: Track performance metrics
const startTime = performance.now();
const result = await service.getData(query);
const duration = performance.now() - startTime;

// Log slow queries
if (duration > 2000) {
  console.warn(`Slow query detected: ${duration}ms`, {
    client_id: query.client_id,
    date_range: `${query.date_from} to ${query.date_to}`,
    record_count: result.data.length,
  });
}
```

---

## Troubleshooting

### Issue: Sync Failing with 401 Error

**Cause:** Access token expired

**Solution:**
```typescript
// Check token expiration
const config = await getSyncConfig(clientId, platform);

if (config.token_expires_at && new Date(config.token_expires_at) < new Date()) {
  // Token expired, refresh it
  await refreshAccessToken(config);
}
```

### Issue: Data Not Appearing in Cache

**Cause:** Sync not running or failing

**Solution:**
```typescript
// Check sync status
const { data: syncLogs } = await supabase
  .from('sync_logs')
  .select('*')
  .eq('sync_config_id', configId)
  .order('started_at', { ascending: false })
  .limit(10);

// Check for errors
const failedSyncs = syncLogs.filter(log => log.status === 'failed');
if (failedSyncs.length > 0) {
  console.error('Recent sync failures:', failedSyncs);
}
```

### Issue: Slow Query Performance

**Cause:** Large date range or too many campaigns

**Solution:**
```typescript
// Break large queries into smaller chunks
async function fetchInChunks(query: DataQuery, chunkDays = 30) {
  const chunks = [];
  let currentStart = query.date_from;
  
  while (currentStart < query.date_to) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + chunkDays);
    
    chunks.push({
      ...query,
      date_from: currentStart,
      date_to: currentEnd > query.date_to ? query.date_to : currentEnd,
    });
    
    currentStart = currentEnd;
  }
  
  const results = await Promise.all(
    chunks.map(chunk => service.getData(chunk))
  );
  
  return results.flatMap(r => r.data);
}
```

### Issue: Export Not Completing

**Cause:** Large dataset or timeout

**Solution:**
```typescript
// Check export status
const { data: exportStatus } = await supabase
  .from('exports')
  .select('*')
  .eq('id', exportId)
  .single();

if (exportStatus.status === 'failed') {
  console.error('Export failed:', exportStatus.error_message);
  
  // Retry with smaller date range
  const smallerExport = await exportService.exportToCSV({
    ...originalQuery,
    dateTo: new Date(originalQuery.dateFrom.getTime() + 30 * 24 * 60 * 60 * 1000),
  });
}
```

### Issue: Rate Limit Exceeded

**Cause:** Too many API requests

**Solution:**
```typescript
// Implement request throttling
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private requestsPerMinute = 50;
  private interval = 60000 / this.requestsPerMinute;

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.processing) {
        this.process();
      }
    });
  }

  private async process() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const fn = this.queue.shift();
      if (fn) {
        await fn();
        await new Promise(resolve => setTimeout(resolve, this.interval));
      }
    }
    
    this.processing = false;
  }
}

const rateLimiter = new RateLimiter();

// Use rate limiter for API calls
const result = await rateLimiter.add(() => service.getData(query, adapter));
```

---

## Examples

### Complete Integration Example

```typescript
import { HybridDataService } from '@/lib/services/hybrid-data-service';
import { cacheFeatureGate } from '@/lib/services/cache-feature-gate';
import { GoogleAdsSyncAdapter } from '@/lib/sync/google-ads-sync-adapter';

async function fetchCampaignInsights(
  userId: string,
  clientId: string,
  dateFrom: Date,
  dateTo: Date
) {
  // 1. Check data retention limit
  const daysDiff = Math.ceil(
    (dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  const retentionCheck = await cacheFeatureGate.checkDataRetention(userId, daysDiff);
  if (!retentionCheck.allowed) {
    throw new Error(retentionCheck.reason);
  }

  // 2. Get sync configuration
  const supabase = await createClient();
  const { data: syncConfig } = await supabase
    .from('sync_configurations')
    .select('*')
    .eq('client_id', clientId)
    .eq('platform', 'google')
    .single();

  if (!syncConfig) {
    throw new Error('Sync configuration not found');
  }

  // 3. Create adapter
  const adapter = new GoogleAdsSyncAdapter(
    syncConfig,
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN!
  );

  // 4. Fetch data with health check
  const service = new HybridDataService();
  const result = await service.getDataWithHealthCheck(
    {
      client_id: clientId,
      platform: 'google',
      date_from: dateFrom,
      date_to: dateTo,
    },
    adapter
  );

  // 5. Validate freshness
  const validation = await service.validateDataFreshness(result.data, 24);
  if (!validation.is_fresh) {
    console.warn(`Data is ${validation.age_hours} hours old`);
  }

  // 6. Return results with metadata
  return {
    insights: result.data,
    metadata: {
      source: result.source,
      apiStatus: result.api_status,
      cacheHitRate: result.cache_hit_rate,
      fallbackUsed: result.fallback_used,
      dataFreshness: validation,
    },
  };
}
```

---

## Support

For additional help:

- API Documentation: `/docs/API_HISTORICAL_DATA_CACHE.md`
- Code Examples: `/docs/examples/`
- GitHub Issues: [Report an issue](https://github.com/your-repo/issues)

---

**Last Updated:** January 27, 2025  
**Version:** 1.0.0

