# Historical Data Cache API Documentation

## Overview

The Historical Data Cache system provides APIs for managing plan limits, feature gates, data synchronization, hybrid data retrieval, and data export for multi-platform advertising campaigns.

## Table of Contents

1. [Plan Configuration APIs](#plan-configuration-apis)
2. [Feature Gate APIs](#feature-gate-apis)
3. [Data Insights APIs](#data-insights-apis)
4. [Export APIs](#export-apis)
5. [Admin Monitoring APIs](#admin-monitoring-apis)
6. [Cron Job APIs](#cron-job-apis)
7. [Error Codes](#error-codes)
8. [Rate Limiting](#rate-limiting)

---

## Plan Configuration APIs

### Get Plan Limits

Retrieve the configured limits for a specific subscription plan.

**Endpoint:** `GET /api/admin/plans/:id/limits`

**Authentication:** Admin only

**Parameters:**
- `id` (path, required): Plan ID

**Response:**
```json
{
  "id": "limit-1",
  "plan_id": "plan-1",
  "max_clients": 10,
  "max_campaigns_per_client": 50,
  "data_retention_days": 180,
  "sync_interval_hours": 12,
  "allow_csv_export": true,
  "allow_json_export": true,
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

**Error Responses:**
- `404 Not Found`: Plan limits not found
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin

---

### Update Plan Limits

Update the limits for a subscription plan.

**Endpoint:** `PUT /api/admin/plans/:id/limits`

**Authentication:** Admin only

**Parameters:**
- `id` (path, required): Plan ID

**Request Body:**
```json
{
  "max_clients": 20,
  "max_campaigns_per_client": 100,
  "data_retention_days": 365,
  "sync_interval_hours": 6,
  "allow_csv_export": true,
  "allow_json_export": true
}
```

**Validation Rules:**
- `max_clients`: Integer >= -1 (-1 = unlimited)
- `max_campaigns_per_client`: Integer >= -1 (-1 = unlimited)
- `data_retention_days`: Integer between 30 and 3650
- `sync_interval_hours`: Integer between 1 and 168
- `allow_csv_export`: Boolean
- `allow_json_export`: Boolean

**Response:**
```json
{
  "id": "limit-1",
  "plan_id": "plan-1",
  "max_clients": 20,
  "max_campaigns_per_client": 100,
  "data_retention_days": 365,
  "sync_interval_hours": 6,
  "allow_csv_export": true,
  "allow_json_export": true,
  "updated_at": "2025-01-27T15:45:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Validation failed
- `404 Not Found`: Plan not found
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin

---

## Feature Gate APIs

### Check Data Retention

Verify if a user can access data for a specific retention period.

**Endpoint:** `GET /api/feature-gate/data-retention`

**Authentication:** Required

**Query Parameters:**
- `requestedDays` (required): Number of days of historical data requested

**Response:**
```json
{
  "allowed": true,
  "requestedDays": 90,
  "allowedDays": 180,
  "reason": null
}
```

**Error Response (Limit Exceeded):**
```json
{
  "allowed": false,
  "requestedDays": 200,
  "allowedDays": 180,
  "reason": "Data retention limit exceeded. Your plan allows 180 days, but 200 days were requested."
}
```

---

### Check Client Limit

Verify if a user can add more clients.

**Endpoint:** `GET /api/feature-gate/client-limit`

**Authentication:** Required

**Response:**
```json
{
  "allowed": true,
  "current": 5,
  "limit": 10,
  "remaining": 5,
  "isUnlimited": false,
  "reason": null
}
```

**Error Response (Limit Reached):**
```json
{
  "allowed": false,
  "current": 10,
  "limit": 10,
  "remaining": 0,
  "isUnlimited": false,
  "reason": "Client limit reached. Your plan allows 10 clients, and you currently have 10."
}
```

---

### Check Campaign Limit

Verify if a client can add more campaigns.

**Endpoint:** `GET /api/feature-gate/campaign-limit`

**Authentication:** Required

**Query Parameters:**
- `clientId` (required): Client ID

**Response:**
```json
{
  "allowed": true,
  "current": 15,
  "limit": 50,
  "remaining": 35,
  "isUnlimited": false,
  "reason": null
}
```

---

### Check Export Permission

Verify if a user can export data in a specific format.

**Endpoint:** `GET /api/feature-gate/export-permission`

**Authentication:** Required

**Query Parameters:**
- `format` (required): Export format (`csv` or `json`)

**Response:**
```json
{
  "allowed": true,
  "format": "csv",
  "reason": null
}
```

**Error Response (Not Allowed):**
```json
{
  "allowed": false,
  "format": "json",
  "reason": "Export to JSON is not available in your current plan. Please upgrade to access this feature."
}
```

---

### Get Limits Summary

Get a complete summary of all limits and current usage.

**Endpoint:** `GET /api/feature-gate/limits-summary`

**Authentication:** Required

**Response:**
```json
{
  "dataRetention": {
    "days": 180,
    "isUnlimited": false
  },
  "clients": {
    "current": 5,
    "limit": 10,
    "remaining": 5,
    "isUnlimited": false
  },
  "syncInterval": {
    "hours": 12
  },
  "export": {
    "csv": true,
    "json": false
  }
}
```

---

## Data Insights APIs

### Get Campaign Insights

Retrieve campaign insights using hybrid data strategy (cache + API).

**Endpoint:** `GET /api/insights/campaigns`

**Authentication:** Required

**Query Parameters:**
- `clientId` (required): Client ID
- `platform` (optional): Platform filter (`meta` or `google`)
- `dateFrom` (required): Start date (ISO 8601)
- `dateTo` (required): End date (ISO 8601)
- `campaignIds` (optional): Comma-separated campaign IDs

**Example Request:**
```
GET /api/insights/campaigns?clientId=client-1&platform=meta&dateFrom=2025-01-01&dateTo=2025-01-27&campaignIds=campaign-1,campaign-2
```

**Response:**
```json
{
  "source": "hybrid",
  "data": [
    {
      "id": "insight-1",
      "platform": "meta",
      "client_id": "client-1",
      "campaign_id": "campaign-1",
      "campaign_name": "Summer Sale",
      "date": "2025-01-15",
      "impressions": 10000,
      "clicks": 500,
      "spend": 250.50,
      "conversions": 25,
      "ctr": 5.0,
      "cpc": 0.50,
      "cpm": 25.05,
      "conversion_rate": 5.0,
      "is_deleted": false,
      "synced_at": "2025-01-16T08:00:00Z"
    }
  ],
  "api_status": "success",
  "cache_hit_rate": 0.75,
  "fallback_used": false
}
```

**Data Source Values:**
- `cache`: All data from cache
- `api`: All data from API
- `hybrid`: Combination of cache and API

**API Status Values:**
- `success`: API calls succeeded
- `failed`: API calls failed, using cache only
- `partial`: Some API calls failed

---

### Get Single Campaign Insights

Retrieve insights for a specific campaign.

**Endpoint:** `GET /api/insights/campaigns/:id`

**Authentication:** Required

**Parameters:**
- `id` (path, required): Campaign ID

**Query Parameters:**
- `clientId` (required): Client ID
- `platform` (required): Platform (`meta` or `google`)
- `dateFrom` (required): Start date (ISO 8601)
- `dateTo` (required): End date (ISO 8601)

**Response:**
```json
{
  "source": "api",
  "data": [
    {
      "id": "insight-1",
      "platform": "meta",
      "client_id": "client-1",
      "campaign_id": "campaign-1",
      "campaign_name": "Summer Sale",
      "date": "2025-01-27",
      "impressions": 1500,
      "clicks": 75,
      "spend": 37.50,
      "conversions": 8,
      "ctr": 5.0,
      "cpc": 0.50,
      "cpm": 25.0,
      "conversion_rate": 10.67,
      "is_deleted": false,
      "synced_at": "2025-01-27T10:00:00Z"
    }
  ],
  "api_status": "success"
}
```

---

## Export APIs

### Export to CSV

Export campaign insights to CSV format.

**Endpoint:** `POST /api/exports/csv`

**Authentication:** Required

**Request Body:**
```json
{
  "clientId": "client-1",
  "platform": "meta",
  "dateFrom": "2025-01-01",
  "dateTo": "2025-01-27",
  "campaignIds": ["campaign-1", "campaign-2"]
}
```

**Response:**
```json
{
  "exportId": "export-123",
  "status": "processing",
  "format": "csv",
  "recordCount": 270,
  "expiresAt": "2025-01-28T15:45:00Z"
}
```

**Error Responses:**
- `403 Forbidden`: CSV export not allowed in current plan
- `400 Bad Request`: Invalid date range or exceeds retention period

---

### Export to JSON

Export campaign insights to JSON format.

**Endpoint:** `POST /api/exports/json`

**Authentication:** Required

**Request Body:**
```json
{
  "clientId": "client-1",
  "platform": "google",
  "dateFrom": "2025-01-01",
  "dateTo": "2025-01-27"
}
```

**Response:**
```json
{
  "exportId": "export-124",
  "status": "processing",
  "format": "json",
  "recordCount": 540,
  "expiresAt": "2025-01-28T15:45:00Z"
}
```

---

### Download Export

Download a completed export file.

**Endpoint:** `GET /api/exports/:id/download`

**Authentication:** Required

**Parameters:**
- `id` (path, required): Export ID

**Response:**
- Content-Type: `text/csv` or `application/json`
- Content-Disposition: `attachment; filename="export-123.csv"`
- Body: File content

**Error Responses:**
- `404 Not Found`: Export not found or expired
- `202 Accepted`: Export still processing
- `403 Forbidden`: Not authorized to download this export

---

## Admin Monitoring APIs

### Get Sync Metrics

Retrieve synchronization metrics for monitoring.

**Endpoint:** `GET /api/admin/monitoring/sync-metrics`

**Authentication:** Admin only

**Query Parameters:**
- `dateFrom` (optional): Start date for metrics
- `dateTo` (optional): End date for metrics

**Response:**
```json
{
  "totalSyncs": 1250,
  "successfulSyncs": 1200,
  "failedSyncs": 50,
  "successRate": 96.0,
  "avgSyncDuration": 15.5,
  "byPlatform": {
    "meta": {
      "total": 750,
      "successful": 730,
      "failed": 20,
      "avgDuration": 12.3
    },
    "google": {
      "total": 500,
      "successful": 470,
      "failed": 30,
      "avgDuration": 20.1
    }
  }
}
```

---

### Get Storage Metrics

Retrieve storage usage metrics.

**Endpoint:** `GET /api/admin/monitoring/storage-metrics`

**Authentication:** Admin only

**Response:**
```json
{
  "totalRecords": 1500000,
  "totalSizeGB": 45.2,
  "byPlatform": {
    "meta": {
      "records": 900000,
      "sizeGB": 27.1
    },
    "google": {
      "records": 600000,
      "sizeGB": 18.1
    }
  },
  "byClient": [
    {
      "clientId": "client-1",
      "clientName": "Acme Corp",
      "records": 50000,
      "sizeGB": 1.5
    }
  ]
}
```

---

### Get Client Usage

Retrieve detailed usage statistics for a specific client.

**Endpoint:** `GET /api/admin/monitoring/client-usage`

**Authentication:** Admin only

**Query Parameters:**
- `clientId` (required): Client ID

**Response:**
```json
{
  "clientId": "client-1",
  "clientName": "Acme Corp",
  "planId": "plan-pro",
  "usage": {
    "clients": {
      "current": 5,
      "limit": 10
    },
    "campaigns": {
      "current": 45,
      "limit": 100
    },
    "dataRetention": {
      "oldestRecord": "2024-07-30",
      "newestRecord": "2025-01-27",
      "totalDays": 181,
      "limit": 180
    },
    "storage": {
      "records": 50000,
      "sizeGB": 1.5
    }
  },
  "lastSync": "2025-01-27T10:00:00Z",
  "nextSync": "2025-01-27T22:00:00Z"
}
```

---

### Get System Health

Get overall system health status.

**Endpoint:** `GET /api/admin/monitoring/system-health`

**Authentication:** Admin only

**Response:**
```json
{
  "status": "healthy",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 15
    },
    "metaApi": {
      "status": "healthy",
      "responseTime": 250
    },
    "googleApi": {
      "status": "degraded",
      "responseTime": 1500,
      "message": "High latency detected"
    },
    "storage": {
      "status": "healthy",
      "usagePercent": 65
    }
  },
  "timestamp": "2025-01-27T15:45:00Z"
}
```

**Status Values:**
- `healthy`: All systems operational
- `degraded`: Some systems experiencing issues
- `unhealthy`: Critical systems down

---

## Cron Job APIs

### Sync Scheduler

Schedules sync jobs based on plan limits.

**Endpoint:** `GET /api/cron/sync-scheduler`

**Authentication:** Cron secret required

**Headers:**
- `Authorization: Bearer <CRON_SECRET>`

**Response:**
```json
{
  "scheduled": 25,
  "skipped": 3,
  "errors": 0
}
```

---

### Sync Executor

Executes pending sync jobs.

**Endpoint:** `GET /api/cron/sync-executor`

**Authentication:** Cron secret required

**Response:**
```json
{
  "executed": 20,
  "successful": 18,
  "failed": 2,
  "totalRecords": 15000
}
```

---

### Data Cleanup

Removes expired data based on retention policies.

**Endpoint:** `GET /api/cron/data-cleanup`

**Authentication:** Cron secret required

**Response:**
```json
{
  "recordsDeleted": 50000,
  "clientsProcessed": 100,
  "errors": 0
}
```

---

### Export Cleanup

Removes expired export files.

**Endpoint:** `GET /api/cron/export-cleanup`

**Authentication:** Cron secret required

**Response:**
```json
{
  "exportsDeleted": 15,
  "spaceFreedMB": 250
}
```

---

## Error Codes

### Standard Error Response Format

```json
{
  "error": {
    "code": "PLAN_LIMIT_EXCEEDED",
    "message": "Client limit reached. Your plan allows 10 clients.",
    "details": {
      "current": 10,
      "limit": 10
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `PLAN_LIMIT_EXCEEDED` | 403 | User has reached plan limit |
| `DATA_RETENTION_EXCEEDED` | 403 | Requested data beyond retention period |
| `SYNC_FAILED` | 500 | Synchronization operation failed |
| `API_RATE_LIMIT` | 429 | API rate limit exceeded |
| `INVALID_TOKEN` | 401 | Authentication token invalid or expired |
| `EXPORT_NOT_ALLOWED` | 403 | Export format not allowed in plan |
| `INVALID_DATE_RANGE` | 400 | Invalid or malformed date range |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource not found |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INTERNAL_ERROR` | 500 | Internal server error |

---

## Rate Limiting

### API Rate Limits

| Endpoint Category | Rate Limit | Window |
|-------------------|------------|--------|
| Feature Gate APIs | 100 requests | 1 minute |
| Data Insights APIs | 50 requests | 1 minute |
| Export APIs | 10 requests | 1 minute |
| Admin APIs | 200 requests | 1 minute |

### Rate Limit Headers

All API responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706371200
```

### Rate Limit Exceeded Response

```json
{
  "error": {
    "code": "API_RATE_LIMIT",
    "message": "Rate limit exceeded. Please retry after 60 seconds.",
    "retry_after": 60
  }
}
```

---

## Best Practices

### 1. Date Range Queries

- Always validate date ranges against user's plan limits before querying
- Use the `/api/feature-gate/data-retention` endpoint to check limits
- Prefer smaller date ranges for better performance

### 2. Caching Strategy

- Recent data (last 7 days) is fetched from API in real-time
- Historical data (8+ days) is served from cache
- System automatically falls back to cache if API fails

### 3. Export Operations

- Check export permissions before initiating export
- Exports expire after 24 hours
- Download exports as soon as they're ready

### 4. Error Handling

- Always check `api_status` in insights responses
- Implement retry logic with exponential backoff for failed requests
- Handle `fallback_used` flag to inform users about data source

### 5. Performance Optimization

- Use campaign ID filters to reduce result set size
- Limit date ranges to necessary periods
- Leverage cache for historical data analysis

---

## Support

For additional support or questions about the Historical Data Cache API:

- Documentation: `/docs/API_HISTORICAL_DATA_CACHE.md`
- Integration Guide: `/docs/INTEGRATION_GUIDE.md`
- Examples: `/docs/examples/`

---

**Last Updated:** January 27, 2025  
**API Version:** 1.0.0
