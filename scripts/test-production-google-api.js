/**
 * Teste da API do Google Ads em Produção
 * Verifica se a rota /api/google/accounts está funcionando
 */

const baseUrl = 'https://gestor.engrene.com';

async function testProductionAPI() {
  console.log('🔍 TESTANDO API DO GOOGLE ADS EM PRODUÇÃO');
  console.log('='.repeat(60));
  
  try {
    // 1. Testar se a rota existe
    console.log('\n1️⃣ TESTANDO SE A ROTA EXISTE...');
    const testUrl = `${baseUrl}/api/google/accounts?connectionId=test&clientId=test`;
    console.log('📡 URL:', testUrl);
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log('\n📊 RESPOSTA:');
    console.log('- Status:', response.status);
    console.log('- Status Text:', response.statusText);
    console.log('- Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('- Body:', responseText);
    
    if (response.status === 404) {
      console.log('\n❌ ROTA NÃO ENCONTRADA EM PRODUÇÃO');
      console.log('Possíveis causas:');
      console.log('1. Deploy ainda não foi concluído');
      console.log('2. Cache do Vercel/CDN');
      console.log('3. Problema no build de produção');
      
      // Testar outras rotas do Google para comparar
      console.log('\n🔍 TESTANDO OUTRAS ROTAS DO GOOGLE...');
      
      const otherRoutes = [
        '/api/google/auth',
        '/api/google/callback',
        '/api/google/accounts-simple',
        '/api/google/accounts-debug'
      ];
      
      for (const route of otherRoutes) {
        try {
          const testResponse = await fetch(`${baseUrl}${route}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          console.log(`- ${route}: ${testResponse.status} ${testResponse.statusText}`);
        } catch (error) {
          console.log(`- ${route}: ERRO - ${error.message}`);
        }
      }
      
    } else if (response.status === 400 || response.status === 500) {
      console.log('\n✅ ROTA ENCONTRADA (erro esperado sem parâmetros válidos)');
      
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log('- Resposta JSON:', JSON.stringify(jsonResponse, null, 2));
      } catch (e) {
        console.log('- Resposta não é JSON válido');
      }
      
    } else {
      console.log('\n✅ ROTA FUNCIONANDO');
    }
    
    // 2. Testar com diferentes User-Agents
    console.log('\n2️⃣ TESTANDO COM DIFERENTES USER-AGENTS...');
    
    const userAgents = [
      'curl/7.68.0',
      'PostmanRuntime/7.28.0',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    ];
    
    for (const ua of userAgents) {
      try {
        const uaResponse = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': ua
          }
        });
        console.log(`- ${ua}: ${uaResponse.status}`);
      } catch (error) {
        console.log(`- ${ua}: ERRO - ${error.message}`);
      }
    }
    
    // 3. Verificar se é problema de cache
    console.log('\n3️⃣ TESTANDO BYPASS DE CACHE...');
    
    const cacheBypassUrl = `${testUrl}&_t=${Date.now()}&_bypass=true`;
    console.log('📡 URL com bypass:', cacheBypassUrl);
    
    try {
      const bypassResponse = await fetch(cacheBypassUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      console.log('- Status com bypass:', bypassResponse.status);
      
      if (bypassResponse.status !== response.status) {
        console.log('⚠️ DIFERENÇA DETECTADA - PODE SER PROBLEMA DE CACHE');
      }
      
    } catch (error) {
      console.log('- Erro no teste de bypass:', error.message);
    }
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error);
    console.error('- Mensagem:', error.message);
    console.error('- Stack:', error.stack);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 TESTE CONCLUÍDO');
}

// Executar teste
testProductionAPI().catch(console.error);