const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ADS_BASE = 'https://googleads.googleapis.com/v22';

function readTokenExpiry(connection) {
  const raw = connection?.token_expires_at || connection?.expires_at || null;
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function tokenNeedsRefresh(connection) {
  const expiry = readTokenExpiry(connection);
  if (!expiry) return true;
  return Date.now() >= expiry.getTime() - 5 * 60 * 1000;
}

async function refreshGoogleAccessToken(connection, supabase) {
  const refreshToken = connection.refresh_token;
  if (!refreshToken) {
    throw new Error('Google refresh token not available.');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not configured.');
  }

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }).toString()
  });

  const payload = await response.json().catch(async () => ({
    error_description: await response.text()
  }));

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || `Google token refresh failed (${response.status})`);
  }

  const expiresIn = Number(payload.expires_in || 3600);
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { error } = await supabase
    .from('google_ads_connections')
    .update({
      access_token: payload.access_token,
      token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString()
    })
    .eq('id', connection.id);

  if (error) {
    throw new Error(`Failed to persist refreshed Google token: ${error.message}`);
  }

  return payload.access_token;
}

async function googleMutate({ customerId, accessToken, developerToken, loginCustomerId, entityPath, operations }) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json'
  };

  if (loginCustomerId) {
    headers['login-customer-id'] = loginCustomerId;
  }

  const response = await fetch(`${GOOGLE_ADS_BASE}/customers/${customerId}/${entityPath}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ operations })
  });

  const payload = await response.json().catch(async () => ({
    error: { message: await response.text() }
  }));

  if (!response.ok || payload?.error) {
    const message = payload?.error?.message || `Google Ads mutate failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

function getLandingUrl(run, appDashboardUrl) {
  return run?.publicationConfig?.google?.landingUrl || appDashboardUrl || 'https://example.com';
}

function getHeadlines(run) {
  const copyAsset = run?.creativeBatch?.assets?.find((asset) => asset.type === 'copy');
  const base = copyAsset?.content || run?.campaignName || 'Campanha';
  return [
    { text: base.slice(0, 30) || 'Solução de Performance' },
    { text: 'Escala com previsibilidade' },
    { text: 'Fale com especialistas' }
  ];
}

function getDescriptions(run) {
  const copyAsset = run?.creativeBatch?.assets?.find((asset) => asset.type === 'copy');
  const base = copyAsset?.content || 'Otimize campanhas com foco em resultado.';
  return [
    { text: base.slice(0, 90) },
    { text: 'Planejamento, criativos e execução em um fluxo único.' }
  ];
}

async function publishToGoogle({ run, supabase, appDashboardUrl }) {
  if (!supabase) {
    throw new Error('Supabase not configured for Google publisher.');
  }

  const { data: connection, error: connectionError } = await supabase
    .from('google_ads_connections')
    .select('id, customer_id, access_token, refresh_token, token_expires_at, expires_at, status')
    .eq('client_id', run.clientId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (connectionError) {
    throw new Error(`Failed to fetch Google connection: ${connectionError.message}`);
  }

  if (!connection?.customer_id) {
    throw new Error('No active Google connection/customer for this client.');
  }

  const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error('GOOGLE_DEVELOPER_TOKEN not configured.');
  }

  let accessToken = connection.access_token;
  if (!accessToken || tokenNeedsRefresh(connection)) {
    accessToken = await refreshGoogleAccessToken(connection, supabase);
  }

  if (!accessToken) {
    throw new Error('No valid Google access token available.');
  }

  const customerId = String(connection.customer_id).replace(/\D/g, '');
  const loginCustomerId = process.env.GOOGLE_LOGIN_CUSTOMER_ID || undefined;

  const budgetMicros = Math.max(1000000, Math.round(Number(run?.budget?.amount || 0) * 1000000));

  const budgetResponse = await googleMutate({
    customerId,
    accessToken,
    developerToken,
    loginCustomerId,
    entityPath: 'campaignBudgets:mutate',
    operations: [
      {
        create: {
          name: `${run.campaignName} Budget`,
          amountMicros: String(budgetMicros),
          deliveryMethod: 'STANDARD'
        }
      }
    ]
  });

  const budgetResourceName = budgetResponse?.results?.[0]?.resourceName;
  if (!budgetResourceName) {
    throw new Error('Google budget resource name not returned.');
  }

  const campaignResponse = await googleMutate({
    customerId,
    accessToken,
    developerToken,
    loginCustomerId,
    entityPath: 'campaigns:mutate',
    operations: [
      {
        create: {
          name: run.campaignName,
          advertisingChannelType: 'SEARCH',
          status: 'PAUSED',
          campaignBudget: budgetResourceName,
          manualCpc: {}
        }
      }
    ]
  });

  const campaignResourceName = campaignResponse?.results?.[0]?.resourceName;
  if (!campaignResourceName) {
    throw new Error('Google campaign resource name not returned.');
  }

  const adGroupResponse = await googleMutate({
    customerId,
    accessToken,
    developerToken,
    loginCustomerId,
    entityPath: 'adGroups:mutate',
    operations: [
      {
        create: {
          name: `${run.campaignName} Ad Group`,
          campaign: campaignResourceName,
          status: 'PAUSED',
          type: 'SEARCH_STANDARD',
          cpcBidMicros: String(Math.max(100000, Math.round(budgetMicros / 30)))
        }
      }
    ]
  });

  const adGroupResourceName = adGroupResponse?.results?.[0]?.resourceName;
  if (!adGroupResourceName) {
    throw new Error('Google ad group resource name not returned.');
  }

  const adResponse = await googleMutate({
    customerId,
    accessToken,
    developerToken,
    loginCustomerId,
    entityPath: 'adGroupAds:mutate',
    operations: [
      {
        create: {
          adGroup: adGroupResourceName,
          status: 'PAUSED',
          ad: {
            finalUrls: [getLandingUrl(run, appDashboardUrl)],
            responsiveSearchAd: {
              headlines: getHeadlines(run),
              descriptions: getDescriptions(run)
            }
          }
        }
      }
    ]
  });

  const adResourceName = adResponse?.results?.[0]?.resourceName;
  if (!adResourceName) {
    throw new Error('Google ad resource name not returned.');
  }

  return {
    channel: 'google',
    success: true,
    connectionId: connection.id,
    externalIds: {
      campaignBudget: budgetResourceName,
      campaign: campaignResourceName,
      adGroup: adGroupResourceName,
      ad: adResourceName
    }
  };
}

module.exports = {
  publishToGoogle
};

