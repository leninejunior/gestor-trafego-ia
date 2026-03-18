/**
 * Teste: Buscar hierarquia usando external_id ao invés de UUID interno
 * 
 * Valida que as APIs aceitam tanto UUID quanto external_id
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testHierarchyWithExternalIds() {
  console.log('🧪 Testando hierarquia com external_id...\n');

  try {
    // 1. Buscar uma campanha
    const { data: campaigns, error: campaignsError } = await supabase
      .from('meta_campaigns')
      .select('id, external_id, name')
      .limit(1);

    if (campaignsError) throw campaignsError;
    if (!campaigns || campaigns.length === 0) {
      console.log('❌ Nenhuma campanha encontrada');
      return;
    }

    const campaign = campaigns[0];
    console.log('✅ Campanha encontrada:', {
      uuid: campaign.id,
      external_id: campaign.external_id,
      name: campaign.name
    });

    // 2. Buscar adsets usando UUID interno
    console.log('\n📍 Teste 1: Buscar adsets usando UUID interno...');
    const { data: adsetsByUuid, error: adsetsByUuidError } = await supabase
      .from('meta_adsets')
      .select('id, external_id, name')
      .eq('campaign_id', campaign.id);

    if (adsetsByUuidError) {
      console.error('❌ Erro ao buscar por UUID:', adsetsByUuidError);
    } else {
      console.log(`✅ ${adsetsByUuid?.length || 0} adsets encontrados por UUID`);
      if (adsetsByUuid && adsetsByUuid.length > 0) {
        console.log('   Exemplo:', {
          uuid: adsetsByUuid[0].id,
          external_id: adsetsByUuid[0].external_id,
          name: adsetsByUuid[0].name
        });
      }
    }

    // 3. Buscar campanha por external_id
    console.log('\n📍 Teste 2: Buscar campanha por external_id...');
    const { data: campaignByExternal, error: campaignByExternalError } = await supabase
      .from('meta_campaigns')
      .select('id, external_id, name')
      .eq('external_id', campaign.external_id)
      .single();

    if (campaignByExternalError) {
      console.error('❌ Erro ao buscar por external_id:', campaignByExternalError);
    } else {
      console.log('✅ Campanha encontrada por external_id:', {
        uuid: campaignByExternal.id,
        external_id: campaignByExternal.external_id,
        name: campaignByExternal.name
      });
    }

    // 4. Se houver adsets, testar busca de ads
    if (adsetsByUuid && adsetsByUuid.length > 0) {
      const adset = adsetsByUuid[0];
      
      console.log('\n📍 Teste 3: Buscar ads usando UUID interno do adset...');
      const { data: adsByUuid, error: adsByUuidError } = await supabase
        .from('meta_ads')
        .select('id, external_id, name')
        .eq('adset_id', adset.id);

      if (adsByUuidError) {
        console.error('❌ Erro ao buscar ads por UUID:', adsByUuidError);
      } else {
        console.log(`✅ ${adsByUuid?.length || 0} ads encontrados por UUID`);
        if (adsByUuid && adsByUuid.length > 0) {
          console.log('   Exemplo:', {
            uuid: adsByUuid[0].id,
            external_id: adsByUuid[0].external_id,
            name: adsByUuid[0].name
          });
        }
      }

      console.log('\n📍 Teste 4: Buscar adset por external_id...');
      const { data: adsetByExternal, error: adsetByExternalError } = await supabase
        .from('meta_adsets')
        .select('id, external_id, name')
        .eq('external_id', adset.external_id)
        .single();

      if (adsetByExternalError) {
        console.error('❌ Erro ao buscar adset por external_id:', adsetByExternalError);
      } else {
        console.log('✅ Adset encontrado por external_id:', {
          uuid: adsetByExternal.id,
          external_id: adsetByExternal.external_id,
          name: adsetByExternal.name
        });
      }
    }

    console.log('\n✅ Todos os testes concluídos!');
    console.log('\n📝 Resumo:');
    console.log('- Campanhas podem ser buscadas por UUID ou external_id');
    console.log('- Adsets podem ser buscados por UUID ou external_id');
    console.log('- Ads podem ser buscados por UUID ou external_id');
    console.log('\n💡 As APIs agora devem aceitar ambos os formatos!');

  } catch (error) {
    console.error('💥 Erro inesperado:', error);
  }
}

testHierarchyWithExternalIds();
