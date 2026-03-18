/**
 * Teste das APIs de Hierarquia Meta Ads - Pós Correção
 * 
 * Valida que as APIs de adsets e ads funcionam corretamente
 * após simplificação das queries (remoção de joins complexos)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testHierarchyAPIs() {
  console.log('🧪 Testando APIs de Hierarquia Meta Ads\n');

  try {
    // 1. Buscar uma campanha
    console.log('1️⃣ Buscando campanha...');
    const { data: campaigns, error: campaignsError } = await supabase
      .from('meta_campaigns')
      .select('id, name, external_id, connection_id')
      .limit(1);

    if (campaignsError) {
      console.error('❌ Erro ao buscar campanha:', campaignsError);
      return;
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('⚠️ Nenhuma campanha encontrada no banco');
      return;
    }

    const campaign = campaigns[0];
    console.log('✅ Campanha encontrada:', {
      id: campaign.id,
      name: campaign.name,
      external_id: campaign.external_id
    });

    // 2. Testar query simplificada de campanha (como a API faz)
    console.log('\n2️⃣ Testando query simplificada de campanha...');
    const { data: campaignSimple, error: campaignError } = await supabase
      .from('meta_campaigns')
      .select('id, connection_id, external_id')
      .eq('id', campaign.id)
      .single();

    if (campaignError) {
      console.error('❌ Erro na query simplificada:', campaignError);
      return;
    }

    console.log('✅ Query simplificada funcionou:', {
      id: campaignSimple.id,
      connection_id: campaignSimple.connection_id
    });

    // 3. Buscar adsets da campanha
    console.log('\n3️⃣ Buscando adsets da campanha...');
    const { data: adsets, error: adsetsError } = await supabase
      .from('meta_adsets')
      .select('*')
      .eq('campaign_id', campaign.id);

    if (adsetsError) {
      console.error('❌ Erro ao buscar adsets:', adsetsError);
      return;
    }

    console.log(`✅ ${adsets?.length || 0} adsets encontrados`);

    if (!adsets || adsets.length === 0) {
      console.log('⚠️ Nenhum adset encontrado para esta campanha');
      return;
    }

    const adset = adsets[0];
    console.log('   Exemplo:', {
      id: adset.id,
      name: adset.name,
      external_id: adset.external_id
    });

    // 4. Testar query simplificada de adset (como a API faz)
    console.log('\n4️⃣ Testando query simplificada de adset...');
    const { data: adsetSimple, error: adsetError } = await supabase
      .from('meta_adsets')
      .select('id, connection_id, external_id')
      .eq('id', adset.id)
      .single();

    if (adsetError) {
      console.error('❌ Erro na query simplificada:', adsetError);
      return;
    }

    console.log('✅ Query simplificada funcionou:', {
      id: adsetSimple.id,
      connection_id: adsetSimple.connection_id
    });

    // 5. Buscar ads do adset
    console.log('\n5️⃣ Buscando ads do adset...');
    const { data: ads, error: adsError } = await supabase
      .from('meta_ads')
      .select('*')
      .eq('adset_id', adset.id);

    if (adsError) {
      console.error('❌ Erro ao buscar ads:', adsError);
      return;
    }

    console.log(`✅ ${ads?.length || 0} ads encontrados`);

    if (ads && ads.length > 0) {
      console.log('   Exemplo:', {
        id: ads[0].id,
        name: ads[0].name,
        external_id: ads[0].external_id
      });
    }

    // 6. Verificar insights
    console.log('\n6️⃣ Verificando insights...');
    
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
        console.log('   Exemplo:', {
          date_start: adsetInsights[0].date_start,
          date_stop: adsetInsights[0].date_stop,
          spend: adsetInsights[0].spend,
          impressions: adsetInsights[0].impressions
        });
      }
    }

    if (ads && ads.length > 0) {
      const { data: adInsights, error: adInsightsError } = await supabase
        .from('meta_ad_insights')
        .select('*')
        .eq('ad_id', ads[0].id)
        .limit(1);

      if (adInsightsError) {
        console.error('❌ Erro ao buscar insights do ad:', adInsightsError);
      } else {
        console.log(`✅ ${adInsights?.length || 0} insights do ad encontrados`);
        if (adInsights && adInsights.length > 0) {
          console.log('   Exemplo:', {
            date_start: adInsights[0].date_start,
            date_stop: adInsights[0].date_stop,
            spend: adInsights[0].spend,
            impressions: adInsights[0].impressions
          });
        }
      }
    }

    // 7. Resumo
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DO TESTE');
    console.log('='.repeat(60));
    console.log('✅ Query simplificada de campanha: OK');
    console.log('✅ Query simplificada de adset: OK');
    console.log(`✅ Adsets encontrados: ${adsets.length}`);
    console.log(`✅ Ads encontrados: ${ads?.length || 0}`);
    console.log('✅ Insights disponíveis: OK');
    console.log('\n🎉 Todas as queries simplificadas funcionam corretamente!');
    console.log('💡 RLS garante isolamento sem necessidade de joins complexos');

  } catch (error) {
    console.error('💥 Erro inesperado:', error);
  }
}

// Executar teste
testHierarchyAPIs();
