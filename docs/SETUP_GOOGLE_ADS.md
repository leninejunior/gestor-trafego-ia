# Google Ads Integration Setup Guide

This guide walks you through setting up the Google Ads integration for the Ads Manager system.

## Prerequisites

- Active Google Ads account
- Google Cloud Console project
- Supabase project with admin access
- Node.js and npm/pnpm installed

## Step 1: Google Cloud Console Setup

### 1.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID

### 1.2 Enable Google Ads API

1. Navigate to **APIs & Services** > **Library**
2. Search for "Google Ads API"
3. Click **Enable**

### 1.3 Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Configure the OAuth consent screen if prompted:
   - User Type: External (for testing) or Internal (for organization)
   - App name: Your app name
   - User support email: Your email
   - Developer contact: Your email
4. Application type: **Web application**
5. Name: "Ads Manager - Google Ads Integration"
6. Authorized redirect URIs:
   - Development: `http://localhost:3000/api/google/callback`
   - Production: `https://your-domain.com/api/google/callback`
7. Click **Create**
8. Save the **Client ID** and **Client Secret**

### 1.4 Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Add the following scopes:
   - `https://www.googleapis.com/auth/adwords`
3. Add test users if using External user type
4. Save changes

## Step 2: Google Ads API Setup

### 2.1 Get Developer Token

1. Sign in to your [Google Ads account](https://ads.google.com/)
2. Click the tools icon in the top right
3. Under **Setup**, click **API Center**
4. Apply for a developer token if you don't have one
5. Note: Basic access is sufficient for testing
6. Copy your **Developer Token**

### 2.2 Configure API Access

1. Ensure your Google Ads account has API access enabled
2. Note your **Customer ID** (10-digit number, format: XXX-XXX-XXXX)
3. Remove hyphens when using in API calls

## Step 3: Database Setup

### 3.1 Apply Google Ads Schema

Run the schema application script:

```bash
# Using Node.js
node scripts/apply-google-ads-schema.js

# Or manually via Supabase SQL Editor
# Copy contents of database/google-ads-schema.sql
# Paste into SQL Editor and execute
```

### 3.2 Verify Tables Created

Check that the following tables exist:
- `google_ads_connections`
- `google_ads_campaigns`
- `google_ads_metrics`
- `google_ads_sync_logs`

### 3.3 Verify RLS Policies

Ensure Row Level Security policies are active:

```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 'google_ads_%';
```

## Step 4: Environment Configuration

### 4.1 Update .env File

Add the following variables to your `.env` file:

```env
# Google Ads API Configuration
GOOGLE_CLIENT_ID=your_client_id_from_step_1.3
GOOGLE_CLIENT_SECRET=your_client_secret_from_step_1.3
GOOGLE_DEVELOPER_TOKEN=your_developer_token_from_step_2.1
```

### 4.2 Production Environment

For production (Vercel):

1. Go to Vercel Dashboard > Your Project > Settings > Environment Variables
2. Add the same three variables
3. Set them for Production, Preview, and Development environments
4. Redeploy your application

## Step 5: Testing the Integration

### 5.1 Test OAuth Flow

1. Start your development server:
   ```bash
   pnpm dev
   ```

2. Navigate to a client page in your dashboard
3. Click "Connect Google Ads"
4. You should be redirected to Google OAuth consent screen
5. Grant permissions
6. You should be redirected back with a success message

### 5.2 Verify Connection

Check the database:

```sql
SELECT * FROM google_ads_connections WHERE status = 'active';
```

### 5.3 Test Sync

Trigger a manual sync:

```bash
# Via API endpoint
curl -X POST http://localhost:3000/api/google/sync \
  -H "Content-Type: application/json" \
  -d '{"clientId": "your-client-uuid"}'
```

Check sync logs:

```sql
SELECT * FROM google_ads_sync_logs ORDER BY created_at DESC LIMIT 10;
```

## Step 6: Troubleshooting

### Common Issues

#### "Invalid OAuth credentials"
- Verify Client ID and Secret are correct
- Check redirect URI matches exactly (including protocol and port)
- Ensure OAuth consent screen is configured

#### "Developer token invalid"
- Verify token is copied correctly (no extra spaces)
- Check token status in Google Ads API Center
- Ensure account has API access enabled

#### "Permission denied" errors
- Verify RLS policies are applied correctly
- Check user has access to the client
- Ensure organization_memberships table is populated

#### "Rate limit exceeded"
- Google Ads API has rate limits
- Implement exponential backoff (already in sync service)
- Consider reducing sync frequency

### Debug Mode

Enable debug logging:

```env
# Add to .env
DEBUG=google:*
```

Check application logs for detailed error messages.

## Step 7: Production Checklist

Before going to production:

- [ ] OAuth credentials configured for production domain
- [ ] Redirect URIs updated in Google Cloud Console
- [ ] Environment variables set in Vercel
- [ ] Database schema applied to production
- [ ] RLS policies verified
- [ ] Test OAuth flow in production
- [ ] Test sync with real data
- [ ] Monitor sync logs for errors
- [ ] Set up alerting for failed syncs

## API Scopes Required

The integration requires the following OAuth scopes:

- `https://www.googleapis.com/auth/adwords` - Full access to Google Ads API

## Rate Limits

Google Ads API has the following limits:

- **Basic Access**: 15,000 operations per day
- **Standard Access**: Higher limits (requires approval)
- **Rate limiting**: Automatic exponential backoff implemented

## Security Considerations

1. **Token Storage**: Tokens are encrypted before storage
2. **RLS Policies**: Ensure client data isolation
3. **Service Role Key**: Never expose in frontend code
4. **OAuth State**: Validated to prevent CSRF attacks
5. **HTTPS Only**: Always use HTTPS in production

## Support Resources

- [Google Ads API Documentation](https://developers.google.com/google-ads/api/docs/start)
- [OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Google Ads API Forum](https://groups.google.com/g/adwords-api)
- [Supabase Documentation](https://supabase.com/docs)

## Next Steps

After setup is complete:

1. Implement Google Ads Client service (Task 2.1)
2. Create OAuth service (Task 2.2)
3. Build sync service (Task 3.1)
4. Develop UI components (Task 6)
5. Create unified dashboard (Task 8)

## Maintenance

### Token Refresh

Tokens are automatically refreshed when they expire. Monitor refresh failures:

```sql
SELECT * FROM google_ads_sync_logs 
WHERE error_code = 'AUTHENTICATION_ERROR' 
ORDER BY created_at DESC;
```

### Data Cleanup

Old sync logs are automatically cleaned up based on retention policy. Configure in:

```sql
-- Adjust retention period (default: 90 days)
DELETE FROM google_ads_sync_logs 
WHERE created_at < NOW() - INTERVAL '90 days';
```

### Monitoring

Key metrics to monitor:

- Sync success rate
- Token refresh failures
- API error rates
- Sync duration
- Data freshness

## Contact

For issues or questions:
- Check troubleshooting section above
- Review application logs
- Contact development team
