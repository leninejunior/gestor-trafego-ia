# Quick Start Guide - Hybrid Data Insights API

## 🚀 Getting Started

The Hybrid Data Insights API provides intelligent access to campaign data by combining cached historical data with real-time API data.

## 📋 Prerequisites

1. **Authentication**: You need a valid Supabase session
2. **Client Access**: You must be a member of the client's organization
3. **Active Plan**: Your plan must allow the requested data retention period

## 🎯 Common Use Cases

### 1. Get All Campaigns for a Client

Retrieve all campaign data for the last 30 days:

```bash
curl -X GET "https://your-domain.com/api/insights/campaigns?client_id=abc123&date_from=2025-01-01&date_to=2025-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Get Meta Ads Campaigns Only

Filter by platform:

```bash
curl -X GET "https://your-domain.com/api/insights/campaigns?client_id=abc123&platform=meta&date_from=2025-01-01&date_to=2025-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Get Specific Campaigns

Filter by campaign IDs:

```bash
curl -X GET "https://your-domain.com/api/insights/campaigns?client_id=abc123&campaign_ids=camp1,camp2,camp3&date_from=2025-01-01&date_to=2025-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Get Single Campaign Details

Get detailed breakdown for one campaign:

```bash
curl -X GET "https://your-domain.com/api/insights/campaigns/camp_123?client_id=abc123&platform=meta&date_from=2025-01-01&date_to=2025-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Force Cache Mode (Faster)

Skip API calls and use cache only:

```bash
curl -X GET "https://your-domain.com/api/insights/campaigns?client_id=abc123&date_from=2025-01-01&date_to=2025-01-31&force_cache=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. Paginated Results

Get results in pages:

```bash
# First page (20 records)
curl -X GET "https://your-domain.com/api/insights/campaigns?client_id=abc123&date_from=2025-01-01&date_to=2025-01-31&limit=20&offset=0" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Second page (next 20 records)
curl -X GET "https://your-domain.com/api/insights/campaigns?client_id=abc123&date_from=2025-01-01&date_to=2025-01-31&limit=20&offset=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📊 Understanding the Response

### Data Source Indicators

The `metadata.source` field tells you where the data came from:

- **`cache`**: All data from historical cache (fast, may be slightly outdated)
- **`api`**: All data from platform API (fresh, slower)
- **`hybrid`**: Mix of cache (old data) and API (recent data)

### API Status

The `metadata.api_status` field indicates API health:

- **`success`**: API calls worked perfectly
- **`failed`**: API unavailable, using cache fallback
- **`partial`**: Some API calls failed (in hybrid mode)

### Cache Hit Rate

The `metadata.cache_hit_rate` shows the percentage of data from cache:

- **`1.0`**: 100% from cache (fastest)
- **`0.5`**: 50% from cache, 50% from API
- **`0.0`**: 0% from cache, 100% from API (slowest)

## 🎨 Frontend Integration Examples

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

interface CampaignInsight {
  id: string;
  campaign_name: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  // ... other fields
}

export function useCampaignInsights(
  clientId: string,
  dateFrom: string,
  dateTo: string,
  platform?: string
) {
  const [data, setData] = useState<CampaignInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        const params = new URLSearchParams({
          client_id: clientId,
          date_from: dateFrom,
          date_to: dateTo,
        });
        
        if (platform) {
          params.append('platform', platform);
        }

        const response = await fetch(`/api/insights/campaigns?${params}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch insights');
        }

        const result = await response.json();
        setData(result.data);
        setMetadata(result.metadata);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [clientId, dateFrom, dateTo, platform]);

  return { data, loading, error, metadata };
}
```

### Usage in Component

```typescript
function CampaignDashboard({ clientId }: { clientId: string }) {
  const { data, loading, error, metadata } = useCampaignInsights(
    clientId,
    '2025-01-01',
    '2025-01-31',
    'meta'
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Campaign Insights</h2>
      
      {/* Data source indicator */}
      <div className="metadata">
        <span>Source: {metadata.source}</span>
        <span>Cache Hit Rate: {(metadata.cache_hit_rate * 100).toFixed(0)}%</span>
        {metadata.fallback_used && (
          <span className="warning">Using fallback data</span>
        )}
      </div>

      {/* Campaign list */}
      <table>
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Date</th>
            <th>Impressions</th>
            <th>Clicks</th>
            <th>Spend</th>
          </tr>
        </thead>
        <tbody>
          {data.map((insight) => (
            <tr key={insight.id}>
              <td>{insight.campaign_name}</td>
              <td>{new Date(insight.date).toLocaleDateString()}</td>
              <td>{insight.impressions.toLocaleString()}</td>
              <td>{insight.clicks.toLocaleString()}</td>
              <td>${insight.spend.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## ⚡ Performance Tips

### 1. Use Appropriate Date Ranges
```typescript
// ❌ Bad: Requesting too much data
const dateFrom = '2020-01-01'; // 5 years ago!

// ✅ Good: Request only what you need
const dateFrom = '2025-01-01'; // Last month
```

### 2. Use Force Cache for Historical Analysis
```typescript
// When analyzing historical trends, use cache mode
const params = new URLSearchParams({
  client_id: clientId,
  date_from: '2024-01-01',
  date_to: '2024-12-31',
  force_cache: 'true' // Much faster!
});
```

### 3. Filter by Platform When Possible
```typescript
// ❌ Slower: Get all platforms
fetch('/api/insights/campaigns?client_id=abc123&...');

// ✅ Faster: Filter by platform
fetch('/api/insights/campaigns?client_id=abc123&platform=meta&...');
```

### 4. Use Pagination for Large Datasets
```typescript
// ❌ Bad: Get all records at once
fetch('/api/insights/campaigns?client_id=abc123&...');

// ✅ Good: Paginate results
fetch('/api/insights/campaigns?client_id=abc123&limit=50&offset=0&...');
```

## 🔒 Security Best Practices

### 1. Never Expose Tokens
```typescript
// ❌ Bad: Token in URL
const url = `/api/insights/campaigns?token=${token}&...`;

// ✅ Good: Token in header
fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### 2. Validate Client Access
```typescript
// Always verify user has access to the client
async function fetchCampaigns(clientId: string) {
  // The API will check access, but validate on frontend too
  const hasAccess = await checkClientAccess(clientId);
  if (!hasAccess) {
    throw new Error('Access denied');
  }
  
  return fetch(`/api/insights/campaigns?client_id=${clientId}&...`);
}
```

### 3. Handle Plan Limits Gracefully
```typescript
async function fetchCampaigns(clientId: string, days: number) {
  try {
    const response = await fetch(`/api/insights/campaigns?...`);
    
    if (response.status === 403) {
      const error = await response.json();
      if (error.error === 'Data retention limit exceeded') {
        // Show upgrade prompt
        showUpgradeModal(error.details);
        return;
      }
    }
    
    // Handle success...
  } catch (error) {
    // Handle error...
  }
}
```

## 🐛 Troubleshooting

### Error: "Data retention limit exceeded"
**Solution**: Your plan doesn't allow access to that many days of historical data. Either:
1. Reduce the date range
2. Upgrade your plan

### Error: "Client not found"
**Solution**: Check that:
1. The client ID is correct
2. You have access to the client
3. The client exists in the database

### Error: "Unauthorized"
**Solution**: Your session has expired. Re-authenticate.

### Slow Response Times
**Solution**: Try:
1. Using `force_cache=true` for historical data
2. Reducing the date range
3. Adding platform filter
4. Using pagination

### Empty Results
**Solution**: Check that:
1. The client has campaigns in the date range
2. The platform filter is correct
3. Data has been synced to cache

## 📚 Additional Resources

- [Full API Documentation](./README.md)
- [Hybrid Data Service Documentation](../../lib/services/README-hybrid-data.md)
- [Plan Configuration Guide](../../lib/services/README-plan-configuration.md)
- [Cache Feature Gate Guide](../../lib/services/README-cache-feature-gate.md)

## 🆘 Need Help?

If you encounter issues:
1. Check the API documentation
2. Review error messages carefully
3. Verify your plan limits
4. Check database connectivity
5. Review server logs

## 🎉 You're Ready!

You now have everything you need to integrate the Hybrid Data Insights API into your application. Start with simple queries and gradually add more filters and features as needed.

Happy coding! 🚀
