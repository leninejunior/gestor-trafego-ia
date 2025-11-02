# Hybrid Data Insights API

API endpoints for retrieving campaign insights using hybrid strategy (cache + real-time API data).

## Overview

These endpoints implement the hybrid data retrieval strategy:
- **Last 7 days**: Fetch from platform API in real-time
- **8+ days**: Fetch from historical cache
- **Automatic fallback**: Use cache if API fails

## Authentication

All endpoints require authentication via Supabase Auth. Include the session token in your request.

## Endpoints

### GET /api/insights/campaigns

Retrieve campaign insights for multiple campaigns with filtering options.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `client_id` | string | Yes | Client ID to fetch data for |
| `platform` | string | No | Filter by platform: `meta` or `google` |
| `campaign_ids` | string | No | Comma-separated campaign IDs to filter |
| `date_from` | string | Yes | Start date in ISO format (YYYY-MM-DD) |
| `date_to` | string | Yes | End date in ISO format (YYYY-MM-DD) |
| `metrics` | string | No | Comma-separated metrics to include |
| `limit` | number | No | Max records to return (max: 1000) |
| `offset` | number | No | Pagination offset |
| `force_cache` | boolean | No | Force cache-only mode (skip API) |

#### Example Request

```bash
GET /api/insights/campaigns?client_id=abc123&platform=meta&date_from=2025-01-01&date_to=2025-01-31
```

#### Example Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "platform": "meta",
      "client_id": "abc123",
      "campaign_id": "camp_123",
      "campaign_name": "Summer Campaign",
      "date": "2025-01-15T00:00:00.000Z",
      "impressions": 10000,
      "clicks": 500,
      "spend": 250.00,
      "conversions": 25,
      "ctr": 5.00,
      "cpc": 0.50,
      "cpm": 25.00,
      "conversion_rate": 5.00,
      "is_deleted": false,
      "synced_at": "2025-01-16T10:30:00.000Z"
    }
  ],
  "metadata": {
    "source": "hybrid",
    "api_status": "success",
    "cache_hit_rate": 0.75,
    "fallback_used": false,
    "emergency_cache": false,
    "total_records": 100,
    "query": {
      "client_id": "abc123",
      "platform": "meta",
      "date_from": "2025-01-01",
      "date_to": "2025-01-31",
      "requested_days": 31
    }
  }
}
```

### GET /api/insights/campaigns/:id

Retrieve insights for a specific campaign with daily breakdown and summary.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Campaign ID |

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `client_id` | string | Yes | Client ID that owns the campaign |
| `platform` | string | Yes | Platform: `meta` or `google` |
| `date_from` | string | Yes | Start date in ISO format (YYYY-MM-DD) |
| `date_to` | string | Yes | End date in ISO format (YYYY-MM-DD) |
| `metrics` | string | No | Comma-separated metrics to include |
| `force_cache` | boolean | No | Force cache-only mode (skip API) |

#### Example Request

```bash
GET /api/insights/campaigns/camp_123?client_id=abc123&platform=meta&date_from=2025-01-01&date_to=2025-01-31
```

#### Example Response

```json
{
  "success": true,
  "campaign": {
    "id": "camp_123",
    "name": "Summer Campaign",
    "platform": "meta",
    "is_deleted": false,
    "summary": {
      "total_impressions": 310000,
      "total_clicks": 15500,
      "total_spend": 7750.00,
      "total_conversions": 775,
      "avg_ctr": 5.00,
      "avg_cpc": 0.50,
      "avg_cpm": 25.00,
      "conversion_rate": 5.00
    },
    "daily_breakdown": [
      {
        "date": "2025-01-01T00:00:00.000Z",
        "impressions": 10000,
        "clicks": 500,
        "spend": 250.00,
        "conversions": 25,
        "ctr": 5.00,
        "cpc": 0.50,
        "cpm": 25.00,
        "conversion_rate": 5.00
      }
    ]
  },
  "metadata": {
    "source": "hybrid",
    "api_status": "success",
    "cache_hit_rate": 0.75,
    "fallback_used": false,
    "total_days": 31,
    "query": {
      "client_id": "abc123",
      "campaign_id": "camp_123",
      "platform": "meta",
      "date_from": "2025-01-01",
      "date_to": "2025-01-31",
      "requested_days": 31
    }
  }
}
```

## Data Sources

The `metadata.source` field indicates where the data came from:

- **`api`**: All data fetched from platform API in real-time
- **`cache`**: All data fetched from historical cache
- **`hybrid`**: Mix of cache (historical) and API (recent)

## API Status

The `metadata.api_status` field indicates the health of API calls:

- **`success`**: API calls succeeded
- **`failed`**: API calls failed, using cache fallback
- **`partial`**: Some API calls failed (in hybrid mode)

## Fallback Behavior

The system automatically falls back to cache when:
- Platform API is unavailable
- API rate limits are exceeded
- Authentication tokens are expired
- Network errors occur

When fallback is used:
- `metadata.fallback_used` will be `true`
- `metadata.error_message` will contain the error details
- Data will be served from cache with `cached_at` timestamp

## Plan Limits

The endpoints enforce plan-based data retention limits:

- Each plan has a `data_retention_days` limit (30-3650 days)
- Requests exceeding the limit return `403 Forbidden`
- Error response includes allowed days and upgrade message

### Example Error Response

```json
{
  "error": "Data retention limit exceeded",
  "details": {
    "requested_days": 180,
    "allowed_days": 90,
    "message": "Your plan allows access to 90 days of historical data. Please upgrade to access more."
  }
}
```

## Error Responses

### 400 Bad Request
Missing or invalid parameters

```json
{
  "error": "Missing required parameter: client_id"
}
```

### 401 Unauthorized
Not authenticated

```json
{
  "error": "Unauthorized"
}
```

### 403 Forbidden
Access denied or plan limit exceeded

```json
{
  "error": "Access denied to this client"
}
```

### 404 Not Found
Client or campaign not found

```json
{
  "error": "Campaign not found",
  "details": {
    "campaign_id": "camp_123",
    "platform": "meta",
    "message": "No data found for this campaign in the specified date range"
  }
}
```

### 500 Internal Server Error
Server error

```json
{
  "error": "Internal server error",
  "message": "Error details..."
}
```

## Performance Considerations

1. **Date Range**: Limit queries to necessary date ranges to improve performance
2. **Pagination**: Use `limit` and `offset` for large result sets
3. **Force Cache**: Use `force_cache=true` for faster responses when real-time data isn't needed
4. **Platform Filter**: Filter by platform when possible to reduce data volume

## Requirements Mapping

These endpoints implement the following requirements:

- **5.1**: Hybrid data strategy (cache + API)
- **5.2**: Automatic fallback to cache
- **5.3**: Data source indicators
- **2.1**: Plan-based data retention validation
- **2.2**: Retention limit enforcement

## Future Enhancements

When Meta Ads and Google Ads sync adapters are fully implemented (Tasks 5 and 6), these endpoints will:
- Fetch real-time data from platform APIs for recent periods
- Automatically sync and cache new data
- Provide fresher data with lower latency
