# Export API Endpoints

API endpoints for exporting campaign insights data.

## Endpoints

### POST /api/exports/csv

Export campaign insights to CSV format.

**Request Body:**
```json
{
  "clientId": "uuid",
  "dateFrom": "2025-01-01",
  "dateTo": "2025-01-31",
  "platform": "meta",
  "campaignIds": ["campaign-1", "campaign-2"],
  "metrics": ["impressions", "clicks", "spend"]
}
```

**Response (200):**
```json
{
  "success": true,
  "export": {
    "id": "export-uuid",
    "format": "csv",
    "fileName": "export-uuid.csv",
    "fileSize": 12345,
    "recordCount": 100,
    "downloadUrl": "https://...",
    "expiresAt": "2025-01-02T12:00:00Z"
  }
}
```

**Errors:**
- `401`: Unauthorized
- `403`: CSV export not allowed for plan or access denied
- `400`: Invalid request or retention limit exceeded
- `404`: Client not found
- `500`: Export failed

### POST /api/exports/json

Export campaign insights to JSON format.

**Request Body:**
```json
{
  "clientId": "uuid",
  "dateFrom": "2025-01-01",
  "dateTo": "2025-01-31",
  "platform": "google",
  "campaignIds": ["campaign-1"]
}
```

**Response (200):**
```json
{
  "success": true,
  "export": {
    "id": "export-uuid",
    "format": "json",
    "fileName": "export-uuid.json",
    "fileSize": 23456,
    "recordCount": 100,
    "downloadUrl": "https://...",
    "expiresAt": "2025-01-02T12:00:00Z"
  }
}
```

**Errors:**
- `401`: Unauthorized
- `403`: JSON export not allowed for plan or access denied
- `400`: Invalid request or retention limit exceeded
- `404`: Client not found
- `500`: Export failed

### GET /api/exports/:id/download

Get download URL for a completed export.

**Response (200):**
```json
{
  "success": true,
  "export": {
    "id": "export-uuid",
    "format": "csv",
    "status": "completed",
    "fileSize": 12345,
    "recordCount": 100,
    "downloadUrl": "https://...",
    "expiresAt": "2025-01-02T12:00:00Z",
    "createdAt": "2025-01-01T12:00:00Z",
    "completedAt": "2025-01-01T12:01:00Z"
  }
}
```

**Response (202):**
```json
{
  "status": "processing",
  "message": "Export is still processing"
}
```

**Errors:**
- `401`: Unauthorized
- `404`: Export not found
- `410`: Export has expired
- `500`: Export failed

## Usage Examples

### Export to CSV

```typescript
const response = await fetch('/api/exports/csv', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    clientId: 'client-uuid',
    dateFrom: '2025-01-01',
    dateTo: '2025-01-31',
    platform: 'meta',
  }),
});

const { export: exportData } = await response.json();
console.log('Download URL:', exportData.downloadUrl);
```

### Export to JSON

```typescript
const response = await fetch('/api/exports/json', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    clientId: 'client-uuid',
    dateFrom: '2025-01-01',
    dateTo: '2025-01-31',
    campaignIds: ['campaign-1', 'campaign-2'],
  }),
});

const { export: exportData } = await response.json();
```

### Get Download URL

```typescript
const response = await fetch(`/api/exports/${exportId}/download`);
const { export: exportData } = await response.json();

if (exportData.status === 'completed') {
  window.location.href = exportData.downloadUrl;
}
```

## Security

- All endpoints require authentication
- Users can only export data from clients they have access to
- Export permissions are validated against plan limits
- Download URLs are signed and expire after 24 hours
- Files are automatically cleaned up after expiration

## Cron Job

### GET /api/cron/export-cleanup

Cleans up expired export files. Should be configured in `deploy.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/export-cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

## Requirements Mapping

- **8.1**: CSV export endpoint with permission validation
- **8.2**: JSON export endpoint with permission validation
- **8.4**: Data filtered by retention period
- **8.5**: Temporary files with 24h expiration and download URLs

