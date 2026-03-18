# Quick Start: Google Ads Token Manager

## 🚀 5-Minute Setup

### 1. Configure Environment

```bash
# Generate encryption key
openssl rand -base64 32

# Add to .env
GOOGLE_TOKEN_ENCRYPTION_KEY=your_generated_key_here
```

### 2. Basic Usage

```typescript
import { getGoogleTokenManager } from '@/lib/google/token-manager';

const tokenManager = getGoogleTokenManager();

// Get valid token (auto-refresh if needed)
const accessToken = await tokenManager.ensureValidToken(connectionId);
```

### 3. Save Tokens After OAuth

```typescript
import { getGoogleOAuthService } from '@/lib/google/oauth';
import { getGoogleTokenManager } from '@/lib/google/token-manager';

// Exchange code for tokens
const oauthService = getGoogleOAuthService();
const tokens = await oauthService.exchangeCodeForTokens(code);

// Save encrypted tokens
const tokenManager = getGoogleTokenManager();
await tokenManager.saveTokens(connectionId, tokens);
```

## 📖 Common Patterns

### Pattern 1: API Call with Auto-Refresh

```typescript
async function makeGoogleAdsApiCall(connectionId: string) {
  const tokenManager = getGoogleTokenManager();
  
  // Automatically refreshes if expired
  const accessToken = await tokenManager.ensureValidToken(connectionId);
  
  // Make API call
  const response = await fetch('https://googleads.googleapis.com/...', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  return response.json();
}
```

### Pattern 2: Get Token for Client

```typescript
async function syncClientCampaigns(clientId: string) {
  const tokenManager = getGoogleTokenManager();
  
  // Finds active connection and ensures valid token
  const { accessToken, customerId } = 
    await tokenManager.ensureValidTokenForClient(clientId);
  
  // Use token and customer ID
  const campaigns = await googleAdsClient.getCampaigns(
    accessToken,
    customerId
  );
  
  return campaigns;
}
```

### Pattern 3: Handle Token Refresh Failure

```typescript
async function handleApiCall(connectionId: string) {
  const tokenManager = getGoogleTokenManager();
  
  try {
    const accessToken = await tokenManager.ensureValidToken(connectionId);
    // Make API call
  } catch (error) {
    // Token refresh failed - connection marked as expired
    // Show user-friendly message
    return {
      error: 'Sua conexão com o Google Ads expirou. Por favor, reconecte sua conta.',
      needsReconnect: true,
    };
  }
}
```

### Pattern 4: Revoke Connection

```typescript
async function disconnectGoogleAds(connectionId: string) {
  const tokenManager = getGoogleTokenManager();
  
  // Revokes tokens with Google and marks as revoked
  await tokenManager.revokeTokens(connectionId);
  
  return { success: true };
}
```

## 🔧 API Routes Examples

### Save Tokens (OAuth Callback)

```typescript
// app/api/google/callback/route.ts
import { getGoogleOAuthService } from '@/lib/google/oauth';
import { getGoogleTokenManager } from '@/lib/google/token-manager';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  
  // Exchange code for tokens
  const oauthService = getGoogleOAuthService();
  const tokens = await oauthService.exchangeCodeForTokens(code);
  
  // Save encrypted tokens
  const tokenManager = getGoogleTokenManager();
  await tokenManager.saveTokens(connectionId, tokens);
  
  return Response.json({ success: true });
}
```

### Get Campaigns (with Auto-Refresh)

```typescript
// app/api/google/campaigns/route.ts
import { getGoogleTokenManager } from '@/lib/google/token-manager';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  
  try {
    const tokenManager = getGoogleTokenManager();
    
    // Get valid token for client
    const { accessToken, customerId } = 
      await tokenManager.ensureValidTokenForClient(clientId);
    
    // Fetch campaigns
    const campaigns = await fetchCampaigns(accessToken, customerId);
    
    return Response.json({ campaigns });
  } catch (error) {
    return Response.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}
```

## ⚠️ Important Notes

### Production Checklist

- [ ] Set `GOOGLE_TOKEN_ENCRYPTION_KEY` in production
- [ ] Use strong random key (32+ bytes)
- [ ] Never commit encryption key to git
- [ ] Monitor token refresh failures
- [ ] Set up alerts for expired connections

### Security

- ✅ Tokens encrypted at rest
- ✅ Tokens never logged
- ✅ Tokens never sent to frontend
- ✅ RLS policies enforce isolation
- ✅ Automatic refresh prevents exposure

### Performance

- Tokens cached in database
- Only refresh when expired (5 min buffer)
- Batch operations available for cron jobs
- No unnecessary API calls

## 🐛 Troubleshooting

### Issue: "Connection not found"

```typescript
// Check connection exists and is active
const supabase = createServiceClient();
const { data } = await supabase
  .from('google_ads_connections')
  .select('*')
  .eq('id', connectionId)
  .single();

console.log('Connection:', data);
```

### Issue: Token refresh fails

```typescript
// Check OAuth credentials
console.log('Client ID:', process.env.GOOGLE_CLIENT_ID);
console.log('Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Missing');

// Test OAuth service
const oauthService = getGoogleOAuthService();
const config = oauthService.getConfig();
console.log('OAuth Config:', config);
```

### Issue: Encryption fails

```typescript
// Test encryption
const tokenManager = getGoogleTokenManager();
const isWorking = await tokenManager.testEncryption();
console.log('Encryption working:', isWorking);

// Check encryption key
console.log('Encryption key set:', 
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ? 'Yes' : 'No'
);
```

## 📚 Full Documentation

For complete documentation, see:
- [Token Manager README](./README-token-manager.md)
- [OAuth Service README](./README-oauth.md)
- [Database Schema](../../database/google-ads-schema.sql)

## 🎯 Next Steps

1. ✅ Token Manager implemented
2. ➡️ Implement Google Ads Repository (Task 2.4)
3. ➡️ Implement Sync Service (Task 3.1)
4. ➡️ Create API Routes (Task 4.x)
