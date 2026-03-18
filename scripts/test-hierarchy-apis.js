const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testHierarchyAPIs() {
  console.log('🧪 Testando APIs de Hierarquia Meta\n');

  try {
    // 1. Buscar uma campanha
    console.log('1️⃣ Buscando campanhas...');
    const { data: campaigns, error: campaignsError } = await supabase
      .from('meta_campaigns')
      .select('id, name, external_id')
      .limit(1);

    if (campaignsError) {
      console.error('❌ Erro ao buscar campanhas:', campaignsError);
      return;
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('⚠️ Nenhuma campanha encontrada');
      return;
    }

    const campaign = campaigns[0];
    console.log('✅ Campanha encontrada:', campaign);

    // 2. Buscar adsets da campanha
    console.log('\n2️⃣ Buscando adsets da campanha...');
    const { data: adsets, error: adsetsError } = await supabase
      .from('meta_adsets')
      .select('id, name, external_id, campaign_id')
      .eq('campaign_id', campaign.id);

    if (adsetsError) {
      console.error('❌ Erro ao buscar adsets:', adsetsError);
      return;
    }

    console.log(`✅ ${adsets?.length || 0} adsets encontrados`);
    if (adsets && adsets.length > 0) {
      console.log('Adsets:', adsets.map(a => ({ id: a.id, name: a.name })));

      // 3. Buscar ads do primeiro adset
      const adset = adsets[0];
      console.log('\n3️⃣ Buscando ads do adset:', adset.name);
      
      const { data: ads, error: adsError } = await supabase
        .from('meta_ads')
        .select('id, name, external_id, adset_id')
        .eq('adset_id', adset.id);

      if (adsError) {
        console.error('❌ Erro ao buscar ads:', adsError);
        return;
      }

      console.log(`✅ ${ads?.length || 0} ads encontrados`);
      if (ads && ads.length > 0) {
        console.log('Ads:', ads.map(a => ({ id: a.id, name: a.name })));
      }

      // 4. Buscar insights do adset
      console.log('\n4️⃣ Buscando insights do adset...');
      const { data: adsetInsights, error: adsetInsightsError } = await supabase
        .from('meta_adset_insights')
        .select('*')
        .eq('adset_id', adset.id)
        .limit(1);

      if (adsetInsightsError) {
        console.error('❌ Erro ao buscar insights do adset:', adsetInsightsError);
      } else {
        console.log(`✅ ${adsetInsights?.length || 0} insights do adset encontrados`);
        if (adsetInsights && adsetInsights.length > 0) {
          console.log('Exemplo:', {
            impressions: adsetInsights[0].impressions,
            clicks: adsetInsights[0].clicks,
            spend: adsetInsights[0].spend
          });
        }
      }

      // 5. Buscar insights do primeiro ad
      if (ads && ads.length > 0) {
        const ad = ads[0];
        console.log('\n5️⃣ Buscando insights do ad:', ad.name);
        
        const { data: adInsights, error: adInsightsError } = await supabase
          .from('meta_ad_insights')
          .select('*')
          .eq('ad_id', ad.id)
          .limit(1);

        if (adInsightsError) {
          console.error('❌ Erro ao buscar insights do ad:', adInsightsError);
        } else {
          console.log(`✅ ${adInsights?.length || 0} insights do ad encontrados`);
          if (adInsights && adInsights.length > 0) {
            console.log('Exemplo:', {
              impressions: adInsights[0].impressions,
              clicks: adInsights[0].clicks,
              spend: adInsights[0].spend
            });
          }
        }
      }
    }

    console.log('\n✅ Teste concluído!');

  } catch (error) {
    console.error('💥 Erro inesperado:', error);
  }
}

testHierarchyAPIs();
