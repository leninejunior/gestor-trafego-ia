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
    .select("access_token, ad_account_id, org_id") // Changed agency_id to org_id
    .eq("ad_account_id", adAccountId)
    .single();

  if (tokenError || !tokenData) {
    console.error("Token not found:", tokenError);
    return { error: "Access token not found for this ad account." };
  }

  const { access_token, org_id } = tokenData; // Changed agency_id to org_id
  const { data: adAccountProviderId, error: adAccountProviderIdError } = await supabase.from('ad_accounts').select('external_id').eq('id', adAccountId).single(); // Changed provider_account_id to external_id

  if (adAccountProviderIdError || !adAccountProviderId) {
    console.error("Ad account provider ID not found:", adAccountProviderIdError);
    return { error: "Ad account provider ID not found." };
  }

  const ad_account_external_id = adAccountProviderId.external_id;


  try {
    // 2. Fetch Campaigns
    const campaignsUrl = `https://graph.facebook.com/v19.0/act_${ad_account_external_id}/campaigns?fields=id,name,status&access_token=${access_token}`;
    const campaignsRes = await fetch(campaignsUrl);
    const campaignsData: MetaAPIResponse<MetaCampaign> = await campaignsRes.json(); // Type assertion
    if (campaignsData.error) throw new Error(campaignsData.error.message);

    const campaignsToUpsert = campaignsData.data.map((c: MetaCampaign) => ({ // Removed any
      client_id: clientId, // Added client_id
      org_id: org_id, // Added org_id
      account_id: adAccountId, // Added account_id
      external_id: c.id, // Changed id to external_id
      name: c.name,
      status: c.status,
    }));

    if (campaignsToUpsert.length > 0) {
        const { error: campaignError } = await supabase.from('meta_campaigns').upsert(campaignsToUpsert, { onConflict: 'external_id,account_id' }); // Added onConflict
        if (campaignError) throw campaignError;
    }

    // 3. Fetch Ad Sets for each campaign
    for (const campaign of campaignsData.data) { // Removed any
        const adsetsUrl = `https://graph.facebook.com/v19.0/${campaign.id}/adsets?fields=id,name,status&access_token=${access_token}`;
        const adsetsRes = await fetch(adsetsUrl);
        const adsetsData: MetaAPIResponse<MetaAdset> = await adsetsRes.json(); // Type assertion
        if (adsetsData.error) continue; // Skip if a campaign has no adsets

        const adsetsToUpsert = adsetsData.data.map((adset: MetaAdset) => ({ // Removed any
            client_id: clientId, // Added client_id
            org_id: org_id, // Added org_id
            account_id: adAccountId, // Added account_id
            campaign_id: campaign.id,
            external_id: adset.id, // Changed id to external_id
            name: adset.name,
            status: adset.status,
        }));

        if (adsetsToUpsert.length > 0) {
            const { error: adsetError } = await supabase.from('meta_adsets').upsert(adsetsToUpsert, { onConflict: 'external_id,account_id' }); // Added onConflict
            if (adsetError) throw adsetError;
        }

        // 4. Fetch Ads for each ad set
        for (const adset of adsetsData.data) { // Removed any
            const adsUrl = `https://graph.facebook.com/v19.0/${adset.id}/ads?fields=id,name,status&access_token=${access_token}`;
            const adsRes = await fetch(adsUrl);
            const adsData: MetaAPIResponse<MetaAd> = await adsRes.json(); // Type assertion
            if (adsData.error) continue;

            const adsToUpsert = adsData.data.map((ad: MetaAd) => ({ // Removed any
                client_id: clientId, // Added client_id
                org_id: org_id, // Added org_id
                account_id: adAccountId, // Added account_id
                adset_id: adset.id,
                external_id: ad.id, // Changed id to external_id
                name: ad.name,
                status: ad.status,
            }));

            if (adsToUpsert.length > 0) {
                const { error: adError } = await supabase.from('meta_ads').upsert(adsToUpsert, { onConflict: 'external_id,account_id' }); // Added onConflict
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