# Hybrid Data Service

## Overview

The Hybrid Data Service intelligently combines cached historical data with real-time API data to optimize performance, reduce API costs, and ensure data availability. It includes robust fallback mechanisms to ensure data is always available, even when APIs are down.

## Features

- **Intelligent Data Routing**: Automatically determines whether to fetch from cache or API based on date range
- **7-Day Threshold**: Recent data (last 7 days) fetched from API, older data from cache
- **Hybrid Queries**: Seamlessly combines cache and API data for queries spanning both periods
- **Automatic Fallback**: Falls back to cache when API is unavailable or fails
- **Emergency Cache**: Serves stale cache data as last resort when all else fails
- **API Health Checks**: Proactively checks API health before attempting fetch
- **Data Source Indicators**: Clear indication of data source (API, cache, hybrid) and fallback status
- **Data Freshness Validation**: Checks age of cached data and recommends refresh when needed

## Strategy

### Data Source Selection

The service automatically determines the optimal data s

##
 Fallback Strategy

The service implements a multi-level fallback strategy to ensure data availability:

### Level 1: Primary Data Source
- **Recent data (0-7 days)**: Fetch from API
- **Historical data (8+ days)**: Fetch from cache
- **Hybrid queries**: Combine both sources

### Level 2: Automatic Fallback
When API calls fail:
- Automatically falls back to cache for the requested period
- Sets `fallback_used: true` in response
- Includes error message for debugging
- Sets `api_status: 'failed'`

### Level 3: Emergency Cache
When critical errors occur:
- Serves any available cache data, regardless of age
- Sets `emergency_cache: true` in response
- Logs detailed error information
- Returns empty array if even cache fails

### Proactive Health Checks
Use `getDataWithHealthCheck()` to:
- Check API health before attempting fetch
- Skip API entirely if unhealthy
- Reduce failed API calls and improve response time

## Response Indicators

All responses include indicators to help clients understand data source and status:

```typescript
interface HybridDataResponse {
  source: DataSource;              // 'api', 'cache', or 'hybrid'
  data: CampaignInsight[];         // The actual data
  cached_at?: Date;                // When data was cached
  api_status?: 'success' | 'failed' | 'partial';  // API call status
  cache_hit_rate?: number;         // Percentage of data from cache (0-1)
  fallback_used?: boolean;         // True if fallback was triggered
  emergency_cache?: boolean;       // True if emergency cache was used
  error_message?: string;          // Error details if applicable
}
```

### Status Interpretation

- **api_status: 'success'**: All API calls succeeded
- **api_status: 'failed'**: API calls failed, using cache only
- **api_status: 'partial'**: Some API calls failed (hybrid queries)
- **fallback_used: true**: Automatic fallback was triggered
- **emergency_cache: true**: Last resort cache was used

## Usage Examples

### Basic Usage with Automatic Fallback

```typescript
const service = new HybridDataService();

// Automatic fallback if API fails
const response = await service.getData(
  {
    client_id: 'client-123',
    platform: AdPlatform.META,
    date_from: new Date('2025-01-01'),
    date_to: new Date('2025-01-27')
  },
  metaAdapter
);

// Check if fallback was used
if (response.fallback_used) {
  console.warn('Using cached data due to API failure:', response.error_message);
}

// Check data source
console.log('Data source:', response.source); // 'api', 'cache', or 'hybrid'
console.log('Cache hit rate:', response.cache_hit_rate); // 0.0 to 1.0
```

### Proactive Health Check

```typescript
// Check API health before fetching
const response = await service.getDataWithHealthCheck(
  query,
  adapter,
  false // forceCache = false
);

if (response.api_status === 'failed') {
  // API was unhealthy, used cache proactively
  console.log('API unavailable, serving cached data');
}
```

### Force Cache Mode

```typescript
// Skip API entirely and use cache only
const response = await service.getDataWithHealthCheck(
  query,
  adapter,
  true // forceCache = true
);

console.log('Cache-only mode:', response.fallback_used); // true
```

### Emergency Cache Handling

```typescript
try {
  const response = await service.getData(query, adapter);
  
  if (response.emergency_cache) {
    // Critical error occurred, using stale cache
    console.error('Emergency cache activated:', response.error_message);
    
    // Show warning to user
    showWarning('Using cached data due to system error. Data may be outdated.');
  }
  
  // Use data regardless
  displayData(response.data);
  
} catch (error) {
  // Even emergency cache failed
  console.error('Complete system failure:', error);
  showError('Unable to retrieve data. Please try again later.');
}
```

### Hybrid Query with Partial Failure

```typescript
// Query spanning recent and historical periods
const response = await service.getData(
  {
    client_id: 'client-123',
    platform: AdPlatform.META,
    date_from: new Date('2025-01-01'), // 27 days ago
    date_to: new Date('2025-01-27')    // today
  },
  adapter
);

if (response.api_status === 'partial') {
  // Historical data from cache succeeded
  // Recent data from API failed, fell back to cache
  console.log('Partial failure - some data from cache');
  console.log('Cache hit rate:', response.cache_hit_rate); // e.g., 0.75
}
```

## Best Practices

### 1. Always Check Response Status

```typescript
const response = await service.getData(query, adapter);

// Check API status
if (response.api_status === 'failed') {
  // Inform user that data may be outdated
  showWarning('Displaying cached data - API temporarily unavailable');
}

// Check if emergency cache was used
if (response.emergency_cache) {
  // Show critical warning
  showCriticalWarning('System error - data may be significantly outdated');
}
```

### 2. Use Health Checks for Critical Operations

```typescript
// For critical operations, check health first
const isHealthy = await service.isApiHealthy(adapter);

if (!isHealthy) {
  // Warn user before proceeding
  const proceed = await confirmWithUser(
    'API is currently unavailable. Continue with cached data?'
  );
  
  if (!proceed) {
    return;
  }
}

const response = await service.getData(query, adapter);
```

### 3. Monitor Cache Hit Rates

```typescript
const response = await service.getData(query, adapter);

// Log metrics for monitoring
logMetric('cache_hit_rate', response.cache_hit_rate);
logMetric('api_status', response.api_status);
logMetric('fallback_used', response.fallback_used ? 1 : 0);

// Alert if cache hit rate is unexpectedly high
if (response.cache_hit_rate > 0.8 && response.source === DataSource.HYBRID) {
  alertOps('High cache hit rate - possible API issues');
}
```

### 4. Handle Empty Results Gracefully

```typescript
const response = await service.getData(query, adapter);

if (response.data.length === 0) {
  if (response.emergency_cache) {
    // No data available even in emergency cache
    showError('No data available for this period');
  } else if (response.fallback_used) {
    // Cache is empty for this period
    showInfo('No historical data available for this period');
  } else {
    // API returned no data
    showInfo('No campaigns found for this period');
  }
}
```

## Error Handling

The service handles errors at multiple levels:

1. **API Errors**: Caught and trigger automatic fallback to cache
2. **Cache Errors**: Logged but don't prevent emergency cache attempt
3. **Critical Errors**: Trigger emergency cache with detailed logging
4. **Complete Failures**: Return empty result with error message

All errors are logged with context for debugging and monitoring.

## Performance Considerations

- **Parallel Fetching**: Historical and recent data fetched in parallel for hybrid queries
- **Early Fallback**: Health checks prevent unnecessary API calls
- **Cache First**: Historical data always from cache (no API overhead)
- **Graceful Degradation**: System remains functional even with API failures

## Monitoring

Key metrics to monitor:

- `cache_hit_rate`: Percentage of data served from cache
- `api_status`: Success rate of API calls
- `fallback_used`: Frequency of fallback activation
- `emergency_cache`: Frequency of emergency cache usage
- `response_time`: Time to fetch data (cache vs API)

High emergency cache usage indicates systemic issues requiring investigation.
