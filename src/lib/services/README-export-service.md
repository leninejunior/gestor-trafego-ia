# Export Service

Service for exporting campaign insights data with plan-based permissions.

## Features

- **CSV Export**: Export data in CSV format with proper escaping
- **JSON Export**: Export data in structured JSON format
- **Permission Validation**: Check plan limits before allowing exports
- **Temporary Storage**: Files stored with 24-hour expiration
- **Retention Compliance**: Only exports data within plan retention period

## Usage

```typescript
import { ExportService } from '@/lib/services/export-service';

const exportService = new ExportService();

// Export to CSV
const csvResult = await exportService.exportToCSV({
  userId: 'user-id',
  clientId: 'client-id',
  format: 'csv',
  dateFrom: '2025-01-01',
  dateTo: '2025-01-31',
  platform: 'meta',
  campaignIds: ['campaign-1', 'campaign-2'],
});

// Export to JSON
const jsonResult = await exportService.exportToJSON({
  userId: 'user-id',
  clientId: 'client-id',
  format: 'json',
  dateFrom: '2025-01-01',
  dateTo: '2025-01-31',
});

// Get download URL
const downloadUrl = await exportService.getDownloadUrl(
  csvResult.id,
  'user-id'
);

// Check permissions
const canExportCSV = await exportService.validatePermissions(
  'user-id',
  'csv'
);
```

## Export Flow

1. **Validate Permissions**: Check if user's plan allows the export format
2. **Create Job**: Create export job record with pending status
3. **Fetch Data**: Query campaign insights within retention period
4. **Generate File**: Create CSV or JSON content
5. **Store File**: Upload to Supabase Storage with 24h expiration
6. **Complete Job**: Update job status and return download URL

## Database Schema

```sql
CREATE TABLE export_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  format VARCHAR(10) NOT NULL CHECK (format IN ('csv', 'json')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  file_path TEXT,
  file_size INTEGER,
  record_count INTEGER,
  error_message TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

## Storage Bucket

- **Bucket Name**: `exports`
- **File Path**: `{user_id}/export-{job_id}.{format}`
- **Expiration**: 24 hours
- **Access**: Signed URLs only

## Error Handling

- `CSV export not allowed for current plan`: Plan doesn't include CSV export
- `JSON export not allowed for current plan`: Plan doesn't include JSON export
- `Data retention limit exceeded`: Requested date range exceeds plan retention
- `Failed to create export job`: Database error creating job
- `Failed to fetch export data`: Error querying campaign insights
- `Failed to upload export file`: Storage upload error
- `Failed to generate download URL`: Signed URL generation error

## Requirements Mapping

- **8.1**: Export to CSV with permission validation
- **8.2**: Export to JSON with permission validation
- **8.4**: Include only data within retention period
- **8.5**: Generate temporary file with 24h expiration and download link
