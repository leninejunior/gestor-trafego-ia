/**
 * Criar conexão Google de teste com tokens válidos
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function criarConexaoTeste() {
  console.log('🔧 Criando conexão Google de teste...\n');

  try {
    const clientId = 'e0ae65bf-1f97-474a-988e-a5418ab28e77';
    const userId = '123e4567-e89b-12d3-a456-426614174000'; // ID de usuário de teste
    
    // Criar conexão com tokens de teste
    const { data: connection, error: connectionError } = await supabase
      .from('google_ads_connections')
      .insert({
        client_id: clientId,
        user_id: userId,
        customer_id: 'pending',
        access_token: 'test-access-token-' + Date.now(),
        refresh_token: 'test-refresh-token-' + Date.now(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hora
        status: 'active'
      })
      .select()
      .single();

    if (connectionError) {
      console.error('❌ Erro ao criar conexão:', connectionError);
      return;
    }

    console.log('✅ Conexão criada com sucesso:');
    console.log(`   ID: ${connection.id}`);
    console.log(`   Client ID: ${connection.client_id}`);
    console.log(`   Status: ${connection.status}`);
    console.log(`   Tem tokens: ${!!connection.access_token && !!connection.refresh_token}`);

    // Testar a API de contas com esta conexão
    console.log('\n🧪 Testando API de contas...');
    const accountsUrl = `http://localhost:3000/api/google/accounts?connectionId=${connection.id}`;
    
    try {
      const response = await fetch(accountsUrl);
      const data = await response.json();
      
      console.log('Status:', response.status);
      console.log('Resposta:', JSON.stringify(data, null, 2));
      
      if (data.error && data.error.includes('Token inválido')) {
        console.log('\n💡 Isso é esperado - os tokens de teste não são válidos para a API real do Google');
        console.log('   Para testar com dados reais, você precisa fazer OAuth real');
      }
    } catch (apiError) {
      console.error('❌ Erro na API:', apiError.message);
    }

    // Mostrar URL para seleção de contas
    console.log('\n🌐 URL para testar seleção de contas:');
    console.log(`http://localhost:3000/google/select-accounts?connectionId=${connection.id}&clientId=${clientId}`);

  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

criarConexaoTeste().catch(console.error);