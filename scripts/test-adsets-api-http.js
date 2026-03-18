require('dotenv').config();

async function testAdsetsAPI() {
  console.log('🧪 Testando API /api/meta/adsets via HTTP...\n');

  const campaignId = '63e9c58f-474b-4a27-9634-3122f88ec20e';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  // Simular requisição do navegador
  const url = `${baseUrl}/api/meta/adsets?campaignId=${campaignId}`;
  
  console.log('📋 URL:', url);
  console.log('📋 Campaign ID:', campaignId);
  console.log('');

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();

    console.log('📊 Status:', response.status);
    console.log('📊 OK:', response.ok);
    console.log('📊 Adsets retornados:', data.adsets?.length || 0);
    console.log('');

    if (data.adsets && data.adsets.length > 0) {
      data.adsets.forEach((adset, index) => {
        console.log(`\n🎯 Adset ${index + 1}:`);
        console.log('   ID:', adset.id);
        console.log('   Nome:', adset.name);
        console.log('   Status:', adset.status);
        console.log('   Tem insights?', !!adset.insights);
        
        if (adset.insights) {
          console.log('   Insights:');
          console.log('     - Gasto:', adset.insights.spend);
          console.log('     - Impressões:', adset.insights.impressions);
          console.log('     - Cliques:', adset.insights.clicks);
          console.log('     - CTR:', adset.insights.ctr);
          console.log('     - CPC:', adset.insights.cpc);
          console.log('     - CPM:', adset.insights.cpm);
          console.log('     - Alcance:', adset.insights.reach);
        } else {
          console.log('   ⚠️ Sem insights');
        }
      });
    } else {
      console.log('⚠️ Nenhum adset retornado');
      console.log('Resposta completa:', JSON.stringify(data, null, 2));
    }

    console.log('\n✅ Teste concluído!');

  } catch (error) {
    console.error('💥 Erro:', error.message);
    console.error(error);
  }
}

testAdsetsAPI();
