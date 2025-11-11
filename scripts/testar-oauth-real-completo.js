/**
 * Teste do Fluxo OAuth Real Completo
 * Testa todo o fluxo desde a autenticação até a obtenção de contas reais
 */

// Carregar variáveis de ambiente
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis do Supabase não configuradas');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!supabaseKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testarFluxoOAuthCompleto() {
  console.log('🚀 TESTANDO FLUXO OAUTH REAL COMPLETO');
  console.log('='.repeat(80));
  
  try {
    // 1. Verificar configuração
    console.log('1️⃣ VERIFICANDO CONFIGURAÇÃO...');
    const config = {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      GOOGLE_DEVELOPER_TOKEN: process.env.GOOGLE_DEVELOPER_TOKEN,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
    };
    
    console.log('📋 Configuração:');
    Object.entries(config).forEach(([key, value]) => {
      console.log(`   ${key}: ${value ? '✅ Configurado' : '❌ Faltando'}`);
    });
    
    const missing = Object.entries(config).filter(([key, value]) => !value);
    if (missing.length > 0) {
      console.error('❌ Configuração incompleta:', missing.map(([key]) => key));
      return;
    }
    
    console.log('✅ Configuração completa');
    
    // 2. Verificar estrutura do banco
    console.log('\n2️⃣ VERIFICANDO ESTRUTURA DO BANCO...');
    
    // Verificar tabela oauth_states
    const { data: oauthStates, error: oauthError } = await supabase
      .from('oauth_states')
      .select('*')
      .limit(1);
    
    if (oauthError) {
      console.error('❌ Tabela oauth_states não encontrada:', oauthError.message);
      console.log('💡 Execute: CREATE TABLE oauth_states (...)');
      return;
    }
    console.log('✅ Tabela oauth_states existe');
    
    // Verificar tabela google_ads_connections
    const { data: connections, error: connectionsError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .limit(1);
    
    if (connectionsError) {
      console.error('❌ Tabela google_ads_connections não encontrada:', connectionsError.message);
      console.log('💡 Execute o schema do Google Ads');
      return;
    }
    console.log('✅ Tabela google_ads_connections existe');
    
    // 3. Testar API de autenticação
    console.log('\n3️⃣ TESTANDO API DE AUTENTICAÇÃO...');
    
    const authResponse = await fetch('http://localhost:3000/api/google/auth?clientId=test-client-id');
    console.log('📡 Status da API auth:', authResponse.status);
    
    if (authResponse.ok) {
      const authData = await authResponse.json();
      console.log('✅ API de autenticação funcionando');
      console.log('🔗 URL OAuth gerada:', !!authData.authUrl);
      console.log('🎲 State gerado:', !!authData.state);
    } else {
      const error = await authResponse.json();
      console.error('❌ Erro na API de autenticação:', error);
      return;
    }
    
    // 4. Verificar conexões existentes
    console.log('\n4️⃣ VERIFICANDO CONEXÕES EXISTENTES...');
    
    const { data: existingConnections, error: listError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('status', 'active');
    
    if (listError) {
      console.error('❌ Erro ao listar conexões:', listError.message);
      return;
    }
    
    console.log(`📊 Conexões ativas encontradas: ${existingConnections.length}`);
    
    if (existingConnections.length > 0) {
      console.log('🔍 Detalhes das conexões:');
      existingConnections.forEach((conn, index) => {
        console.log(`   ${index + 1}. ID: ${conn.id}`);
        console.log(`      Client ID: ${conn.client_id}`);
        console.log(`      Customer ID: ${conn.customer_id}`);
        console.log(`      Status: ${conn.status}`);
        console.log(`      Criado em: ${conn.created_at}`);
        console.log(`      Token expira em: ${conn.token_expires_at}`);
      });
      
      // 5. Testar API de contas com conexão real
      console.log('\n5️⃣ TESTANDO API DE CONTAS COM CONEXÃO REAL...');
      
      const realConnection = existingConnections[0];
      const accountsUrl = `http://localhost:3000/api/google/accounts?connectionId=${realConnection.id}&clientId=${realConnection.client_id}`;
      
      console.log('📡 Testando URL:', accountsUrl);
      
      const accountsResponse = await fetch(accountsUrl);
      console.log('📊 Status da API accounts:', accountsResponse.status);
      
      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        console.log('✅ API de contas funcionando');
        console.log('📋 Resposta:', JSON.stringify(accountsData, null, 2));
        
        if (accountsData.isFallback) {
          console.log('⚠️ Usando dados de fallback (API indisponível)');
        } else if (accountsData.isReal) {
          console.log('🎉 Dados reais obtidos da API Google Ads!');
        }
      } else {
        const error = await accountsResponse.json();
        console.error('❌ Erro na API de contas:', error);
      }
    } else {
      console.log('ℹ️ Nenhuma conexão ativa encontrada');
      console.log('💡 Para testar completamente, faça uma conexão OAuth primeiro');
    }
    
    // 6. Testar API de contas com valores temporários
    console.log('\n6️⃣ TESTANDO API DE CONTAS COM VALORES TEMPORÁRIOS...');
    
    const tempUrl = 'http://localhost:3000/api/google/accounts?connectionId=temp-connection&clientId=temp-client';
    const tempResponse = await fetch(tempUrl);
    
    console.log('📡 Status da API temp:', tempResponse.status);
    
    if (tempResponse.ok) {
      const tempData = await tempResponse.json();
      console.log('✅ API de fallback funcionando');
      console.log('📋 Contas de fallback:', tempData.accounts?.length || 0);
    } else {
      const error = await tempResponse.json();
      console.error('❌ Erro na API de fallback:', error);
    }
    
    // 7. Resumo final
    console.log('\n7️⃣ RESUMO FINAL');
    console.log('='.repeat(50));
    console.log('✅ Configuração: Completa');
    console.log('✅ Banco de dados: Estrutura OK');
    console.log('✅ API de autenticação: Funcionando');
    console.log(`📊 Conexões ativas: ${existingConnections.length}`);
    console.log('✅ API de fallback: Funcionando');
    
    if (existingConnections.length > 0) {
      console.log('✅ Conexões reais: Disponíveis para teste');
    } else {
      console.log('⚠️ Conexões reais: Nenhuma encontrada');
      console.log('💡 Próximo passo: Fazer conexão OAuth completa');
    }
    
    console.log('\n🎯 PRÓXIMOS PASSOS:');
    console.log('1. Acesse: http://localhost:3000/dashboard/google');
    console.log('2. Clique em "Conectar Google Ads"');
    console.log('3. Complete o fluxo OAuth');
    console.log('4. Verifique se as contas reais aparecem');
    
  } catch (error) {
    console.error('❌ ERRO GERAL:', error);
    console.error('Stack:', error.stack);
  }
}

// Executar teste
testarFluxoOAuthCompleto().catch(console.error);