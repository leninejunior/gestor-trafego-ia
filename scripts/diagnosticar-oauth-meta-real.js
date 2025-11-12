const axios = require('axios');

async function diagnosticarOAuthMeta() {
  console.log('🔍 Diagnóstico Completo OAuth Meta\n');
  
  const baseUrl = 'https://gestor.engrene.com';
  
  // 1. Simular callback com código válido (vai falhar mas mostra o erro real)
  console.log('1️⃣ Testando callback com código de teste...');
  try {
    const response = await axios.get(`${baseUrl}/api/meta/callback`, {
      params: {
        code: 'TEST_CODE_123',
        state: 'client_test_1234567890'
      },
      maxRedirects: 0,
      validateStatus: () => true
    });
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Location: ${response.headers.location}`);
    
    if (response.headers.location) {
      const url = new URL(response.headers.location);
      const error = url.searchParams.get('error');
      const details = url.searchParams.get('details');
      
      if (error) {
        console.log(`   ❌ Erro: ${error}`);
        if (details) {
          console.log(`   📝 Detalhes: ${decodeURIComponent(details)}`);
        }
      }
    }
  } catch (error) {
    console.log(`   ❌ Erro na requisição: ${error.message}`);
  }
  
  console.log('\n2️⃣ Verificando logs do Vercel...');
  console.log('   Acesse: https://vercel.com/seu-projeto/logs');
  console.log('   Procure por erros na rota /api/meta/callback\n');
  
  console.log('3️⃣ Verificando configuração do Facebook App...');
  console.log('   App ID: 925924588141447');
  console.log('   Callback URL configurada: https://gestor.engrene.com/api/meta/callback');
  console.log('   Verifique em: https://developers.facebook.com/apps/925924588141447/settings/basic/\n');
  
  console.log('4️⃣ Possíveis causas do problema:');
  console.log('   ❌ Token expirado ou inválido');
  console.log('   ❌ App Secret incorreto');
  console.log('   ❌ Callback URL não autorizada no Facebook');
  console.log('   ❌ Permissões insuficientes no Facebook App');
  console.log('   ❌ Deploy do Vercel não completou\n');
  
  console.log('5️⃣ SOLUÇÃO RÁPIDA:');
  console.log('   1. Acesse: https://developers.facebook.com/apps/925924588141447/settings/basic/');
  console.log('   2. Verifique se a URL de callback está autorizada:');
  console.log('      https://gestor.engrene.com/api/meta/callback');
  console.log('   3. Gere um novo token de acesso se necessário');
  console.log('   4. Atualize META_ACCESS_TOKEN no Vercel');
  console.log('   5. Force um redeploy no Vercel\n');
  
  console.log('6️⃣ Para testar localmente:');
  console.log('   1. Execute: pnpm dev');
  console.log('   2. Use ngrok para expor: ngrok http 3000');
  console.log('   3. Atualize callback URL no Facebook para a URL do ngrok');
  console.log('   4. Teste o fluxo OAuth\n');
}

diagnosticarOAuthMeta().catch(console.error);
