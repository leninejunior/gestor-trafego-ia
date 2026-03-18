/**
 * Script de diagnóstico para hierarquia Meta Ads
 * Verifica se os dados de campanhas, adsets e ads estão sendo retornados corretamente
 */

const https = require('https');

// Configuração
const BASE_URL = 'http://localhost:3000';
const CLIENT_ID = 'a3ab33da-739f-45c9-943f-b0a76cab9731'; // BM Coan
const AD_ACCOUNT_ID = 'act_3656912201189816';

// Função auxiliar para fazer requisições
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    console.log(`\n🔗 Fazendo requisição: ${url.toString()}`);
    
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const protocol = url.protocol === 'https:' ? https : require('http');
    
    const req = protocol.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

async function diagnoseCampaigns() {
  console.log('\n📊 ========================================');
  console.log('📊 DIAGNÓSTICO: CAMPANHAS META ADS');
  console.log('📊 ========================================\n');
  
  try {
    const response = await makeRequest(
      `/api/meta/campaigns?clientId=${CLIENT_ID}&adAccountId=${AD_ACCOUNT_ID}&withInsights=true`
    );
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📦 Campanhas encontradas: ${response.data.campaigns?.length || 0}`);
    
    if (response.data.campaigns && response.data.campaigns.length > 0) {
      const campaign = response.data.campaigns[0];
      console.log(`\n🎯 Primeira campanha:`);
      console.log(`   ID: ${campaign.id}`);
      console.log(`   Nome: ${campaign.name}`);
      console.log(`   Status: ${campaign.status}`);
      console.log(`   Tem insights: ${!!campaign.insights}`);
      
      if (campaign.insights) {
        console.log(`   📊 Insights:`);
        console.log(`      Gasto: R$ ${campaign.insights.spend}`);
        console.log(`      Impressões: ${campaign.insights.impressions}`);
        console.log(`      Cliques: ${campaign.insights.clicks}`);
      }
      
      return campaign.id;
    } else {
      console.log('⚠️ Nenhuma campanha encontrada');
      return null;
    }
  } catch (error) {
    console.error('❌ Erro ao buscar campanhas:', error.message);
    return null;
  }
}

async function diagnoseAdSets(campaignId) {
  console.log('\n📊 ========================================');
  console.log('📊 DIAGNÓSTICO: CONJUNTOS DE ANÚNCIOS');
  console.log('📊 ========================================\n');
  
  try {
    const response = await makeRequest(
      `/api/meta/adsets?campaignId=${campaignId}&clientId=${CLIENT_ID}&adAccountId=${AD_ACCOUNT_ID}&withInsights=true`
    );
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📦 Conjuntos encontrados: ${response.data.adsets?.length || 0}`);
    
    if (response.data.adsets && response.data.adsets.length > 0) {
      response.data.adsets.forEach((adset, index) => {
        console.log(`\n🎯 Conjunto ${index + 1}:`);
        console.log(`   ID: ${adset.id}`);
        console.log(`   Nome: ${adset.name}`);
        console.log(`   Status: ${adset.status}`);
        console.log(`   Tem insights: ${!!adset.insights}`);
        
        if (adset.insights) {
          console.log(`   📊 Insights:`);
          console.log(`      Gasto: R$ ${adset.insights.spend}`);
          console.log(`      Impressões: ${adset.insights.impressions}`);
          console.log(`      Cliques: ${adset.insights.clicks}`);
        } else {
          console.log(`   ⚠️ SEM INSIGHTS!`);
        }
      });
      
      return response.data.adsets[0].id;
    } else {
      console.log('⚠️ Nenhum conjunto encontrado');
      return null;
    }
  } catch (error) {
    console.error('❌ Erro ao buscar conjuntos:', error.message);
    return null;
  }
}

async function diagnoseAds(adsetId) {
  console.log('\n📊 ========================================');
  console.log('📊 DIAGNÓSTICO: ANÚNCIOS');
  console.log('📊 ========================================\n');
  
  try {
    const response = await makeRequest(
      `/api/meta/ads?adsetId=${adsetId}&clientId=${CLIENT_ID}&adAccountId=${AD_ACCOUNT_ID}&withInsights=true`
    );
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📦 Anúncios encontrados: ${response.data.ads?.length || 0}`);
    
    if (response.data.ads && response.data.ads.length > 0) {
      response.data.ads.forEach((ad, index) => {
        console.log(`\n🎯 Anúncio ${index + 1}:`);
        console.log(`   ID: ${ad.id}`);
        console.log(`   Nome: ${ad.name}`);
        console.log(`   Status: ${ad.status}`);
        console.log(`   Tem insights: ${!!ad.insights}`);
        
        if (ad.insights) {
          console.log(`   📊 Insights:`);
          console.log(`      Gasto: R$ ${ad.insights.spend}`);
          console.log(`      Impressões: ${ad.insights.impressions}`);
          console.log(`      Cliques: ${ad.insights.clicks}`);
        } else {
          console.log(`   ⚠️ SEM INSIGHTS!`);
        }
      });
    } else {
      console.log('⚠️ Nenhum anúncio encontrado');
    }
  } catch (error) {
    console.error('❌ Erro ao buscar anúncios:', error.message);
  }
}

async function main() {
  console.log('\n🚀 Iniciando diagnóstico da hierarquia Meta Ads...\n');
  console.log(`📋 Cliente: ${CLIENT_ID}`);
  console.log(`📋 Conta: ${AD_ACCOUNT_ID}\n`);
  
  // 1. Buscar campanhas
  const campaignId = await diagnoseCampaigns();
  
  if (!campaignId) {
    console.log('\n❌ Não foi possível continuar sem campanhas');
    return;
  }
  
  // 2. Buscar conjuntos
  const adsetId = await diagnoseAdSets(campaignId);
  
  if (!adsetId) {
    console.log('\n⚠️ Não foi possível buscar anúncios sem conjuntos');
    return;
  }
  
  // 3. Buscar anúncios
  await diagnoseAds(adsetId);
  
  console.log('\n✅ Diagnóstico concluído!\n');
}

main().catch(console.error);
