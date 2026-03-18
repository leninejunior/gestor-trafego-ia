/**
 * Script de teste simples para verificar hierarquia Meta Ads
 * 
 * Como usar:
 * 1. Substitua CLIENT_ID pelo UUID do seu cliente
 * 2. Substitua AD_ACCOUNT_ID pelo ID da conta Meta (sem "act_")
 * 3. Execute: node test-hierarchy-simple.js
 */

const CLIENT_ID = 'SEU_CLIENT_ID_AQUI'; // Ex: '123e4567-e89b-12d3-a456-426614174000'
const AD_ACCOUNT_ID = 'SEU_AD_ACCOUNT_ID_AQUI'; // Ex: '123456789'
const BASE_URL = 'http://localhost:3000';

async function testHierarchy() {
  console.log('🚀 Iniciando teste de hierarquia Meta Ads\n');
  
  try {
    // 1. Buscar campanhas
    console.log('1️⃣ Buscando campanhas...');
    const campaignsUrl = `${BASE_URL}/api/meta/campaigns?clientId=${CLIENT_ID}&adAccountId=${AD_ACCOUNT_ID}`;
    console.log(`   URL: ${campaignsUrl}`);
    
    const campaignsRes = await fetch(campaignsUrl);
    const campaignsData = await campaignsRes.json();
    
    if (!campaignsRes.ok) {
      console.error('   ❌ Erro ao buscar campanhas:', campaignsData.error);
      return;
    }
    
    console.log(`   ✅ Campanhas encontradas: ${campaignsData.campaigns?.length || 0}`);
    
    if (!campaignsData.campaigns || campaignsData.campaigns.length === 0) {
      console.log('   ⚠️ Nenhuma campanha encontrada. Verifique se há campanhas ativas.');
      return;
    }
    
    // Pegar primeira campanha
    const campaign = campaignsData.campaigns[0];
    console.log(`   📢 Testando campanha: ${campaign.name} (${campaign.id})\n`);
    
    // 2. Buscar adsets da campanha
    console.log('2️⃣ Buscando conjuntos de anúncios...');
    const adsetsUrl = `${BASE_URL}/api/meta/adsets?campaignId=${campaign.id}&clientId=${CLIENT_ID}&adAccountId=${AD_ACCOUNT_ID}`;
    console.log(`   URL: ${adsetsUrl}`);
    
    const adsetsRes = await fetch(adsetsUrl);
    const adsetsData = await adsetsRes.json();
    
    if (!adsetsRes.ok) {
      console.error('   ❌ Erro ao buscar adsets:', adsetsData.error);
      return;
    }
    
    console.log(`   ✅ Conjuntos encontrados: ${adsetsData.adsets?.length || 0}`);
    
    if (!adsetsData.adsets || adsetsData.adsets.length === 0) {
      console.log('   ⚠️ Nenhum conjunto encontrado nesta campanha.');
      return;
    }
    
    // Mostrar detalhes do primeiro adset
    const adset = adsetsData.adsets[0];
    console.log(`   🎯 Testando conjunto: ${adset.name} (${adset.id})`);
    console.log(`   📊 Insights:`, {
      impressions: adset.insights?.impressions || '0',
      clicks: adset.insights?.clicks || '0',
      spend: adset.insights?.spend || '0'
    });
    console.log('');
    
    // 3. Buscar ads do adset
    console.log('3️⃣ Buscando anúncios...');
    const adsUrl = `${BASE_URL}/api/meta/ads?adsetId=${adset.id}&clientId=${CLIENT_ID}&adAccountId=${AD_ACCOUNT_ID}`;
    console.log(`   URL: ${adsUrl}`);
    
    const adsRes = await fetch(adsUrl);
    const adsData = await adsRes.json();
    
    if (!adsRes.ok) {
      console.error('   ❌ Erro ao buscar anúncios:', adsData.error);
      return;
    }
    
    console.log(`   ✅ Anúncios encontrados: ${adsData.ads?.length || 0}`);
    
    if (!adsData.ads || adsData.ads.length === 0) {
      console.log('   ⚠️ Nenhum anúncio encontrado neste conjunto.');
      return;
    }
    
    // Mostrar detalhes do primeiro ad
    const ad = adsData.ads[0];
    console.log(`   📱 Testando anúncio: ${ad.name} (${ad.id})`);
    console.log(`   🎨 Criativo:`, {
      hasTitle: !!ad.creative?.title,
      hasBody: !!ad.creative?.body,
      hasImage: !!ad.creative?.image_url,
      hasVideo: !!ad.creative?.video_id
    });
    console.log(`   📊 Insights:`, {
      impressions: ad.insights?.impressions || '0',
      clicks: ad.insights?.clicks || '0',
      spend: ad.insights?.spend || '0'
    });
    console.log('');
    
    // Resumo
    console.log('✅ TESTE CONCLUÍDO COM SUCESSO!');
    console.log('');
    console.log('📊 Resumo:');
    console.log(`   - Campanhas: ${campaignsData.campaigns.length}`);
    console.log(`   - Conjuntos: ${adsetsData.adsets.length}`);
    console.log(`   - Anúncios: ${adsData.ads.length}`);
    console.log('');
    console.log('✅ A hierarquia está funcionando corretamente!');
    console.log('');
    console.log('💡 Se os dados não aparecem no navegador:');
    console.log('   1. Abra o console do navegador (F12)');
    console.log('   2. Expanda uma campanha');
    console.log('   3. Verifique se há erros em vermelho');
    console.log('   4. Verifique se os logs aparecem (🔍 [ADSETS LIST])');
    
  } catch (error) {
    console.error('💥 Erro no teste:', error.message);
    console.log('');
    console.log('⚠️ Verifique se:');
    console.log('   1. O servidor está rodando (npm run dev)');
    console.log('   2. CLIENT_ID e AD_ACCOUNT_ID estão corretos');
    console.log('   3. A conexão Meta está ativa');
  }
}

// Executar teste
testHierarchy();
