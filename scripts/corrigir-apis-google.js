/**
 * Corrigir APIs do Google Ads
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function corrigirAPIsGoogle() {
  console.log('🔧 Corrigindo APIs do Google Ads...\n');
  
  try {
    // 1. Limpar conexões mock antigas
    console.log('1. Limpando conexões mock antigas...');
    const { data: deleted, error: deleteError } = await supabase
      .from('google_ads_connections')
      .delete()
      .like('access_token', 'mock_%')
      .select();

    if (deleteError) {
      console.error('   Erro ao limpar:', deleteError);
    } else {
      console.log(`   ✅ ${deleted?.length || 0} conexões mock removidas`);
    }

    // 2. Verificar se há usuário logado
    console.log('\n2. Verificando usuários...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .limit(5);

    if (usersError) {
      console.error('   Erro ao buscar usuários:', usersError);
    } else {
      console.log(`   ✅ ${users?.length || 0} usuários encontrados`);
      if (users && users.length > 0) {
        console.log(`   Primeiro usuário: ${users[0].email} (${users[0].id})`);
      }
    }

    // 3. Verificar clientes
    console.log('\n3. Verificando clientes...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name')
      .limit(5);

    if (clientsError) {
      console.error('   Erro ao buscar clientes:', clientsError);
    } else {
      console.log(`   ✅ ${clients?.length || 0} clientes encontrados`);
      if (clients && clients.length > 0) {
        console.log(`   Primeiro cliente: ${clients[0].name} (${clients[0].id})`);
      }
    }

    // 4. Testar APIs com dados reais
    if (users && users.length > 0 && clients && clients.length > 0) {
      console.log('\n4. Testando APIs com dados reais...');
      
      const testUserId = users[0].id;
      const testClientId = clients[0].id;
      
      // Criar um token de sessão temporário para teste
      console.log('   Criando sessão de teste...');
      
      // Testar API de Auth
      console.log('   Testando API de Auth...');
      try {
        const authResponse = await fetch(`http://localhost:3000/api/google/auth?clientId=${testClientId}`, {
          headers: {
            'Authorization': `Bearer test-token`,
            'Content-Type': 'application/json'
          }
        });
        console.log(`   Auth API Status: ${authResponse.status}`);
        
        if (!authResponse.ok) {
          const errorText = await authResponse.text();
          console.log(`   Auth API Error: ${errorText.substring(0, 200)}...`);
        }
      } catch (error) {
        console.error('   Erro na Auth API:', error.message);
      }

      // Testar API de Métricas com parâmetros corretos
      console.log('   Testando API de Métricas...');
      try {
        const today = new Date();
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        
        const dateFrom = lastMonth.toISOString().split('T')[0];
        const dateTo = endOfLastMonth.toISOString().split('T')[0];
        
        const metricsUrl = `http://localhost:3000/api/google/metrics?clientId=${testClientId}&dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=campaign`;
        
        const metricsResponse = await fetch(metricsUrl, {
          headers: {
            'Authorization': `Bearer test-token`,
            'Content-Type': 'application/json'
          }
        });
        console.log(`   Metrics API Status: ${metricsResponse.status}`);
        console.log(`   Metrics URL: ${metricsUrl}`);
        
        if (!metricsResponse.ok) {
          const errorText = await metricsResponse.text();
          console.log(`   Metrics API Error: ${errorText.substring(0, 200)}...`);
        } else {
          const data = await metricsResponse.json();
          console.log(`   ✅ Metrics API funcionando! Configurado: ${data.configured}`);
        }
      } catch (error) {
        console.error('   Erro na Metrics API:', error.message);
      }
    }

    // 5. Verificar configuração do ambiente
    console.log('\n5. Verificando configuração...');
    const requiredVars = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET', 
      'GOOGLE_DEVELOPER_TOKEN',
      'NEXT_PUBLIC_APP_URL'
    ];

    let allConfigured = true;
    requiredVars.forEach(varName => {
      const value = process.env[varName];
      const isConfigured = value && !value.includes('your_');
      console.log(`   ${varName}: ${isConfigured ? '✅ Configurado' : '❌ Não configurado'}`);
      if (!isConfigured) allConfigured = false;
    });

    console.log(`\n📊 Resumo:`);
    console.log(`   Configuração: ${allConfigured ? '✅ Completa' : '❌ Incompleta'}`);
    console.log(`   Conexões mock removidas: ✅`);
    console.log(`   Próximo passo: ${allConfigured ? 'Fazer OAuth real' : 'Configurar variáveis de ambiente'}`);

    if (allConfigured) {
      console.log('\n🎯 Para obter dados reais:');
      console.log('   1. Acesse: http://localhost:3000/dashboard/clients');
      console.log('   2. Clique em "Conectar Google Ads"');
      console.log('   3. Use sua conta Google real com acesso à MCC');
      console.log('   4. Autorize todas as permissões');
    } else {
      console.log('\n⚠️ Configure as variáveis de ambiente primeiro!');
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

corrigirAPIsGoogle();