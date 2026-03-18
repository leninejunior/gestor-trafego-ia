"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { google } from "googleapis";

// --- Funções existentes do Meta Ads ---

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
}

interface MetaAdset {
  id: string;
  name: string;
  status: string;
}

interface MetaAd {
  id: string;
  name: string;
  status: string;
}

interface MetaAPIResponse<T> {
  data: T[];
  error?: { message: string };
}

export async function syncFacebookAdAccount(
  adAccountId: string,
  clientId: string
) {
  const supabase = await createClient();

  // 1. Get the access token for the ad account
  const { data: tokenData, error: tokenError } = await supabase
    .from("oauth_tokens")
    .select("access_token, ad_account_id, org_id")
    .eq("ad_account_id", adAccountId)
    .single();

  if (tokenError || !tokenData) {
    console.error("Token not found:", tokenError);
    return { error: "Access token not found for this ad account." };
  }

  const { access_token, org_id } = tokenData;
  const { data: adAccountProviderId, error: adAccountProviderIdError } = await supabase.from('ad_accounts').select('external_id').eq('id', adAccountId).single();

  if (adAccountProviderIdError || !adAccountProviderId) {
    console.error("Ad account provider ID not found:", adAccountProviderIdError);
    return { error: "Ad account provider ID not found." };
  }

  const ad_account_external_id = adAccountProviderId.external_id;


  try {
    // 2. Fetch Campaigns
    const campaignsUrl = `https://graph.facebook.com/v19.0/act_${ad_account_external_id}/campaigns?fields=id,name,status&access_token=${access_token}`;
    const campaignsRes = await fetch(campaignsUrl);
    const campaignsData: MetaAPIResponse<MetaCampaign> = await campaignsRes.json();
    if (campaignsData.error) throw new Error(campaignsData.error.message);

    const campaignsToUpsert = campaignsData.data.map((c: MetaCampaign) => ({
      client_id: clientId,
      org_id: org_id,
      account_id: adAccountId,
      external_id: c.id,
      name: c.name,
      status: c.status,
    }));

    if (campaignsToUpsert.length > 0) {
        const { error: campaignError } = await supabase.from('meta_campaigns').upsert(campaignsToUpsert, { onConflict: 'external_id,account_id' });
        if (campaignError) throw campaignError;
    }

    // 3. Fetch Ad Sets for each campaign
    for (const campaign of campaignsData.data) {
        const adsetsUrl = `https://graph.facebook.com/v19.0/${campaign.id}/adsets?fields=id,name,status&access_token=${access_token}`;
        const adsetsRes = await fetch(adsetsUrl);
        const adsetsData: MetaAPIResponse<MetaAdset> = await adsetsRes.json();
        if (adsetsData.error) continue;

        const adsetsToUpsert = adsetsData.data.map((adset: MetaAdset) => ({
            client_id: clientId,
            org_id: org_id,
            account_id: adAccountId,
            campaign_id: campaign.id,
            external_id: adset.id,
            name: adset.name,
            status: adset.status,
        }));

        if (adsetsToUpsert.length > 0) {
            const { error: adsetError } = await supabase.from('meta_adsets').upsert(adsetsToUpsert, { onConflict: 'external_id,account_id' });
            if (adsetError) throw adsetError;
        }

        // 4. Fetch Ads for each ad set
        for (const adset of adsetsData.data) {
            const adsUrl = `https://graph.facebook.com/v19.0/${adset.id}/ads?fields=id,name,status&access_token=${access_token}`;
            const adsRes = await fetch(adsUrl);
            const adsData: MetaAPIResponse<MetaAd> = await adsRes.json();
            if (adsData.error) continue;

            const adsToUpsert = adsData.data.map((ad: MetaAd) => ({
                client_id: clientId,
                org_id: org_id,
                account_id: adAccountId,
                adset_id: adset.id,
                external_id: ad.id,
                name: ad.name,
                status: ad.status,
            }));

            if (adsToUpsert.length > 0) {
                const { error: adError } = await supabase.from('meta_ads').upsert(adsToUpsert, { onConflict: 'external_id,account_id' });
                if (adError) throw adError;
            }
        }
    }

    revalidatePath(`/dashboard/clients/${clientId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Synchronization failed:", error);
    return { error: `Synchronization failed: ${error.message}` };
  }
}

// --- Nova Função para Sincronização do Google Ads ---

export async function syncGoogleAdAccount(
  adAccountId: string,
  clientId: string
) {
  const supabase = await createClient();

  // 1. Obter tokens e IDs
  const { data: accountData, error: accountError } = await supabase
    .from("ad_accounts")
    .select("*, oauth_tokens(*)")
    .eq("id", adAccountId)
    .single();

  if (accountError || !accountData || !accountData.oauth_tokens[0]) {
    return { error: "Conta de anúncio ou token não encontrado." };
  }

  const token = accountData.oauth_tokens[0];
  const customerId = accountData.external_id;
  const orgId = accountData.org_id;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expiry_date: new Date(token.expires_at!).getTime(),
  });

  // 2. Verificar e renovar o access_token se necessário
  const isTokenExpired = new Date() > new Date(token.expires_at!);
  if (isTokenExpired) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      // Atualizar o token no banco de dados
      await supabase.from("oauth_tokens").update({
        access_token: credentials.access_token,
        expires_at: new Date(credentials.expiry_date!).toISOString(),
      }).eq('id', token.id);
    } catch (refreshError) {
      console.error("Error refreshing access token:", refreshError);
      return { error: "Não foi possível renovar o token de acesso." };
    }
  }

  // 3. Sincronizar campanhas
  try {
    const accessToken = oauth2Client.credentials.access_token;
    const query = "SELECT campaign.id, campaign.name, campaign.status FROM campaign";
    
    const response = await fetch(`https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:search`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': process.env.GOOGLE_DEVELOPER_TOKEN!,
            'login-customer-id': customerId,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to fetch campaigns: ${JSON.stringify(error)}`);
    }

    const { results } = await response.json();

    if (results && results.length > 0) {
      const campaignsToUpsert = results.map((r: any) => ({
        client_id: clientId,
        org_id: orgId,
        account_id: adAccountId,
        external_id: r.campaign.id,
        name: r.campaign.name,
        status: r.campaign.status,
      }));

      const { error: upsertError } = await supabase
        .from("google_campaigns")
        .upsert(campaignsToUpsert, { onConflict: "external_id,account_id" });

      if (upsertError) throw upsertError;
    }

    revalidatePath(`/dashboard/clients/${clientId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Google Ads Sync Error:", error);
    return { error: `Falha na sincronização: ${error.message}` };
  }
}