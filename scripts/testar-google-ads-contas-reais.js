/**
 * Teste para verificar se conseguimos buscar contas reais do Google Ads
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testarContasReais() {
  console.log('🔍 Testando busca de contas reais do Google Ads...\n');

  try {
    // Verificar variáveis de ambiente
    console.log('📋 Verificando configuração:');
    console.log('- GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Configurado' : '❌ Não configurado');
    console.log('- GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ Configurado' : '❌ Não configurado');
    console.log('- GOOGLE_DEVELOPER_TOKEN:', process.env.GOOGLE_DEVELOPER_TOKEN ? '✅ Configurado' : '❌ Não configurado');
    console.log('');

    if (!process.env.GOOGLE_DEVELOPER_TOKEN) {
      console.log('❌ Developer Token não configurado!');
      return;
    }

    // Conectar ao Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Buscar conexões Google existentes
    console.log('🔍 Buscando conexões Google existentes...');
    const { data: connections, error } = await supabase
      .from('google_ads_connections')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.log('❌ Erro ao buscar conexões:', error.message);
      return;
    }

    console.log(`📊 Encontradas ${connections.length} conexões`);

    if (connections.length === 0) {
      console.log('ℹ️ Nenhuma conexão encontrada. Faça o OAuth primeiro.');
      return;
    }

    // Testar primeira conexão com tokens válidos
    const validConnection = connections.find(conn => 
      conn.access_token && 
      conn.refresh_token && 
      conn.access_token !== 'pending'
    );

    if (!validConnection) {
      console.log('❌ Nenhuma conexão com tokens válidos encontrada');
      return;
    }

    console.log(`\n🧪 Testando conexão: ${validConnection.id}`);
    console.log('- Client ID:', validConnection.client_id);
    console.log('- Customer ID:', validConnection.customer_id || 'pending');
    console.log('- Tem Access Token:', validConnection.access_token ? '✅' : '❌');
    console.log('- Tem Refresh Token:', validConnection.refresh_token ? '✅' : '❌');

    // Testar API de contas
    console.log('\n🌐 Testando API de contas...');
    
    const response = await fetch(`http://localhost:3000/api/google/accounts?connectionId=${validConnection.id}&clientId=${validConnection.client_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    
    console.log('📡 Resposta da API:');
    console.log('- Status:', response.status);
    console.log('- Accounts:', result.accounts?.length || 0);
    console.log('- Error:', result.error || 'Nenhum');
    console.log('- Message:', result.message || 'Nenhuma');

    if (result.accounts && result.accounts.length > 0) {
      console.log('\n✅ SUCESSO! Contas encontradas:');
      result.accounts.forEach((account, index) => {
        console.log(`  ${index + 1}. ${account.descriptiveName} (${account.customerId})`);
      });
    } else if (result.error) {
      console.log('\n❌ ERRO:', result.error);
      if (result.message) {
        console.log('💡 Detalhes:', result.message);
      }
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

// Executar teste
testarContasReais();