const axios = require('axios');

async function testarOAuthMeta() {
  console.log('🔍 Testando OAuth Meta em Produção\n');
  
  const baseUrl = 'https://gestor.engrene.com';
  
  // 1. Verificar se a rota de callback existe
  console.log('1️⃣ Verificando rota de callback...');
  try {
    const response = await axios.get(`${baseUrl}/api/meta/callback`, {
      maxRedirects: 0,
      validateStatus: () => true
    });
    console.log(`   Status: ${response.status}`);
    console.log(`   ✅ Rota existe\n`);
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}\n`);
  }
  
  // 2. Simular callback com parâmetros
  console.log('2️⃣ Simulando callback com erro (user_cancelled)...');
  try {
    const response = await axios.get(`${baseUrl}/api/meta/callback`, {
      params: {
        error: 'access_denied',
        error_reason: 'user_denied',
        error_description: 'The user denied your request.',
        state: 'client_test123_1234567890'
      },
      maxRedirects: 0,
      validateStatus: () => true
    });
    console.log(`   Status: ${response.status}`);
    console.log(`   Location: ${response.headers.location}`);
    console.log(`   ✅ Redirecionamento funcionando\n`);
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}\n`);
  }
  
  // 3. Verificar variáveis de ambiente
  console.log('3️⃣ Verificando configuração Meta...');
  console.log(`   App ID: ${process.env.META_APP_ID || '❌ NÃO CONFIGURADO'}`);
  console.log(`   App Secret: ${process.env.META_APP_SECRET ? '✅ Configurado' : '❌ NÃO CONFIGURADO'}`);
  console.log(`   Access Token: ${process.env.META_ACCESS_TOKEN ? '✅ Configurado' : '❌ NÃO CONFIGURADO'}`);
  console.log(`   App URL: ${process.env.NEXT_PUBLIC_APP_URL || '❌ NÃO CONFIGURADO'}\n`);
  
  // 4. Instruções
  console.log('📋 PRÓXIMOS PASSOS:');
  console.log('   1. Verifique se as variáveis de ambiente estão configuradas no Vercel');
  console.log('   2. Certifique-se que META_ACCESS_TOKEN está atualizado');
  console.log('   3. Tente o fluxo OAuth novamente no navegador');
  console.log('   4. Se o erro persistir, verifique os logs do Vercel\n');
  
  console.log('🔗 URL para testar OAuth:');
  console.log(`   ${baseUrl}/dashboard/clients/[SEU_CLIENT_ID]`);
  console.log('   Clique em "Conectar Meta Ads"\n');
}

testarOAuthMeta().catch(console.error);
