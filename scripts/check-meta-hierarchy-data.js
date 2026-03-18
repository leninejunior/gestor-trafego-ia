/**
 * Script para verificar dados da hierarquia Meta no Supabase
 */

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCampaigns() {
  console.log('\n📊 ========================================');
  console.log('📊 VERIFICANDO: CAMPANHAS');
  console.log('📊 ========================================\n');
  
  const { data, error } = await supabase
    .from('meta_campaigns')
    .select('*')
    .limit(5);
  
  if (error) {
    console.error('❌ Erro:', error.message);
    return [];
  }
  
  console.log(`✅ Campanhas no banco: ${data.length}`);
  
  if (data.length > 0) {
    data.forEach((campaign, index) => {
      console.log(`\n🎯 Campanha ${index + 1}:`);
      console.log(`   ID interno: ${campaign.id}`);
      console.log(`   ID externo: ${campaign.external_id}`);
      console.log(`   Nome: ${campaign.name}`);
      console.log(`   Status: ${campaign.status}`);
      console.log(`   Connection ID: ${campaign.connection_id}`);
    });
  }
  
  return data;
}

async function checkAdSets() {
  console.log('\n📊 ========================================');
  console.log('📊 VERIFICANDO: CONJUNTOS DE ANÚNCIOS');
  console.log('📊 ========================================\n');
  
  const { data, error } = await supabase
    .from('meta_adsets')
    .select('*')
    .limit(10);
  
  if (error) {
    console.error('❌ Erro:', error.message);
    return [];
  }
  
  console.log(`✅ Conjuntos no banco: ${data.length}`);
  
  if (data.length > 0) {
    data.forEach((adset, index) => {
      console.log(`\n🎯 Conjunto ${index + 1}:`);
      console.log(`   ID interno: ${adset.id}`);
      console.log(`   ID externo: ${adset.external_id}`);
      console.log(`   Nome: ${adset.name}`);
      console.log(`   Status: ${adset.status}`);
      console.log(`   Campaign ID: ${adset.campaign_id}`);
      console.log(`   Connection ID: ${adset.connection_id}`);
    });
  }
  
  return data;
}

async function checkAds() {
  console.log('\n📊 ========================================');
  console.log('📊 VERIFICANDO: ANÚNCIOS');
  console.log('📊 ========================================\n');
  
  const { data, error } = await supabase
    .from('meta_ads')
    .select('*')
    .limit(10);
  
  if (error) {
    console.error('❌ Erro:', error.message);
    return [];
  }
  
  console.log(`✅ Anúncios no banco: ${data.length}`);
  
  if (data.length > 0) {
    data.forEach((ad, index) => {
      console.log(`\n🎯 Anúncio ${index + 1}:`);
      console.log(`   ID interno: ${ad.id}`);
      console.log(`   ID externo: ${ad.external_id}`);
      console.log(`   Nome: ${ad.name}`);
      console.log(`   Status: ${ad.status}`);
      console.log(`   AdSet ID: ${ad.adset_id}`);
      console.log(`   Connection ID: ${ad.connection_id}`);
    });
  }
  
  return data;
}

async function checkInsights() {
  console.log('\n📊 ========================================');
  console.log('📊 VERIFICANDO: INSIGHTS');
  console.log('📊 ========================================\n');
  
  // Verificar insights de campanhas
  const { data: campaignInsights, error: campaignError } = await supabase
    .from('meta_campaign_insights')
    .select('*')
    .limit(5);
  
  if (campaignError) {
    console.error('❌ Erro ao buscar insights de campanhas:', campaignError.message);
  } else {
    console.log(`✅ Insights de campanhas: ${campaignInsights.length}`);
    if (campaignInsights.length > 0) {
      const insight = campaignInsights[0];
      console.log(`   Exemplo: Gasto=${insight.spend}, Impressões=${insight.impressions}, Cliques=${insight.clicks}`);
    }
  }
  
  // Verificar insights de adsets
  const { data: adsetInsights, error: adsetError } = await supabase
    .from('meta_adset_insights')
    .select('*')
    .limit(5);
  
  if (adsetError) {
    console.error('❌ Erro ao buscar insights de adsets:', adsetError.message);
  } else {
    console.log(`✅ Insights de adsets: ${adsetInsights.length}`);
    if (adsetInsights.length > 0) {
      const insight = adsetInsights[0];
      console.log(`   Exemplo: Gasto=${insight.spend}, Impressões=${insight.impressions}, Cliques=${insight.clicks}`);
    }
  }
  
  // Verificar insights de ads
  const { data: adInsights, error: adError } = await supabase
    .from('meta_ad_insights')
    .select('*')
    .limit(5);
  
  if (adError) {
    console.error('❌ Erro ao buscar insights de ads:', adError.message);
  } else {
    console.log(`✅ Insights de ads: ${adInsights.length}`);
    if (adInsights.length > 0) {
      const insight = adInsights[0];
      console.log(`   Exemplo: Gasto=${insight.spend}, Impressões=${insight.impressions}, Cliques=${insight.clicks}`);
    }
  }
}

async function main() {
  console.log('\n🚀 Verificando dados da hierarquia Meta no Supabase...\n');
  
  await checkCampaigns();
  await checkAdSets();
  await checkAds();
  await checkInsights();
  
  console.log('\n✅ Verificação concluída!\n');
}

main().catch(console.error);
