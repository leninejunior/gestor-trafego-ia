# Google Ads OAuth Flow Testing Guide

## Overview
This guide provides instructions for testing the complete Google Ads OAuth flow, from initiation through token storage and refresh.

## Quick Start

### 1. Run Automated Tests
```bash
# Run OAuth flow unit tests
npm test -- google-oauth-flow.test.ts

# Run all Google integration tests
npm test -- src/__tests__/integration/google-*.test.ts
```

### 2. Run E2E Test Script
```bash
# Run the end-to-end test script
node scripts/test-oauth-flow-e2e.js
```

This script will:
- ✅ Validate environment variables
- ✅ Check database schema
- ✅ Test OAuth initiation
- ✅ Validate state parameter
- ✅ Test encryption service
- ✅ Provide manual OAuth completion instructions

### 3. Manual Testing

#### Prerequisites
1. Ensure database migrations are applied:
   ```bash
   # Check if migrations are needed
   node scripts/test-oauth-flow-e2e.js
   
   # If needed, apply migrations via Supabase SQL Editor
   # Run: database/migrations/fix-google-ads-schema.sql
   ```

2. Verify environment variables in `.env`:
   ```env
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_DEVELOPER_TOKEN=your_developer_token
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

#### Testing Steps

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Navigate to Google Ads Dashboard**
   - Open: `http://localhost:3000/dashboard/google`
   - Log in if not already authenticated

3. **Initiate OAuth Flow**
   - Click "Connect Google Ads" button
   - Verify redirect to Google consent screen
   - Check browser console for any errors

4. **Complete Google Authorization**
   - Sign in with Google account (if needed)
   - Review requested permissions:
     - Access to Google Ads data
     - Offline access (for refresh tokens)
   - Click "Allow" to grant permissions

5. **Verify Callback Processing**
   - Should redirect back to application
   - Check for success message
   - Verify no error messages in console
   - Should redirect to account selection page

6. **Select Google Ads Accounts**
   - View list of accessible accounts
   - Select one or more accounts
   - Click "Save" or "Connect"
   - Verify success message

7. **Verify Database Records**
   ```sql
   -- Check oauth_states (should have recent entry)
   SELECT * FROM oauth_states 
   WHERE provider = 'google' 
   ORDER BY created_at DESC 
   LIMIT 5;

   -- Check connections (should have new active connection)
   SELECT id, client_id, customer_id, status, created_at 
   FROM google_ads_connections 
   WHERE status = 'active'
   ORDER BY created_at DESC 
   LIMIT 5;

   -- Check tokens are encrypted (should not be plain text)
   SELECT id, 
          LEFT(access_token, 20) as token_preview,
          LENGTH(access_token) as token_length,
          status
   FROM google_ads_connections 
   ORDER BY created_at DESC 
   LIMIT 1;

   -- Check audit log (should have OAuth events)
   SELECT id, operation, success, metadata, created_at 
   FROM google_ads_audit_log 
   WHERE operation IN ('token_encrypt', 'token_decrypt', 'token_refresh')
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

## Test Scenarios

### Scenario 1: First-Time Connection
**Goal**: Test OAuth flow for a new user/client

**Steps**:
1. Use a client that has never connected Google Ads
2. Initiate OAuth flow
3. Complete authorization
4. Select accounts
5. Verify connection created

**Expected Results**:
- ✅ OAuth state created in database
- ✅ Tokens encrypted and stored
- ✅ Connection status = 'active'
- ✅ Audit log shows successful operations

### Scenario 2: Reconnection
**Goal**: Test OAuth flow for existing connection

**Steps**:
1. Disconnect existing Google Ads connection
2. Initiate OAuth flow again
3. Complete authorization
4. Select same accounts

**Expected Results**:
- ✅ Old connection marked as inactive
- ✅ New connection created
- ✅ New tokens stored
- ✅ No duplicate connections

### Scenario 3: Multiple Accounts
**Goal**: Test selecting multiple Google Ads accounts

**Steps**:
1. Use Google account with multiple Ads accounts
2. Complete OAuth flow
3. Select multiple accounts from list
4. Save selection

**Expected Results**:
- ✅ Multiple connections created
- ✅ Each connection has unique customer_id
- ✅ All connections active
- ✅ Tokens encrypted for each

### Scenario 4: Error Handling
**Goal**: Test error scenarios

**Test Cases**:
- User denies authorization
- Invalid state parameter
- Expired state parameter
- Network errors during token exchange

**Expected Results**:
- ✅ Graceful error messages
- ✅ User redirected to error page
- ✅ No partial data in database
- ✅ Audit log shows failures

### Scenario 5: Token Refresh
**Goal**: Test automatic token refresh

**Steps**:
1. Create connection with expired token
2. Trigger API call that requires token
3. Verify automatic refresh

**Expected Results**:
- ✅ Token refresh attempted
- ✅ New token stored
- ✅ API call succeeds
- ✅ Audit log shows refresh

## Troubleshooting

### Issue: "User not authenticated"
**Solution**: Ensure you're logged in to the application before initiating OAuth

### Issue: "State not found" or "Invalid state"
**Solution**: 
- Check oauth_states table exists
- Verify state hasn't expired (10 minute timeout)
- Clear browser cookies and try again

### Issue: "Database schema not ready"
**Solution**: Run database migrations:
```bash
# Apply migrations via Supabase SQL Editor
# File: database/migrations/fix-google-ads-schema.sql
```

### Issue: "Encryption failed"
**Solution**:
- Check google_ads_encryption_keys table has required columns
- Verify GOOGLE_TOKEN_ENCRYPTION_KEY is set (optional)
- Check crypto service initialization logs

### Issue: "No accounts found"
**Solution**:
- Verify Google account has access to Google Ads accounts
- Check Google Ads API permissions
- Verify developer token is valid

## Monitoring

### Key Metrics to Monitor
1. **OAuth Success Rate**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE success = true) as successful,
     COUNT(*) FILTER (WHERE success = false) as failed,
     COUNT(*) as total
   FROM google_ads_audit_log
   WHERE operation = 'oauth_callback'
   AND created_at > NOW() - INTERVAL '24 hours';
   ```

2. **Token Refresh Success Rate**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE success = true) as successful,
     COUNT(*) FILTER (WHERE success = false) as failed,
     COUNT(*) as total
   FROM google_ads_audit_log
   WHERE operation = 'token_refresh'
   AND created_at > NOW() - INTERVAL '24 hours';
   ```

3. **Active Connections**
   ```sql
   SELECT 
     status,
     COUNT(*) as count
   FROM google_ads_connections
   GROUP BY status;
   ```

### Logs to Check
1. **Application Logs**
   - Look for `[Google Auth Simple]` prefix
   - Look for `[Google Callback]` prefix
   - Look for `[Token Manager]` prefix
   - Look for `[Crypto Service]` prefix

2. **Browser Console**
   - Check for JavaScript errors
   - Verify API responses
   - Check network tab for failed requests

3. **Database Audit Log**
   ```sql
   SELECT * FROM google_ads_audit_log
   WHERE created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;
   ```

## Security Checklist

- [ ] State parameter is validated
- [ ] State expires after 10 minutes
- [ ] Tokens are encrypted at rest
- [ ] User authentication required
- [ ] Client ownership validated
- [ ] HTTPS used in production
- [ ] Audit log captures all operations
- [ ] No tokens in application logs
- [ ] No sensitive data in error messages

## Performance Checklist

- [ ] OAuth initiation < 500ms
- [ ] Callback processing < 2s
- [ ] Token encryption < 100ms
- [ ] Token decryption < 100ms
- [ ] Account list retrieval < 3s
- [ ] Database queries optimized
- [ ] Proper indexes on tables

## Compliance Checklist

- [ ] User consent obtained
- [ ] Privacy policy updated
- [ ] Terms of service updated
- [ ] Data retention policy defined
- [ ] Token rotation schedule defined
- [ ] Audit log retention defined
- [ ] GDPR compliance verified (if applicable)

## Next Steps

After successful OAuth flow testing:

1. **Test Token Refresh**
   - Wait for token to expire (or manually expire)
   - Trigger API call
   - Verify automatic refresh

2. **Test Campaign Sync**
   - Initiate campaign sync
   - Verify campaigns fetched
   - Check metrics collected

3. **Test Disconnection**
   - Disconnect Google Ads
   - Verify connection marked inactive
   - Verify tokens removed/invalidated

4. **Load Testing**
   - Test multiple concurrent OAuth flows
   - Test token refresh under load
   - Monitor performance metrics

## Resources

- **OAuth Flow Diagram**: See `OAUTH_FLOW_DIAGRAM.md`
- **Database Schema**: See `database/google-ads-schema.sql`
- **API Documentation**: See `docs/GOOGLE_ADS_README.md`
- **Troubleshooting**: See `docs/GOOGLE_ADS_TROUBLESHOOTING.md`

## Support

If you encounter issues:
1. Check this guide's troubleshooting section
2. Review application logs
3. Check database audit log
4. Run the e2e test script for diagnostics
5. Consult the team documentation

---

**Last Updated**: 2024-11-24
**Version**: 1.0
**Status**: Complete
