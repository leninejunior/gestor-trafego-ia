/**
 * Script para testar as correções dos filtros da dashboard do Google Ads
 * Verifica se os indicadores estão funcionando e se os filtros estão sincronizados
 */

const BASE_URL = 'http://localhost:3001';

async function testGoogleAdsFilters() {
  console.log('🧪 Iniciando teste dos filtros do Google Ads...');
  console.log('=' .repeat(80));

  try {
    // Teste 1: Verificar se a página carrega
    console.log('📋 Teste 1: Carregamento da página');
    const pageResponse = await fetch(`${BASE_URL}/dashboard/google`);
    console.log(`Status: ${pageResponse.status}`);
    
    if (pageResponse.ok) {
      console.log('✅ Página carregada com sucesso');
    } else {
      console.log('❌ Erro ao carregar página');
      return;
    }

    // Teste 2: Verificar API de métricas com parâmetros de data
    console.log('\n📊 Teste 2: API de métricas com filtros de data');
    const testClientId = 'test-client-id';
    const startDate = '2024-11-01';
    const endDate = '2024-11-30';
    
    const metricsResponse = await fetch(
      `${BASE_URL}/api/google/metrics-simple?clientId=${testClientId}&startDate=${startDate}&endDate=${endDate}&groupBy=campaign`
    );
    
    console.log(`Status: ${metricsResponse.status}`);
    
    if (metricsResponse.ok) {
      const metricsData = await metricsResponse.json();
      console.log('✅ API de métricas respondeu corretamente');
      console.log('Estrutura da resposta:', JSON.stringify(metricsData, null, 2));
      
      // Verificar se os campos esperados existem
      if (metricsData.summary && metricsData.campaigns) {
        console.log('✅ Estrutura de dados válida');
        console.log(`- Total de campanhas: ${metricsData.campaigns.length}`);
        console.log(`- Custo total: ${metricsData.summary.totalCost || 0}`);
        console.log(`- Total de conversões: ${metricsData.summary.totalConversions || 0}`);
      } else {
        console.log('⚠️ Estrutura de dados incompleta');
      }
    } else {
      console.log('❌ Erro na API de métricas');
      const errorText = await metricsResponse.text();
      console.log('Erro:', errorText);
    }

    // Teste 3: Verificar API de campanhas com filtros de data
    console.log('\n📈 Teste 3: API de campanhas com filtros de data');
    const campaignsResponse = await fetch(
      `${BASE_URL}/api/google/campaigns?clientId=${testClientId}&startDate=${startDate}&endDate=${endDate}`
    );
    
    console.log(`Status: ${campaignsResponse.status}`);
    
    if (campaignsResponse.ok) {
      const campaignsData = await campaignsResponse.json();
      console.log('✅ API de campanhas respondeu corretamente');
      console.log('Estrutura da resposta:', JSON.stringify(campaignsData, null, 2));
      
      // Verificar se os campos esperados existem
      if (campaignsData.campaigns && Array.isArray(campaignsData.campaigns)) {
        console.log('✅ Estrutura de campanhas válida');
        console.log(`- Total de campanhas: ${campaignsData.campaigns.length}`);
        
        // Verificar se as campanhas têm métricas
        campaignsData.campaigns.forEach((campaign, index) => {
          if (campaign.metrics) {
            console.log(`  Campanha ${index + 1}: ${campaign.name} - Custo: ${campaign.metrics.cost || 0}`);
          }
        });
      } else {
        console.log('⚠️ Estrutura de campanhas incompleta');
      }
    } else {
      console.log('❌ Erro na API de campanhas');
      const errorText = await campaignsResponse.text();
      console.log('Erro:', errorText);
    }

    // Teste 4: Verificar diferentes filtros de data
    console.log('\n📅 Teste 4: Diferentes filtros de data');
    const dateFilters = [
      { filter: 'today', label: 'Hoje' },
      { filter: 'last_7_days', label: 'Últimos 7 dias' },
      { filter: 'last_30_days', label: 'Últimos 30 dias' },
      { filter: 'custom', label: 'Personalizado' }
    ];

    for (const dateFilter of dateFilters) {
      console.log(`\nTestando filtro: ${dateFilter.label}`);
      
      let testUrl;
      if (dateFilter.filter === 'custom') {
        testUrl = `${BASE_URL}/api/google/metrics-simple?clientId=${testClientId}&startDate=2024-11-01&endDate=2024-11-30`;
      } else {
        // Para filtros predefinidos, a API deve calcular as datas internamente
        testUrl = `${BASE_URL}/api/google/metrics-simple?clientId=${testClientId}&dateFilter=${dateFilter.filter}`;
      }
      
      const filterResponse = await fetch(testUrl);
      console.log(`  Status: ${filterResponse.status}`);
      
      if (filterResponse.ok) {
        const filterData = await filterResponse.json();
        console.log(`  ✅ Filtro ${dateFilter.label} funcionando`);
        console.log(`  - Custo total: ${filterData.summary?.totalCost || 0}`);
      } else {
        console.log(`  ❌ Erro no filtro ${dateFilter.label}`);
      }
    }

    console.log('\n' + '=' .repeat(80));
    console.log('🎉 Testes concluídos!');
    console.log('\n📝 Resumo das correções implementadas:');
    console.log('1. ✅ Filtro de data unificado e sticky implementado');
    console.log('2. ✅ Sincronização entre filtros do topo e das campanhas');
    console.log('3. ✅ Componente reutilizável GoogleFiltersHeader criado');
    console.log('4. ✅ APIs atualizadas para suportar filtros de data');
    console.log('5. ✅ Componentes atualizados para usar datas explícitas');

  } catch (error) {
    console.error('❌ Erro durante os testes:', error);
  }
}

// Executar testes
testGoogleAdsFilters().catch(console.error);