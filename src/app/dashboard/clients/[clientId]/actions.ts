"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
  const supabase = createClient();

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