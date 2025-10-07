"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function syncFacebookAdAccount(
  adAccountId: string,
  clientId: string
) {
  const supabase = createClient();

  // 1. Get the access token for the ad account
  const { data: tokenData, error: tokenError } = await supabase
    .from("oauth_tokens")
    .select("access_token, ad_account_id, agency_id")
    .eq("ad_account_id", adAccountId)
    .single();

  if (tokenError || !tokenData) {
    console.error("Token not found:", tokenError);
    return { error: "Access token not found for this ad account." };
  }

  const { access_token, agency_id } = tokenData;
  const ad_account_id_from_provider = (await supabase.from('ad_accounts').select('provider_account_id').eq('id', adAccountId).single()).data?.provider_account_id;


  try {
    // 2. Fetch Campaigns
    const campaignsUrl = `https://graph.facebook.com/v19.0/${ad_account_id_from_provider}/campaigns?fields=id,name,status&access_token=${access_token}`;
    const campaignsRes = await fetch(campaignsUrl);
    const campaignsData = await campaignsRes.json();
    if (campaignsData.error) throw new Error(campaignsData.error.message);

    const campaignsToUpsert = campaignsData.data.map((c: any) => ({
      id: c.id,
      ad_account_id: adAccountId,
      agency_id: agency_id,
      name: c.name,
      status: c.status,
    }));

    if (campaignsToUpsert.length > 0) {
        const { error: campaignError } = await supabase.from('meta_campaigns').upsert(campaignsToUpsert);
        if (campaignError) throw campaignError;
    }

    // 3. Fetch Ad Sets for each campaign
    for (const campaign of campaignsData.data) {
        const adsetsUrl = `https://graph.facebook.com/v19.0/${campaign.id}/adsets?fields=id,name,status&access_token=${access_token}`;
        const adsetsRes = await fetch(adsetsUrl);
        const adsetsData = await adsetsRes.json();
        if (adsetsData.error) continue; // Skip if a campaign has no adsets

        const adsetsToUpsert = adsetsData.data.map((adset: any) => ({
            id: adset.id,
            campaign_id: campaign.id,
            agency_id: agency_id,
            name: adset.name,
            status: adset.status,
        }));

        if (adsetsToUpsert.length > 0) {
            const { error: adsetError } = await supabase.from('meta_adsets').upsert(adsetsToUpsert);
            if (adsetError) throw adsetError;
        }

        // 4. Fetch Ads for each ad set
        for (const adset of adsetsData.data) {
            const adsUrl = `https://graph.facebook.com/v19.0/${adset.id}/ads?fields=id,name,status&access_token=${access_token}`;
            const adsRes = await fetch(adsUrl);
            const adsData = await adsRes.json();
            if (adsData.error) continue;

            const adsToUpsert = adsData.data.map((ad: any) => ({
                id: ad.id,
                adset_id: adset.id,
                agency_id: agency_id,
                name: ad.name,
                status: ad.status,
            }));

            if (adsToUpsert.length > 0) {
                const { error: adError } = await supabase.from('meta_ads').upsert(adsToUpsert);
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