/**
 * Script para testar as APIs de adsets e ads diretamente
 * Simula uma requisição autenticada
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CLIENT_ID = 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751'; // BM Coan
const AD_ACCOUNT_ID = 'act_3656912201189816';
const CAMPAIGN_ID = '120238169988720058'; // [EN] [CBO] [MSG] [WPP] WORKSHOP P.I.P_2025 - 25/11/25

async function testAPIs() {
  console.log('🚀 Testando APIs de hierarquia Meta Ads...\n');
  
  // 1. Buscar conexão
  const { data: connection } = await supabase
    .from('client_meta_connections')
    .select('*')
    .eq('client_id', CLIENT_ID)
    .eq('ad_account_id', AD_ACCOUNT_ID)
    .single();
  
  if (!connection) {
    console.error('❌ Conexão não encontrada');
    return;
  }
  
  console.log('✅ Conexão encontrada:', connection.account_name);
  console.log('');
  
  // 2. Testar API de adsets
  console.log('📊 TESTANDO API DE ADSETS');
  console.log('=====================================');
  console.log('Campanha:', CAMPAIGN_ID);
  console.log('');
  
  try {
    // Buscar adsets da Meta API diretamente
    const metaApiUrl = `https://graph.facebook.com/v18.0/${CAMPAIGN_ID}/adsets`;
    const params = new URLSearchParams({
      access_token: connection.access_token,
      fields: 'id,name,status,daily_budget,lifetime_budget,optimization_goal,billing_event,created_time,updated_time'
    });
    
    console.log('🔗 Chamando Meta API:', metaApiUrl);
    const response = await fetch(`${metaApiUrl}?${params}`);
    const data = await response.json();
    
    if (data.error) {
      console.error('❌ Erro da Meta API:', data.error);
      return;
    }
    
    console.log(`✅ ${data.data?.length || 0} adsets encontrados na Meta API`);
    data.data?.forEach((adset, i) => {
      console.log(`  ${i + 1}. ${adset.name} (${adset.id}) - ${adset.status}`);
    });
    console.log('');
    
    // 3. Para cada adset, buscar ads
    if (data.data && data.data.length > 0) {
      const firstAdset = data.data[0];
      console.log('📊 TESTANDO API DE ADS');
      console.log('=====================================');
      console.log('Adset:', firstAdset.name);
      console.log('');
      
      const adsApiUrl = `https://graph.facebook.com/v18.0/${firstAdset.id}/ads`;
      const adsParams = new URLSearchParams({
        access_token: connection.access_token,
        fields: 'id,name,status,creative{id,name,title,body,image_url,thumbnail_url},created_time'
      });
      
      console.log('🔗 Chamando Meta API:', adsApiUrl);
      const adsResponse = await fetch(`${adsApiUrl}?${adsParams}`);
      const adsData = await adsResponse.json();
      
      if (adsData.error) {
        console.error('❌ Erro da Meta API:', adsData.error);
        return;
      }
      
      console.log(`✅ ${adsData.data?.length || 0} ads encontrados na Meta API`);
      adsData.data?.forEach((ad, i) => {
        console.log(`  ${i + 1}. ${ad.name} (${ad.id}) - ${ad.status}`);
        if (ad.creative) {
          console.log(`     Criativo: ${ad.creative.id}`);
          if (ad.creative.title) console.log(`     Título: ${ad.creative.title}`);
          if (ad.creative.body) console.log(`     Texto: ${ad.creative.body.substring(0, 50)}...`);
        }
      });
      console.log('');
    }
    
    // 4. Resumo
    console.log('📊 RESUMO');
    console.log('=====================================');
    console.log('✅ Meta API está funcionando corretamente');
    console.log('✅ Token de acesso é válido');
    console.log('✅ Dados de hierarquia estão disponíveis');
    console.log('');
    console.log('🔍 Próximo passo: Verificar por que a interface não mostra os dados');
    console.log('   Possíveis causas:');
    console.log('   1. Componente não está fazendo a requisição correta');
    console.log('   2. Filtro de data está muito restrito');
    console.log('   3. Problema de autenticação no frontend');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testAPIs().catch(console.error);
