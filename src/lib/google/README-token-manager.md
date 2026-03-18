# Google Ads Token Manager

## Overview

The Google Ads Token Manager handles secure storage, encryption, and automatic refresh of OAuth 2.0 tokens for Google Ads API integration. It ensures tokens are always valid before API calls and provides robust error handling.

## Features

- **Token Encryption**: AES-256-GCM encryption for access and refresh tokens
- **Automatic Refresh**: Tokens are automatically refreshed 5 minutes before expiration
- **Database Integration**: Secure storage in Supabase with RLS policies
- **Error Handling**: Graceful handling of token refresh failures
- **Batch Operations**: Support for refreshing multiple connections

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Token Manager                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Encryption  │  │   Storage    │  │   Refresh    │ │
│  │   (AES-256)  │  │  (Supabase)  │  │   (OAuth)    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Usage

### Basic Usage

```typescript
import { getGoogleTokenManager } from '@/lib/google/token-manager';

const tokenManager = getGoogleTokenManager();

// Ensure valid token before API call
const accessToken = await tokenManager.ensureValidToken(connectionId);

// Use token for API request
const response = await fetch('https://googleads.googleapis.com/...', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
});
```

### Save Tokens After OAuth

```typescript
import { getGoogleTokenManager } from '@/lib/google/token-manager';
import { getGoogleOAuthService } from '@/lib/google/oauth';

const oauthService = getGoogleOAuthService();
const tokenManager = getGoogleTokenManager();

// Exchange code for tokens
const tokens = await oauthService.exchangeCodeForTokens(code);

// Save encrypted tokens to database
await tokenManager.saveTokens(connectionId, tokens);
```

### Get Valid Token for Client

```typescript
import { getGoogleTokenManager } from '@/lib/google/token-manager';

const tokenManager = getGoogleTokenManager();

// Automatically finds active connection and ensures valid token
const { accessToken, connectionId, customerId } = 
  await tokenManager.ensureValidTokenForClient(clientId);
```

### Revoke Tokens

```typescript
import { getGoogleTokenManager } from '@/lib/google/token-manager';

const tokenManager = getGoogleTokenManager();

// Revoke tokens and mark connection as revoked
await tokenManager.revokeTokens(connectionId);
```

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Required for token encryption
GOOGLE_TOKEN_ENCRYPTION_KEY=your_secure_random_key

# Generate a secure key using:
# openssl rand -base64 32
```

### Fallback Behavior

If `GOOGLE_TOKEN_ENCRYPTION_KEY` is not set, the Token Manager will:
1. Try to use `SUPABASE_SERVICE_ROLE_KEY` as fallback
2. Use a hardcoded fallback (NOT SECURE - development only)
3. Log a warning message

**⚠️ IMPORTANT**: Always set `GOOGLE_TOKEN_ENCRYPTION_KEY` in production!

## Token Refresh Strategy

### Automatic Refresh

Tokens are automatically refreshed when:
- Token expires in less than 5 minutes
- `ensureValidToken()` is called with an expired token

### Refresh Buffer

```typescript
// Token expires at: 2024-01-01 12:00:00
// Refresh buffer: 5 minutes
// Token will be refreshed at: 2024-01-01 11:55:00
```

### Error Handling

If token refresh fails:
1. Connection status is marked as `expired`
2. Error is logged with details
3. Exception is thrown to caller
4. User must reconnect their Google Ads account

## Encryption Details

### Algorithm

- **Cipher**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: scrypt
- **IV Length**: 16 bytes (random per encryption)
- **Salt Length**: 32 bytes (random per encryption)
- **Auth Tag**: 16 bytes (for integrity verification)

### Encrypted Token Format

```
[Salt (32 bytes)][IV (16 bytes)][Auth Tag (16 bytes)][Encrypted Data]
                        ↓
              Base64 Encoded String
```

### Security Features

- **Unique IV**: Each encryption uses a new random IV
- **Unique Salt**: Each encryption uses a new random salt
- **Authentication**: GCM mode provides built-in authentication
- **Key Derivation**: scrypt prevents rainbow table attacks

## Database Schema

Tokens are stored in the `google_ads_connections` table:

```sql
CREATE TABLE google_ads_connections (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  customer_id TEXT NOT NULL,
  refresh_token TEXT NOT NULL,  -- encrypted
  access_token TEXT,             -- encrypted
  token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL,          -- 'active', 'expired', 'revoked'
  ...
);
```

## API Reference

### `ensureValidToken(connectionId: string): Promise<string>`

Ensures a valid access token is available. Automatically refreshes if expired.

**Parameters:**
- `connectionId`: UUID of the Google Ads connection

**Returns:**
- Valid access token (decrypted)

**Throws:**
- Error if connection not found
- Error if token refresh fails

### `saveTokens(connectionId: string, tokens: TokenResponse): Promise<void>`

Saves OAuth tokens to database with encryption.

**Parameters:**
- `connectionId`: UUID of the Google Ads connection
- `tokens`: Token response from OAuth service

### `getTokens(connectionId: string): Promise<TokenData | null>`

Retrieves and decrypts tokens from database.

**Parameters:**
- `connectionId`: UUID of the Google Ads connection

**Returns:**
- Decrypted token data or null if not found

### `refreshAccessToken(connectionId: string, refreshToken: string): Promise<TokenUpdateResult>`

Manually refresh access token using refresh token.

**Parameters:**
- `connectionId`: UUID of the Google Ads connection
- `refreshToken`: Refresh token (decrypted)

**Returns:**
- Result object with success status and new token

### `revokeTokens(connectionId: string): Promise<void>`

Revokes tokens with Google and marks connection as revoked.

**Parameters:**
- `connectionId`: UUID of the Google Ads connection

### `getConnectionsNeedingRefresh(): Promise<string[]>`

Gets list of connections that need token refresh.

**Returns:**
- Array of connection IDs expiring in next 10 minutes

### `batchRefreshTokens(connectionIds: string[]): Promise<{successful: string[], failed: string[]}>`

Batch refresh tokens for multiple connections.

**Parameters:**
- `connectionIds`: Array of connection IDs

**Returns:**
- Object with successful and failed connection IDs

## Testing

### Test Encryption

```typescript
import { getGoogleTokenManager } from '@/lib/google/token-manager';

const tokenManager = getGoogleTokenManager();

// Test encryption/decryption
const isWorking = await tokenManager.testEncryption();
console.log('Encryption working:', isWorking);
```

### Integration Test

```typescript
// 1. Save tokens
await tokenManager.saveTokens(connectionId, {
  access_token: 'test_access_token',
  refresh_token: 'test_refresh_token',
  expires_in: 3600,
  token_type: 'Bearer',
  scope: 'https://www.googleapis.com/auth/adwords',
});

// 2. Retrieve tokens
const tokens = await tokenManager.getTokens(connectionId);
console.log('Retrieved tokens:', tokens);

// 3. Ensure valid token
const accessToken = await tokenManager.ensureValidToken(connectionId);
console.log('Valid access token:', accessToken);
```

## Error Scenarios

### Connection Not Found

```typescript
try {
  await tokenManager.ensureValidToken('invalid-id');
} catch (error) {
  // Error: Connection not found or tokens unavailable
}
```

### Token Refresh Failed

```typescript
try {
  await tokenManager.ensureValidToken(connectionId);
} catch (error) {
  // Connection marked as 'expired'
  // User needs to reconnect
}
```

### Encryption Key Missing

```typescript
// Warning logged:
// [Token Manager] GOOGLE_TOKEN_ENCRYPTION_KEY not set. 
// Using fallback (NOT SECURE FOR PRODUCTION)
```

## Best Practices

### 1. Always Use ensureValidToken()

```typescript
// ✅ Good - Automatic refresh
const token = await tokenManager.ensureValidToken(connectionId);

// ❌ Bad - Token might be expired
const tokens = await tokenManager.getTokens(connectionId);
const token = tokens.access_token;
```

### 2. Handle Token Refresh Failures

```typescript
try {
  const token = await tokenManager.ensureValidToken(connectionId);
  // Make API call
} catch (error) {
  // Show user-friendly message
  // Prompt user to reconnect account
}
```

### 3. Use Batch Operations for Multiple Connections

```typescript
// ✅ Good - Batch refresh
const connectionIds = await tokenManager.getConnectionsNeedingRefresh();
const result = await tokenManager.batchRefreshTokens(connectionIds);

// ❌ Bad - Sequential refresh
for (const id of connectionIds) {
  await tokenManager.ensureValidToken(id);
}
```

### 4. Set Encryption Key in Production

```bash
# Generate secure key
openssl rand -base64 32

# Add to .env.production
GOOGLE_TOKEN_ENCRYPTION_KEY=generated_key_here
```

## Monitoring

### Log Messages

The Token Manager logs important events:

```typescript
// Token refresh
[Token Manager] Token expired, refreshing...
[Token Manager] Token refreshed successfully

// Token save
[Token Manager] Tokens saved successfully

// Errors
[Token Manager] Error refreshing token
[Token Manager] Connection marked as expired
```

### Metrics to Track

- Token refresh success rate
- Token refresh latency
- Number of expired connections
- Encryption/decryption errors

## Security Considerations

### Token Storage

- ✅ Tokens encrypted at rest in database
- ✅ Encryption key stored in environment variables
- ✅ Tokens never logged or exposed in responses
- ✅ RLS policies enforce client isolation

### Token Transmission

- ✅ Tokens only transmitted over HTTPS
- ✅ Tokens only used in server-side code
- ✅ Tokens never sent to frontend

### Key Management

- ✅ Use strong random keys (32+ bytes)
- ✅ Rotate keys periodically
- ✅ Store keys in secure environment variables
- ✅ Never commit keys to version control

## Troubleshooting

### Issue: Encryption Test Fails

**Solution:**
1. Check `GOOGLE_TOKEN_ENCRYPTION_KEY` is set
2. Verify key is valid base64 string
3. Check Node.js crypto module is available

### Issue: Token Refresh Fails

**Solution:**
1. Check Google OAuth credentials are correct
2. Verify refresh token is valid
3. Check network connectivity to Google APIs
4. Review Google Ads API quotas

### Issue: Connection Not Found

**Solution:**
1. Verify connection exists in database
2. Check connection belongs to correct client
3. Verify RLS policies allow access

## Related Documentation

- [Google OAuth Service](./README-oauth.md)
- [Google Ads Client](./README-client.md)
- [Database Schema](../../database/google-ads-schema.sql)
- [Google Ads API Documentation](https://developers.google.com/google-ads/api/docs/oauth/overview)
