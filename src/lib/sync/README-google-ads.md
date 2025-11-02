# Google Ads Sync Adapter

Implementation of the Google Ads synchronization adapter for the historical data cache system.

## Overview

The Google Ads Sync Adapter provides OAuth 2.0 authentication and data synchronization with the Google Ads API. It normalizes Google Ads campaign data into a universal format compatible with the multi-platform sync engine.

## Components

### 1. GoogleAdsSyncAdapter (`google-ads-sync-adapter.ts`)

Main adapter class that extends `BaseSyncAdapter` and implements Google Ads specific functionality.

**Key Features:**
- OAuth 2.0 authentication with automatic token refresh
- Campaign fetching with status filtering
- Insights retrieval with date range support
- Data normalization to universal format
- Rate limiting (200ms between requests)

**Methods:**
- `authenticate(credentials)` - Authenticate with Google Ads API
- `fetchCampaigns(accountId)` - Fetch all active campaigns
- `fetchInsights(campaignId, dateRange)` - Fetch campaign insights
- `normalizePlatformData(platformData)` - Convert Google Ads data to universal format

**Usage Example:**
```typescript
import { GoogleAdsSyncAdapter } from '@/lib/sync/google-ads-sync-adapter';
import { AdPlatform } from '@/lib/types/sync';

const config = {
  id: 'config-id',
  platform: AdPlatform.GOOGLE,
  client_id: 'client-uuid',
  account_id: '123-456-7890',
  access_token: 'ya29.xxx',
  refresh_token: '1//xxx',
  token_expires_at: new Date('2025-01-01'),
  sync_status: 'active',
  created_at: new Date(),
  updated_at: new Date()
};

const adapter = new GoogleAdsSyncAdapter(
  config,
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN!
);

// Authenticate
await adapter.authenticate({
  access_token: config.access_token,
  refresh_token: config.refresh_token,
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET
});

// Fetch campaigns
const campaigns = await adapter.fetchCampaigns(config.account_id);

// Fetch insights
const insights = await adapter.fetchInsights(
  campaigns[0].id,
  {
    start: new Date('2025-01-01'),
    end: new Date('2025-01-31')
  }
);
```

### 2. GoogleTokenManager (`google-token-manager.ts`)

Service for managing OAuth tokens with encryption and automatic refresh.

**Key Features:**
- Encrypted token storage in database
- Automatic token refresh before expiration
- Token validation and expiration checking
- Connection management per client

**Methods:**
- `storeTokens(clientId, accountId, tokens)` - Store encrypted tokens
- `getTokens(clientId, accountId)` - Retrieve and decrypt tokens
- `isTokenExpired(clientId, accountId)` - Check token expiration
- `refreshToken(clientId, accountId)` - Refresh access token
- `validateToken(clientId, accountId)` - Validate and refresh if needed
- `deleteTokens(clientId, accountId)` - Remove tokens
- `getActiveConnections(clientId)` - Get all active connections
- `updateSyncStatus(clientId, accountId, status)` - Update sync status

**Usage Example:**
```typescript
import { googleTokenManager } from '@/lib/services/google-token-manager';

// Store tokens after OAuth flow
await googleTokenManager.storeTokens(
  'client-uuid',
  '123-456-7890',
  {
    access_token: 'ya29.xxx',
    refresh_token: '1//xxx',
    expires_in: 3600
  }
);

// Get tokens (automatically decrypted)
const tokens = await googleTokenManager.getTokens(
  'client-uuid',
  '123-456-7890'
);

// Check if token needs refresh
const isExpired = await googleTokenManager.isTokenExpired(
  'client-uuid',
  '123-456-7890'
);

if (isExpired) {
  // Automatically refresh
  const newTokens = await googleTokenManager.refreshToken(
    'client-uuid',
    '123-456-7890'
  );
}

// Update sync status
await googleTokenManager.updateSyncStatus(
  'client-uuid',
  '123-456-7890',
  'active'
);
```

### 3. GoogleAdsErrorHandler (`google-ads-error-handler.ts`)

Specialized error handling with retry logic and exponential backoff.

**Key Features:**
- Error type classification
- Automatic retry with exponential backoff
- Rate limit handling
- Token expiration detection
- User-friendly error messages

**Error Types:**
- `AUTHENTICATION_ERROR` - Invalid or expired token
- `AUTHORIZATION_ERROR` - Insufficient permissions
- `RATE_LIMIT_ERROR` - API rate limit exceeded
- `QUOTA_ERROR` - Daily quota exceeded
- `INVALID_REQUEST` - Invalid parameters
- `RESOURCE_NOT_FOUND` - Campaign/account not found
- `INTERNAL_ERROR` - Google API error
- `TOKEN_EXPIRED` - Access token expired
- `NETWORK_ERROR` - Connection failed
- `UNKNOWN_ERROR` - Unclassified error

**Methods:**
- `parseError(error, statusCode)` - Parse API error
- `shouldRetry(error, attemptNumber)` - Determine if retryable
- `calculateRetryDelay(error, attemptNumber)` - Calculate backoff delay
- `executeWithRetry(fn, context)` - Execute with automatic retry
- `handleTokenExpiration(refreshTokenFn)` - Handle token refresh
- `getUserMessage(error)` - Get user-friendly message

**Usage Example:**
```typescript
import { googleAdsErrorHandler } from '@/lib/sync/google-ads-error-handler';

// Execute with automatic retry
const campaigns = await googleAdsErrorHandler.executeWithRetry(
  async () => {
    const response = await fetch(url, options);
    if (!response.ok) {
      const error = await response.json();
      const parsed = googleAdsErrorHandler.parseError(error, response.status);
      throw parsed;
    }
    return response.json();
  },
  'Fetch campaigns'
);

// Parse and handle error
try {
  // API call
} catch (error) {
  const parsed = googleAdsErrorHandler.parseError(error, 401);
  
  if (googleAdsErrorHandler.requiresReauth(parsed)) {
    // Redirect to OAuth flow
    console.log('User needs to reconnect:', 
      googleAdsErrorHandler.getUserMessage(parsed)
    );
  }
  
  if (googleAdsErrorHandler.isQuotaError(parsed)) {
    // Show quota exceeded message
    console.log('Quota exceeded, retry after:', parsed.retryAfter);
  }
}
```

## Environment Variables

Required environment variables for Google Ads integration:

```env
# Google Ads API credentials
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
GOOGLE_ADS_CLIENT_ID=your-oauth-client-id.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=your-oauth-client-secret

# Token encryption (32-byte hex string)
TOKEN_ENCRYPTION_KEY=your-256-bit-encryption-key-in-hex
```

## Database Schema

The adapter uses the `sync_configurations` table:

```sql
CREATE TABLE sync_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id),
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('meta', 'google')),
  account_id VARCHAR(255) NOT NULL,
  
  -- Encrypted OAuth tokens
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Sync scheduling
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  sync_status VARCHAR(20) DEFAULT 'pending',
  last_error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(client_id, platform, account_id)
);
```

## Data Normalization

Google Ads data is normalized to the universal `CampaignInsight` format:

**Google Ads → Universal Mapping:**
- `campaign.id` → `campaign_id`
- `campaign.name` → `campaign_name`
- `segments.date` → `date`
- `metrics.impressions` → `impressions`
- `metrics.clicks` → `clicks`
- `metrics.cost_micros / 1000000` → `spend` (converted from micros)
- `metrics.conversions` → `conversions`

**Calculated Metrics:**
- `ctr` = (clicks / impressions) × 100
- `cpc` = spend / clicks
- `cpm` = (spend / impressions) × 1000
- `conversion_rate` = (conversions / clicks) × 100

## Rate Limiting

The adapter implements rate limiting to comply with Google Ads API limits:

- **Base delay:** 200ms between requests
- **Retry logic:** Exponential backoff (1s, 2s, 4s)
- **Max retries:** 3 attempts
- **Rate limit errors:** Automatic retry with 60-120s delay

## Error Handling

The adapter handles common Google Ads API errors:

1. **Authentication Errors (401)**
   - Automatically attempts token refresh
   - Falls back to requiring re-authentication

2. **Rate Limit Errors (429)**
   - Implements exponential backoff
   - Respects retry-after headers

3. **Authorization Errors (403)**
   - Non-retryable
   - Indicates permission issues

4. **Internal Errors (5xx)**
   - Retryable with backoff
   - Logs for monitoring

## Integration with Multi-Platform Sync Engine

The Google Ads adapter integrates with the sync engine:

```typescript
import { MultiPlatformSyncEngine } from '@/lib/sync/multi-platform-sync-engine';
import { GoogleAdsSyncAdapter } from '@/lib/sync/google-ads-sync-adapter';

const engine = new MultiPlatformSyncEngine();

// Register Google Ads adapter
engine.registerAdapter(
  AdPlatform.GOOGLE,
  (config) => new GoogleAdsSyncAdapter(
    config,
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN!
  )
);

// Sync client
await engine.syncClient('client-uuid', AdPlatform.GOOGLE);
```

## Testing

To test the Google Ads adapter:

1. Set up test credentials in `.env`
2. Create a test sync configuration
3. Run adapter methods with test data

```typescript
// Test authentication
const adapter = new GoogleAdsSyncAdapter(testConfig, testDevToken);
await adapter.authenticate(testCredentials);

// Test campaign fetch
const campaigns = await adapter.fetchCampaigns(testAccountId);
expect(campaigns).toHaveLength(greaterThan(0));

// Test insights fetch
const insights = await adapter.fetchInsights(
  campaigns[0].id,
  { start: new Date('2025-01-01'), end: new Date('2025-01-31') }
);
expect(insights).toBeDefined();
```

## Requirements Satisfied

This implementation satisfies the following requirements:

- **Requirement 4.1:** OAuth 2.0 authentication with Google Ads API
- **Requirement 5.1:** Fetch campaigns and insights from Google Ads
- **Requirement 5.2:** Normalize metrics to universal format
- **Requirement 4.5:** Error handling with retry logic
- **Requirement 5.4:** Rate limiting and API error handling

## Next Steps

1. Implement Meta Ads Sync Adapter (Task 5)
2. Integrate with Multi-Platform Sync Engine (Task 7)
3. Add OAuth flow endpoints for Google Ads
4. Implement sync scheduling and cron jobs
5. Add monitoring and alerting for sync failures
