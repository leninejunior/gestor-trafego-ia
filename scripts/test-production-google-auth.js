#!/usr/bin/env node

/**
 * Script para testar Google Auth em produção
 * URL: gestor.engrene.com
 */

console.log('🔍 TESTANDO GOOGLE AUTH EM PRODUÇÃO');
console.log('==================================');
console.log('URL: https://gestor.engrene.com');

async function testProductionGoogleAuth() {
  try {
    const baseUrl = 'https://gestor.engrene.com';
    const clientId = 'e0ae65bf-1f97-474a-988e-a5418ab28e77'; // Do log que você mostrou
    
    // 1. Testar Health Check primeiro
    console.log('\n1. TESTANDO HEALTH CHECK:');
    try {
      const healthResponse = await fetch(`${baseUrl}/api/health`);
      console.log(`Health Status: ${healthResponse.status}`);
      if (healthResponse.ok) {
        const healthData = await healthResponse.text();
        console.log('Health Response:', healthData.substring(0, 200));
      }
    } catch (e) {
      console.log('Health check falhou:', e.message);
    }

    // 2. Testar Google Auth endpoint
    console.log('\n2. TESTANDO GOOGLE AUTH ENDPOINT:');
    const googleAuthUrl = `${baseUrl}/api/google/auth?clientId=${clientId}`;
    console.log(`URL: ${googleAuthUrl}`);
    
    try {
      const response = await fetch(googleAuthUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Production-Test/1.0',
          'Accept': 'application/json'
        }
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      const responseText = await response.text();
      console.log('Response Body:', responseText);
      
      if (response.status === 503) {
        console.log('\n❌ ERRO 503 CONFIRMADO EM PRODUÇÃO');
        console.log('Possíveis causas:');
        console.log('1. NEXT_PUBLIC_APP_URL ainda está como localhost no Vercel');
        console.log('2. Variáveis de ambiente Google não configuradas no Vercel');
        console.log('3. Função serverless com timeout');
        console.log('4. Problema na configuração do Google Cloud');
        
        // Tentar parsear resposta JSON para mais detalhes
        try {
          const errorData = JSON.parse(responseText);
          console.log('\nDetalhes do erro:', errorData);
        } catch (parseError) {
          console.log('Resposta não é JSON válido');
        }
      }
      
    } catch (fetchError) {
      console.log(`❌ Erro na requisição: ${fetchError.message}`);
    }

    // 3. Testar outros endpoints para comparação
    console.log('\n3. TESTANDO OUTROS ENDPOINTS PARA COMPARAÇÃO:');
    
    // Testar Meta Auth (que funciona)
    try {
      const metaAuthUrl = `${baseUrl}/api/meta/auth`;
      const metaResponse = await fetch(metaAuthUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientId })
      });
      console.log(`Meta Auth Status: ${metaResponse.status}`);
    } catch (e) {
      console.log('Meta Auth test falhou:', e.message);
    }

    // 4. Instruções de correção
    console.log('\n4. INSTRUÇÕES DE CORREÇÃO:');
    console.log('=============================');
    console.log('🔧 AÇÃO IMEDIATA NO VERCEL:');
    console.log('1. Vá em https://vercel.com/dashboard');
    console.log('2. Selecione seu projeto');
    console.log('3. Settings > Environment Variables');
    console.log('4. Verifique/atualize estas variáveis:');
    console.log('   - NEXT_PUBLIC_APP_URL = https://gestor.engrene.com');
    console.log('   - GOOGLE_CLIENT_ID = (sua chave do Google)');
    console.log('   - GOOGLE_CLIENT_SECRET = (seu secret do Google)');
    console.log('   - GOOGLE_DEVELOPER_TOKEN = (seu token do Google)');
    console.log('   - GOOGLE_TOKEN_ENCRYPTION_KEY = (sua chave de criptografia)');
    console.log('5. Após salvar, faça REDEPLOY obrigatório');

    console.log('\n🔧 CONFIGURAÇÃO OAUTH NO GOOGLE CLOUD:');
    console.log('1. Vá em https://console.cloud.google.com');
    console.log('2. APIs & Services > Credentials');
    console.log('3. Edite seu OAuth 2.0 Client ID');
    console.log('4. Authorized redirect URIs deve conter:');
    console.log('   https://gestor.engrene.com/api/google/callback');
    console.log('5. Salve as alterações');

    console.log('\n📋 CHECKLIST DE VERIFICAÇÃO:');
    console.log('- [ ] NEXT_PUBLIC_APP_URL = https://gestor.engrene.com');
    console.log('- [ ] Todas as variáveis Google configuradas no Vercel');
    console.log('- [ ] Redeploy feito após configurar variáveis');
    console.log('- [ ] OAuth callback configurado no Google Cloud');
    console.log('- [ ] Teste do endpoint retorna 200 ou 302 (não 503)');

  } catch (error) {
    console.error('❌ Erro durante teste:', error);
  }
}

testProductionGoogleAuth();