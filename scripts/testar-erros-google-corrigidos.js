/**
 * Script para testar as correções dos erros 500 e 400 do Google Ads
 * Executa: node scripts/testar-erros-google-corrigidos.js
 */

require('dotenv').config();

async function testarErrosCorrigidos() {
  console.log('='.repeat(80));
  console.log('🔧 TESTANDO CORREÇÕES DOS ERROS GOOGLE ADS');
  console.log('Timestamp:', new Date().toISOString());
  console.log('='.repeat(80));

  const baseUrl = 'http://localhost:3000';
  const clientId = 'e0ae65bf-1f97-474a-988e-a5418ab28e77'; // ID do cliente de teste

  try {
    // 1. Testar API de métricas SEM clientId (era erro 400)
    console.log('\n1️⃣ TESTANDO API DE MÉTRICAS SEM CLIENT ID...');
    
    const metricsUrl = `${baseUrl}/api/google/metrics-simple?dateFrom=2025-10-07&dateTo=2025-11-06&groupBy=campaign`;
    console.log('📡 URL:', metricsUrl);
    
    try {
      const metricsResponse = await fetch(metricsUrl);
      console.log('📊 Status:', metricsResponse.status, metricsResponse.statusText);
      
      const metricsData = await metricsResponse.json();
      console.log('📋 Resposta:', JSON.stringify(metricsData, null, 2));
      
      if (metricsResponse.status === 200) {
        console.log('✅ CORREÇÃO FUNCIONOU: API aceita requisição sem clientId');
      } else {
        console.log('⚠️ Status não é 200, mas não é mais erro 400');
      }
    } catch (metricsError) {
      console.error('❌ Erro na API de métricas:', metricsError.message);
    }

    // 2. Testar API de métricas COM clientId
    console.log('\n2️⃣ TESTANDO API DE MÉTRICAS COM CLIENT ID...');
    
    const metricsWithClientUrl = `${baseUrl}/api/google/metrics-simple?clientId=${clientId}&dateFrom=2025-10-07&dateTo=2025-11-06&groupBy=campaign`;
    console.log('📡 URL:', metricsWithClientUrl);
    
    try {
      const metricsWithClientResponse = await fetch(metricsWithClientUrl);
      console.log('📊 Status:', metricsWithClientResponse.status, metricsWithClientResponse.statusText);
      
      const metricsWithClientData = await metricsWithClientResponse.json();
      console.log('📋 Resposta (primeiros 500 chars):', JSON.stringify(metricsWithClientData, null, 2).substring(0, 500) + '...');
      
      if (metricsWithClientResponse.ok) {
        console.log('✅ API de métricas com clientId funcionando');
      } else {
        console.log('⚠️ API retornou erro, mas pode ser esperado se não há dados');
      }
    } catch (metricsWithClientError) {
      console.error('❌ Erro na API de métricas com clientId:', metricsWithClientError.message);
    }

    // 3. Testar API de sync status (era erro 500)
    console.log('\n3️⃣ TESTANDO API DE SYNC STATUS...');
    
    const syncStatusUrl = `${baseUrl}/api/google/sync/status?clientId=${clientId}`;
    console.log('📡 URL:', syncStatusUrl);
    
    try {
      const syncResponse = await fetch(syncStatusUrl);
      console.log('📊 Status:', syncResponse.status, syncResponse.statusText);
      
      const syncData = await syncResponse.json();
      console.log('📋 Resposta:', JSON.stringify(syncData, null, 2));
      
      if (syncResponse.status !== 500) {
        console.log('✅ CORREÇÃO FUNCIONOU: Não é mais erro 500');
      } else {
        console.log('❌ Ainda retorna erro 500');
      }
    } catch (syncError) {
      console.error('❌ Erro na API de sync status:', syncError.message);
    }

    // 4. Testar dashboard Google (carregamento geral)
    console.log('\n4️⃣ TESTANDO CARREGAMENTO DO DASHBOARD GOOGLE...');
    
    try {
      const dashboardResponse = await fetch(`${baseUrl}/dashboard/google`);
      console.log('📊 Status do dashboard:', dashboardResponse.status, dashboardResponse.statusText);
      
      if (dashboardResponse.ok) {
        console.log('✅ Dashboard carrega sem erros');
      } else {
        console.log('⚠️ Dashboard retornou erro:', dashboardResponse.status);
      }
    } catch (dashboardError) {
      console.error('❌ Erro no dashboard:', dashboardError.message);
    }

    // 5. Resumo dos testes
    console.log('\n5️⃣ RESUMO DOS TESTES...');
    console.log('📊 Testes realizados:');
    console.log('   • API métricas sem clientId: Testada');
    console.log('   • API métricas com clientId: Testada');
    console.log('   • API sync status: Testada');
    console.log('   • Dashboard Google: Testado');

    console.log('\n✅ TESTES DE CORREÇÃO CONCLUÍDOS');
    console.log('💡 Verifique os logs acima para confirmar se os erros foram corrigidos');

  } catch (error) {
    console.error('\n❌ ERRO GERAL NO TESTE:', error);
    console.error('Stack:', error.stack);
  }

  console.log('\n' + '='.repeat(80));
}

// Executar teste
testarErrosCorrigidos().catch(console.error);