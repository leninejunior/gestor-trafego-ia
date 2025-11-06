/**
 * Script para testar todo o fluxo Google Ads com logs detalhados
 * Executa: node scripts/testar-google-completo-com-logs.js
 */

const { createClient } = require('@supabase/supabase-js');

// Carregar variáveis de ambiente do arquivo .env
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testarFluxoCompleto() {
  console.log('='.repeat(80));
  console.log('🧪 TESTE COMPLETO DO FLUXO GOOGLE ADS COM LOGS DETALHADOS');
  console.log('Timestamp:', new Date().toISOString());
  console.log('='.repeat(80));

  try {
    // 1. Verificar configuração das variáveis de ambiente
    console.log('\n1️⃣ VERIFICANDO CONFIGURAÇÃO DAS VARIÁVEIS DE AMBIENTE...');
    
    const requiredVars = {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      GOOGLE_DEVELOPER_TOKEN: process.env.GOOGLE_DEVELOPER_TOKEN,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
    };

    console.log('📋 Status das variáveis:');
    for (const [key, value] of Object.entries(requiredVars)) {
      console.log(`   ${key}: ${value ? '✅ Configurada' : '❌ Ausente'} (${value?.length || 0} chars)`);
    }

    const missingVars = Object.entries(requiredVars).filter(([key, value]) => !value);
    if (missingVars.length > 0) {
      console.log('❌ Variáveis ausentes:', missingVars.map(([key]) => key));
      return;
    }

    console.log('✅ Todas as variáveis estão configuradas');

    // 2. Verificar estrutura do banco de dados
    console.log('\n2️⃣ VERIFICANDO ESTRUTURA DO BANCO DE DADOS...');
    
    // Verificar tabelas diretamente
    const { data: googleTable, error: googleError } = await supabase
      .from('google_ads_connections')
      .select('count')
      .limit(1);
    
    const { data: oauthTable, error: oauthError } = await supabase
      .from('oauth_states')
      .select('count')
      .limit(1);

    console.log('📊 Verificação de tabelas:');
    console.log(`   google_ads_connections: ${googleError ? '❌ Não encontrada' : '✅ Existe'}`);
    console.log(`   oauth_states: ${oauthError ? '❌ Não encontrada' : '✅ Existe'}`);

    if (googleError && oauthError) {
      console.error('❌ Nenhuma tabela encontrada');
      return;
    }

    // 3. Verificar conexões Google existentes
    console.log('\n3️⃣ VERIFICANDO CONEXÕES GOOGLE EXISTENTES...');
    
    const { data: connections, error: connectionsError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .limit(5);

    if (connectionsError) {
      console.error('❌ Erro ao buscar conexões:', connectionsError);
    } else {
      console.log(`📊 Total de conexões encontradas: ${connections.length}`);
      connections.forEach((conn, index) => {
        console.log(`   ${index + 1}. ID: ${conn.id}, Client: ${conn.client_id}, Customer: ${conn.customer_id}, Status: ${conn.status}`);
      });
    }

    // 4. Testar API de autenticação
    console.log('\n4️⃣ TESTANDO API DE AUTENTICAÇÃO...');
    
    try {
      const authResponse = await fetch('http://localhost:3000/api/google/auth-simple?clientId=test-client-id');
      console.log('📡 Resposta da API auth:', authResponse.status, authResponse.statusText);
      
      const authData = await authResponse.json();
      console.log('📋 Dados da resposta:', JSON.stringify(authData, null, 2));
    } catch (authError) {
      console.error('❌ Erro ao testar API de auth:', authError.message);
    }

    // 5. Testar API de contas (se houver conexão)
    if (connections && connections.length > 0) {
      console.log('\n5️⃣ TESTANDO API DE CONTAS...');
      
      const testConnection = connections[0];
      console.log(`🔍 Testando com conexão: ${testConnection.id}`);
      
      try {
        const accountsUrl = `http://localhost:3000/api/google/accounts?connectionId=${testConnection.id}&clientId=${testConnection.client_id}`;
        console.log('📡 URL da API:', accountsUrl);
        
        const accountsResponse = await fetch(accountsUrl);
        console.log('📊 Resposta da API accounts:', accountsResponse.status, accountsResponse.statusText);
        
        const accountsData = await accountsResponse.json();
        console.log('📋 Dados das contas:', JSON.stringify(accountsData, null, 2));
      } catch (accountsError) {
        console.error('❌ Erro ao testar API de contas:', accountsError.message);
      }
    } else {
      console.log('\n5️⃣ PULANDO TESTE DE API DE CONTAS (nenhuma conexão encontrada)');
    }

    // 6. Testar página do dashboard
    console.log('\n6️⃣ TESTANDO CARREGAMENTO DO DASHBOARD...');
    
    try {
      const dashboardResponse = await fetch('http://localhost:3000/dashboard/google');
      console.log('📡 Resposta do dashboard:', dashboardResponse.status, dashboardResponse.statusText);
      
      if (dashboardResponse.ok) {
        console.log('✅ Dashboard carregou com sucesso');
      } else {
        console.log('⚠️ Dashboard retornou erro:', dashboardResponse.status);
      }
    } catch (dashboardError) {
      console.error('❌ Erro ao testar dashboard:', dashboardError.message);
    }

    // 7. Verificar logs do sistema
    console.log('\n7️⃣ RESUMO DO SISTEMA...');
    
    console.log('📊 Estatísticas:');
    console.log(`   • Conexões Google: ${connections?.length || 0}`);
    console.log(`   • Conexões ativas: ${connections?.filter(c => c.status === 'active').length || 0}`);
    console.log(`   • Conexões pendentes: ${connections?.filter(c => c.customer_id === 'pending').length || 0}`);

    console.log('\n✅ TESTE COMPLETO FINALIZADO');
    console.log('💡 Para ver logs detalhados, execute as funções através do navegador');
    console.log('🔗 Acesse: http://localhost:3000/dashboard/google');

  } catch (error) {
    console.error('\n❌ ERRO GERAL NO TESTE:', error);
    console.error('Stack:', error.stack);
  }

  console.log('\n' + '='.repeat(80));
}

// Executar teste
testarFluxoCompleto().catch(console.error);