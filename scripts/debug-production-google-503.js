#!/usr/bin/env node

/**
 * Script para diagnosticar erro 503 do Google Auth em produção
 */

console.log('🔍 DIAGNÓSTICO ERRO 503 GOOGLE AUTH - PRODUÇÃO');
console.log('===============================================');

async function debugProductionGoogle503() {
  try {
    // 1. Verificar variáveis de ambiente necessárias
    console.log('\n1. VERIFICANDO VARIÁVEIS DE AMBIENTE:');
    const requiredVars = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET', 
      'GOOGLE_DEVELOPER_TOKEN',
      'GOOGLE_TOKEN_ENCRYPTION_KEY',
      'NEXT_PUBLIC_APP_URL'
    ];

    requiredVars.forEach(varName => {
      const value = process.env[varName];
      if (value) {
        const masked = varName.includes('SECRET') || varName.includes('TOKEN') || varName.includes('KEY')
          ? value.substring(0, 10) + '...'
          : value;
        console.log(`✅ ${varName}: ${masked}`);
      } else {
        console.log(`❌ ${varName}: NÃO DEFINIDA`);
      }
    });

    // 2. Verificar URL da aplicação
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    console.log('\n2. VERIFICANDO URL DA APLICAÇÃO:');
    if (appUrl) {
      console.log(`URL atual: ${appUrl}`);
      if (appUrl.includes('localhost')) {
        console.log('❌ PROBLEMA: URL ainda está como localhost!');
        console.log('   Atualize NEXT_PUBLIC_APP_URL no Vercel com a URL real');
      } else if (appUrl.includes('vercel.app')) {
        console.log('✅ URL do Vercel configurada corretamente');
      } else {
        console.log('⚠️  URL customizada detectada');
      }
    } else {
      console.log('❌ NEXT_PUBLIC_APP_URL não definida');
    }

    // 3. Testar endpoint Google Auth
    console.log('\n3. TESTANDO ENDPOINT GOOGLE AUTH:');
    const baseUrl = appUrl || 'http://localhost:3000';
    const googleAuthUrl = `${baseUrl}/api/google/auth`;
    
    console.log(`Testando: ${googleAuthUrl}`);
    
    try {
      const response = await fetch(googleAuthUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Debug-Script/1.0'
        }
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.status === 503) {
        console.log('❌ ERRO 503 CONFIRMADO');
        console.log('Possíveis causas:');
        console.log('- Variáveis de ambiente não carregadas no Vercel');
        console.log('- Função serverless com timeout');
        console.log('- Problema na configuração do Google Cloud');
        console.log('- Rate limiting do Google');
      }
      
      const responseText = await response.text();
      console.log('Resposta:', responseText.substring(0, 500));
      
    } catch (fetchError) {
      console.log(`❌ Erro na requisição: ${fetchError.message}`);
    }

    // 4. Verificar configuração OAuth do Google
    console.log('\n4. VERIFICANDO CONFIGURAÇÃO OAUTH:');
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (clientId) {
      console.log(`Client ID: ${clientId}`);
      console.log('Verifique no Google Cloud Console:');
      console.log('1. APIs & Services > Credentials');
      console.log('2. OAuth 2.0 Client IDs');
      console.log('3. Authorized redirect URIs deve conter:');
      console.log(`   ${appUrl}/api/google/callback`);
    }

    // 5. Sugestões de correção
    console.log('\n5. SUGESTÕES DE CORREÇÃO:');
    console.log('===============================');
    
    if (appUrl && appUrl.includes('localhost')) {
      console.log('🔧 AÇÃO IMEDIATA:');
      console.log('1. Vá no Vercel Dashboard');
      console.log('2. Settings > Environment Variables');
      console.log('3. Edite NEXT_PUBLIC_APP_URL');
      console.log('4. Substitua por sua URL real do Vercel');
      console.log('5. Redeploy o projeto');
    }
    
    console.log('\n🔧 VERIFICAÇÕES ADICIONAIS:');
    console.log('1. Confirme todas as variáveis no Vercel Dashboard');
    console.log('2. Verifique se o redeploy foi feito após configurar variáveis');
    console.log('3. Teste o endpoint diretamente no navegador');
    console.log('4. Verifique logs de função no Vercel');

    // 6. URLs para verificação
    console.log('\n6. URLS PARA VERIFICAÇÃO:');
    console.log('=========================');
    console.log(`Google Auth: ${baseUrl}/api/google/auth`);
    console.log(`Health Check: ${baseUrl}/api/health`);
    console.log(`Debug Auth: ${baseUrl}/api/debug/auth-status`);

  } catch (error) {
    console.error('❌ Erro durante diagnóstico:', error);
  }
}

// Carregar variáveis de ambiente se disponível
try {
  require('dotenv').config();
} catch (e) {
  // Ignorar se dotenv não estiver disponível
}

debugProductionGoogle503();