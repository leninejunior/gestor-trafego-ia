/**
 * Script de Diagnóstico: Hierarquia Meta Ads
 * 
 * Testa o carregamento completo da hierarquia:
 * Campanhas -> Conjuntos de Anúncios -> Anúncios
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testMetaHierarchy() {
  console.log('🔍 Diagnóstico: Hierarquia Meta Ads\n');
  console.log('Este script testa o carregamento de campanhas, conjuntos e anúncios.\n');

  try {
    // Solicitar informações
    const baseUrl = await question('URL da aplicação (ex: http://localhost:3000): ');
    const clientId = await question('ID do Cliente: ');
    const adAccountId = await question('ID da Conta de Anúncios (ex: act_123456789): ');

    console.log('\n📋 Configuração:');
    console.log(`   Base URL: ${baseUrl}`);
    console.log(`   Cliente: ${clientId}`);
    console.log(`   Conta: ${adAccountId}\n`);

    // 1. Testar campanhas
    console.log('1️⃣ Testando busca de campanhas...');
    const campaignsUrl = `${baseUrl}/api/meta/campaigns?clientId=${clientId}&adAccountId=${adAccountId}`;
    console.log(`   URL: ${campaignsUrl}`);
    
    const campaignsRes = await fetch(campaignsUrl);
    const campaignsData = await campaignsRes.json();
    
    if (!campaignsRes.ok) {
      console.error('   ❌ Erro ao buscar campanhas:', campaignsData.error);
      rl.close();
      return;
    }
    
    const campaigns = campaignsData.campaigns || [];
    console.log(`   ✅ ${campaigns.length} campanhas encontradas`);
    
    if (campaigns.length === 0) {
      console.log('   ⚠️ Nenhuma campanha encontrada. Verifique se a conta tem campanhas ativas.');
      rl.close();
      return;
    }

    // Mostrar primeira campanha
    const firstCampaign = campaigns[0];
    console.log(`   📊 Primeira campanha: ${firstCampaign.name} (${firstCampaign.id})`);
    console.log(`      Status: ${firstCampaign.status}`);
    console.log(`      Insights: ${firstCampaign.insights ? 'Sim' : 'Não'}`);

    // 2. Testar conjuntos de anúncios
    console.log('\n2️⃣ Testando busca de conjuntos de anúncios...');
    const adsetsUrl = `${baseUrl}/api/meta/adsets?campaignId=${firstCampaign.id}&clientId=${clientId}&adAccountId=${adAccountId}`;
    console.log(`   URL: ${adsetsUrl}`);
    
    const adsetsRes = await fetch(adsetsUrl);
    const adsetsData = await adsetsRes.json();
    
    if (!adsetsRes.ok) {
      console.error('   ❌ Erro ao buscar conjuntos:', adsetsData.error);
      console.error('   Detalhes:', adsetsData.details);
      rl.close();
      return;
    }
    
    const adsets = adsetsData.adsets || [];
    console.log(`   ✅ ${adsets.length} conjuntos encontrados`);
    
    if (adsets.length === 0) {
      console.log('   ⚠️ Nenhum conjunto encontrado para esta campanha.');
      rl.close();
      return;
    }

    // Mostrar primeiro conjunto
    const firstAdset = adsets[0];
    console.log(`   📊 Primeiro conjunto: ${firstAdset.name} (${firstAdset.id})`);
    console.log(`      Status: ${firstAdset.status}`);
    console.log(`      Insights: ${firstAdset.insights ? 'Sim' : 'Não'}`);
    if (firstAdset.insights) {
      console.log(`      Gasto: ${firstAdset.insights.spend}`);
      console.log(`      Impressões: ${firstAdset.insights.impressions}`);
    }

    // 3. Testar anúncios
    console.log('\n3️⃣ Testando busca de anúncios...');
    const adsUrl = `${baseUrl}/api/meta/ads?adsetId=${firstAdset.id}&clientId=${clientId}&adAccountId=${adAccountId}`;
    console.log(`   URL: ${adsUrl}`);
    
    const adsRes = await fetch(adsUrl);
    const adsData = await adsRes.json();
    
    if (!adsRes.ok) {
      console.error('   ❌ Erro ao buscar anúncios:', adsData.error);
      console.error('   Detalhes:', adsData.details);
      rl.close();
      return;
    }
    
    const ads = adsData.ads || [];
    console.log(`   ✅ ${ads.length} anúncios encontrados`);
    
    if (ads.length === 0) {
      console.log('   ⚠️ Nenhum anúncio encontrado para este conjunto.');
      rl.close();
      return;
    }

    // Mostrar primeiro anúncio
    const firstAd = ads[0];
    console.log(`   📊 Primeiro anúncio: ${firstAd.name} (${firstAd.id})`);
    console.log(`      Status: ${firstAd.status}`);
    console.log(`      Criativo: ${firstAd.creative ? 'Sim' : 'Não'}`);
    if (firstAd.creative) {
      console.log(`      - ID: ${firstAd.creative.id}`);
      console.log(`      - Título: ${firstAd.creative.title || 'N/A'}`);
      console.log(`      - Corpo: ${firstAd.creative.body ? firstAd.creative.body.substring(0, 50) + '...' : 'N/A'}`);
      console.log(`      - Imagem: ${firstAd.creative.image_url ? 'Sim' : 'Não'}`);
      console.log(`      - Vídeo: ${firstAd.creative.video_id ? 'Sim' : 'Não'}`);
    }
    console.log(`      Insights: ${firstAd.insights ? 'Sim' : 'Não'}`);
    if (firstAd.insights) {
      console.log(`      Gasto: ${firstAd.insights.spend}`);
      console.log(`      Impressões: ${firstAd.insights.impressions}`);
    }

    console.log('\n✅ Teste completo! Hierarquia funcionando corretamente.');
    console.log('\n📝 Resumo:');
    console.log(`   - ${campaigns.length} campanhas`);
    console.log(`   - ${adsets.length} conjuntos na primeira campanha`);
    console.log(`   - ${ads.length} anúncios no primeiro conjunto`);

  } catch (error) {
    console.error('\n💥 Erro durante o teste:', error.message);
    console.error(error);
  } finally {
    rl.close();
  }
}

testMetaHierarchy();
