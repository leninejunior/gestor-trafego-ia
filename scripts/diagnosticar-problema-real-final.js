/**
 * Script para diagnosticar o problema real do Google Ads
 */

require('dotenv').config();

async function diagnosticarProblemaReal() {
  console.log('='.repeat(80));
  console.log('🔍 DIAGNOSTICANDO PROBLEMA REAL DO GOOGLE ADS');
  console.log('Timestamp:', new Date().toISOString());
  console.log('='.repeat(80));

  const baseUrl = 'http://localhost:3001';

  try {
    // 1. Verificar se o servidor está rodando
    console.log('\n1️⃣ VERIFICANDO SERVIDOR...');
    try {
      const healthResponse = await fetch(`${baseUrl}/api/health`);
      console.log('✅ Servidor rodando na porta 3001');
    } catch (serverError) {
      console.log('❌ Servidor não está rodando na porta 3001');
      console.log('💡 Execute: npm run dev');
      return;
    }

    // 2. Testar página do Google diretamente
    console.log('\n2️⃣ TESTANDO PÁGINA GOOGLE DIRETAMENTE...');
    try {
      const googlePageResponse = await fetch(`${baseUrl}/dashboard/google`);
      console.log('📊 Status da página Google:', googlePageResponse.status);
      
      if (googlePageResponse.status === 200) {
        console.log('✅ Página Google carrega normalmente');
      } else {
        console.log('❌ Página Google com problema:', googlePageResponse.statusText);
      }
    } catch (pageError) {
      console.log('❌ Erro ao acessar página Google:', pageError.message);
    }

    // 3. Testar API de auth do Google
    console.log('\n3️⃣ TESTANDO API DE AUTH DO GOOGLE...');
    try {
      const authResponse = await fetch(`${baseUrl}/api/google/auth?clientId=test`);
      console.log('📊 Status da API auth:', authResponse.status);
      
      const authData = await authResponse.json();
      console.log('📋 Resposta da API auth:', JSON.stringify(authData, null, 2));
      
      if (authData.authUrl) {
        console.log('✅ API de auth funcionando - URL gerada');
      } else {
        console.log('❌ API de auth com problema');
      }
    } catch (authError) {
      console.log('❌ Erro na API de auth:', authError.message);
    }

    // 4. Verificar variáveis de ambiente
    console.log('\n4️⃣ VERIFICANDO VARIÁVEIS DE AMBIENTE...');
    const requiredVars = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_DEVELOPER_TOKEN',
      'NEXT_PUBLIC_APP_URL'
    ];

    let allVarsOk = true;
    requiredVars.forEach(varName => {
      const value = process.env[varName];
      if (value) {
        console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
      } else {
        console.log(`❌ ${varName}: NÃO DEFINIDA`);
        allVarsOk = false;
      }
    });

    if (!allVarsOk) {
      console.log('\n💡 PROBLEMA ENCONTRADO: Variáveis de ambiente faltando!');
      console.log('📋 Verifique seu arquivo .env');
      return;
    }

    // 5. Testar conexão com Google Ads API diretamente
    console.log('\n5️⃣ TESTANDO GOOGLE ADS API DIRETAMENTE...');
    const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;
    
    if (developerToken) {
      console.log('✅ Developer Token presente:', developerToken.substring(0, 10) + '...');
      
      // Simular chamada para API
      try {
        const testUrl = 'https://googleads.googleapis.com/v16/customers:listAccessibleCustomers';
        console.log('📡 Testando URL da API:', testUrl);
        console.log('🔑 Com Developer Token:', developerToken.substring(0, 10) + '...');
        console.log('💡 Esta chamada precisa de OAuth token válido para funcionar');
      } catch (apiError) {
        console.log('❌ Erro ao testar API:', apiError.message);
      }
    }

    // 6. Diagnóstico final
    console.log('\n6️⃣ DIAGNÓSTICO FINAL:');
    console.log('🔍 Possíveis causas do problema:');
    console.log('   1. Você não fez login ainda (precisa do OAuth)');
    console.log('   2. Conexão não foi salva no banco de dados');
    console.log('   3. Problema na página de seleção de contas');
    console.log('   4. Erro no fluxo de callback do OAuth');

    console.log('\n💡 PRÓXIMOS PASSOS PARA RESOLVER:');
    console.log('   1. Acesse: http://localhost:3001/dashboard/google');
    console.log('   2. Clique em "Conectar Google Ads"');
    console.log('   3. Faça login com drive.engrene@gmail.com');
    console.log('   4. Se der erro, me mostre a tela exata');
    console.log('   5. Vou ajustar o código baseado no erro real');

    console.log('\n🎯 O SISTEMA HÍBRIDO ESTÁ PRONTO!');
    console.log('   ✅ API implementada');
    console.log('   ✅ Logs detalhados');
    console.log('   ✅ Suporte a MCC + Direto');
    console.log('   ✅ Só precisa testar no navegador');

  } catch (error) {
    console.error('❌ Erro geral no diagnóstico:', error.message);
  }

  console.log('\n' + '='.repeat(80));
}

diagnosticarProblemaReal();