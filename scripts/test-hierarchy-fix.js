#!/usr/bin/env node

/**
 * Teste da correção do bug de hierarquia Meta Ads
 * 
 * Bug: APIs de adsets e ads estavam usando external_id ao invés de UUID interno
 * Correção: Usar campaign.id e adset.id (UUIDs internos) nas queries
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testHierarchyFix() {
  console.log('🧪 Testando correção de hierarquia Meta Ads\n');

  try {
    // 1. Buscar uma campanha
    console.log('1️⃣ Buscando campanha...');
    const { data: campaigns, error: campaignsError } = await supabase
      .from('meta_campaigns')
      .select('id, external_id, name')
      .limit(1);

    if (campaignsError || !campaigns || campaigns.length === 0) {
      console.error('❌ Erro ao buscar campanha:', campaignsError);
      return;
    }

    const campaign = campaigns[0];
    console.log('✅ Campanha encontrada:', {
      id: campaign.id,
      external_id: campaign.external_id,
      name: campaign.name
    });

    // 2. Buscar adsets usando UUID interno (correto)
    console.log('\n2️⃣ Buscando adsets com UUID interno (campaign.id)...');
    const { data: adsetsById, error: adsetsByIdError } = await supabase
      .from('meta_adsets')
      .select('id, external_id, name, campaign_id')
      .eq('campaign_id', campaign.id);

    if (adsetsByIdError) {
      console.error('❌ Erro ao buscar adsets por ID:', adsetsByIdError);
    } else {
      console.log(`✅ ${adsetsById?.length || 0} adsets encontrados com campaign.id`);
      if (adsetsById && adsetsById.length > 0) {
        console.log('   Exemplo:', {
          id: adsetsById[0].id,
          external_id: adsetsById[0].external_id,
          name: adsetsById[0].name
        });
      }
    }

    // 3. Buscar adsets usando external_id (incorreto - bug anterior)
    console.log('\n3️⃣ Buscando adsets com external_id (campaign.external_id) - BUG...');
    const { data: adsetsByExternalId, error: adsetsByExternalIdError } = await supabase
      .from('meta_adsets')
      .select('id, external_id, name, campaign_id')
      .eq('campaign_id', campaign.external_id);

    if (adsetsByExternalIdError) {
      console.error('❌ Erro ao buscar adsets por external_id:', adsetsByExternalIdError);
    } else {
      console.log(`⚠️ ${adsetsByExternalId?.length || 0} adsets encontrados com campaign.external_id`);
      console.log('   (Deveria ser 0 - external_id não é FK válido!)');
    }

    // 4. Se houver adsets, testar busca de ads
    if (adsetsById && adsetsById.length > 0) {
      const adset = adsetsById[0];
      
      console.log('\n4️⃣ Buscando ads com UUID interno (adset.id)...');
      const { data: adsById, error: adsByIdError } = await supabase
        .from('meta_ads')
        .select('id, external_id, name, adset_id')
        .eq('adset_id', adset.id);

      if (adsByIdError) {
        console.error('❌ Erro ao buscar ads por ID:', adsByIdError);
      } else {
        console.log(`✅ ${adsById?.length || 0} ads encontrados com adset.id`);
        if (adsById && adsById.length > 0) {
          console.log('   Exemplo:', {
            id: adsById[0].id,
            external_id: adsById[0].external_id,
            name: adsById[0].name
          });
        }
      }

      console.log('\n5️⃣ Buscando ads com external_id (adset.external_id) - BUG...');
      const { data: adsByExternalId, error: adsByExternalIdError } = await supabase
        .from('meta_ads')
        .select('id, external_id, name, adset_id')
        .eq('adset_id', adset.external_id);

      if (adsByExternalIdError) {
        console.error('❌ Erro ao buscar ads por external_id:', adsByExternalIdError);
      } else {
        console.log(`⚠️ ${adsByExternalId?.length || 0} ads encontrados com adset.external_id`);
        console.log('   (Deveria ser 0 - external_id não é FK válido!)');
      }
    }

    // Resumo
    console.log('\n📊 RESUMO DA CORREÇÃO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ CORRETO: Usar campaign.id (UUID) para buscar adsets');
    console.log('✅ CORRETO: Usar adset.id (UUID) para buscar ads');
    console.log('❌ ERRADO: Usar campaign.external_id para buscar adsets');
    console.log('❌ ERRADO: Usar adset.external_id para buscar ads');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🔧 Arquivos corrigidos:');
    console.log('   - src/app/api/meta/adsets/route.ts (linha 67)');
    console.log('   - src/app/api/meta/ads/route.ts (linha 73)');

  } catch (error) {
    console.error('💥 Erro inesperado:', error);
  }
}

testHierarchyFix();
