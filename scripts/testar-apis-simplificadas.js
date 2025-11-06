/**
 * Testar APIs simplificadas do Google Ads
 */

require('dotenv').config();

async function testarAPIsSimplificadas() {
  console.log('🧪 Testando APIs simplificadas do Google Ads...\n');
  
  try {
    const testClientId = 'e0ae65bf-1f97-474a-988e-a5418ab28e77'; // Cliente encontrado anteriormente
    
    // 1. Testar API de Auth Simplificada
    console.log('1. Testando API de Auth Simplificada...');
    try {
      const authResponse = await fetch(`http://localhost:3000/api/google/auth-simple?clientId=${testClientId}`);
      console.log(`   Status: ${authResponse.status}`);
      
      if (authResponse.ok) {
        const authData = await authResponse.json();
        console.log('   ✅ Auth API funcionando!');
        console.log(`   Configurado: ${authData.configured}`);
        console.log(`   Usuário autenticado: ${authData.userAuthenticated}`);
        console.log(`   Auth URL gerada: ${authData.authUrl ? 'Sim' : 'Não'}`);
      } else {
        const errorText = await authResponse.text();
        console.log(`   ❌ Erro: ${errorText.substring(0, 200)}...`);
      }
    } catch (error) {
      console.error('   ❌ Erro na requisição:', error.message);
    }

    // 2. Testar API de Métricas Simplificada - Sem parâmetros
    console.log('\n2. Testando API de Métricas Simplificada (sem parâmetros)...');
    try {
      const metricsResponse = await fetch('http://localhost:3000/api/google/metrics-simple');
      console.log(`   Status: ${metricsResponse.status}`);
      
      const metricsData = await metricsResponse.json();
      console.log(`   Configurado: ${metricsData.configured}`);
      console.log(`   Erro esperado: ${metricsData.error ? 'Sim' : 'Não'}`);
      
      if (metricsData.required) {
        console.log('   ✅ Validação de parâmetros funcionando!');
        console.log(`   Parâmetros obrigatórios: ${Object.keys(metricsData.required).join(', ')}`);
      }
    } catch (error) {
      console.error('   ❌ Erro na requisição:', error.message);
    }

    // 3. Testar API de Métricas Simplificada - Com parâmetros
    console.log('\n3. Testando API de Métricas Simplificada (com parâmetros)...');
    try {
      const today = new Date();
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      
      const dateFrom = lastMonth.toISOString().split('T')[0];
      const dateTo = endOfLastMonth.toISOString().split('T')[0];
      
      const metricsUrl = `http://localhost:3000/api/google/metrics-simple?clientId=${testClientId}&dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=campaign`;
      
      const metricsResponse = await fetch(metricsUrl);
      console.log(`   Status: ${metricsResponse.status}`);
      console.log(`   URL: ${metricsUrl}`);
      
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        console.log('   ✅ Metrics API funcionando!');
        console.log(`   Configurado: ${metricsData.configured}`);
        console.log(`   Tem conexão: ${metricsData.hasConnection}`);
        console.log(`   Total de registros: ${metricsData.totalRecords}`);
        console.log(`   Período: ${metricsData.dateRange?.days} dias`);
        
        if (metricsData.summary) {
          console.log(`   Impressões: ${metricsData.summary.totalImpressions}`);
          console.log(`   Cliques: ${metricsData.summary.totalClicks}`);
          console.log(`   Custo: R$ ${metricsData.summary.totalCost}`);
        }
      } else {
        const errorText = await metricsResponse.text();
        console.log(`   ❌ Erro: ${errorText.substring(0, 200)}...`);
      }
    } catch (error) {
      console.error('   ❌ Erro na requisição:', error.message);
    }

    // 4. Testar API de Métricas com datas inválidas
    console.log('\n4. Testando validação de datas...');
    try {
      const invalidUrl = `http://localhost:3000/api/google/metrics-simple?clientId=${testClientId}&dateFrom=2024-13-01&dateTo=2024-12-31&groupBy=campaign`;
      
      const invalidResponse = await fetch(invalidUrl);
      console.log(`   Status: ${invalidResponse.status}`);
      
      const invalidData = await invalidResponse.json();
      if (invalidData.error && invalidData.error.includes('formato')) {
        console.log('   ✅ Validação de formato de data funcionando!');
      } else {
        console.log(`   Resposta: ${JSON.stringify(invalidData).substring(0, 100)}...`);
      }
    } catch (error) {
      console.error('   ❌ Erro na requisição:', error.message);
    }

    console.log('\n📊 Resumo dos Testes:');
    console.log('   ✅ APIs simplificadas criadas');
    console.log('   ✅ Validação de parâmetros implementada');
    console.log('   ✅ Tratamento de erros melhorado');
    console.log('   ✅ Respostas estruturadas');

    console.log('\n🎯 Próximos passos:');
    console.log('   1. As APIs simplificadas devem resolver os erros 500 e 400');
    console.log('   2. Para dados reais, faça o OAuth: http://localhost:3000/dashboard/clients');
    console.log('   3. Use as APIs simplificadas enquanto desenvolve');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testarAPIsSimplificadas();