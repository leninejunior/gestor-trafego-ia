/**
 * Teste completo do fluxo OAuth Google
 * Simula o processo completo de autenticação
 */

// Carregar variáveis de ambiente
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testCompleteOAuthFlow() {
  console.log('🔄 Testando fluxo completo OAuth Google...\n');

  try {
    // 1. Limpar dados antigos
    console.log('1. Limpando dados antigos...');
    
    // Deletar conexões antigas
    const { error: deleteError } = await supabase
      .from('google_ads_connections')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      console.log('⚠️ Erro ao limpar conexões antigas:', deleteError.message);
    } else {
      console.log('✅ Conexões antigas removidas');
    }

    // 2. Criar um cliente de teste
    console.log('\n2. Criando cliente de teste...');
    
    // Primeiro, criar uma organização de teste
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: 'Organização Teste OAuth',
        slug: 'org-teste-oauth-' + Date.now()
      })
      .select()
      .single();

    if (orgError) {
      console.error('❌ Erro ao criar organização:', orgError);
      return;
    }

    console.log('✅ Organização criada:', org.id);

    // Agora criar o cliente
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert({
        name: 'Cliente Teste OAuth',
        org_id: org.id
      })
      .select()
      .single();

    if (clientError) {
      console.error('❌ Erro ao criar cliente:', clientError);
      return;
    }

    console.log('✅ Cliente criado:', client.id);

    // 3. Simular início do OAuth
    console.log('\n3. Simulando início do OAuth...');
    
    const state = 'test-state-' + Date.now();
    const { error: stateError } = await supabase
      .from('oauth_states')
      .insert({
        state: state,
        provider: 'google',
        client_id: client.id,
        user_id: '00000000-0000-0000-0000-000000000000',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutos
      });

    if (stateError) {
      console.error('❌ Erro ao criar estado OAuth:', stateError);
      return;
    }

    console.log('✅ Estado OAuth criado:', state);

    // 4. Simular callback com tokens
    console.log('\n4. Simulando callback OAuth...');
    
    const mockTokens = {
      access_token: 'mock_access_token_' + Date.now(),
      refresh_token: 'mock_refresh_token_' + Date.now(),
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/adwords'
    };

    // Criar conexão manualmente (simulando o callback)
    const { data: connection, error: connectionError } = await supabase
      .from('google_ads_connections')
      .insert({
        client_id: client.id,
        user_id: '00000000-0000-0000-0000-000000000000', // User ID fictício
        customer_id: 'pending',
        access_token: mockTokens.access_token, // Não criptografado para teste
        refresh_token: mockTokens.refresh_token,
        token_expires_at: new Date(Date.now() + mockTokens.expires_in * 1000).toISOString(),
        status: 'active'
      })
      .select()
      .single();

    if (connectionError) {
      console.error('❌ Erro ao criar conexão:', connectionError);
      return;
    }

    console.log('✅ Conexão criada:', connection.id);

    // 5. Testar API de accounts
    console.log('\n5. Testando API de accounts...');
    
    try {
      const response = await fetch(`http://localhost:3000/api/google/accounts?connectionId=${connection.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`Status da resposta: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API funcionou! Resposta:', JSON.stringify(data, null, 2));
      } else {
        const errorText = await response.text();
        console.log('❌ Erro na API:', errorText);
      }
    } catch (apiError) {
      console.error('❌ Erro ao chamar API:', apiError.message);
    }

    // 6. Verificar dados salvos
    console.log('\n6. Verificando dados salvos...');
    
    const { data: savedConnection, error: fetchError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('id', connection.id)
      .single();

    if (fetchError) {
      console.error('❌ Erro ao buscar conexão:', fetchError);
    } else {
      console.log('✅ Conexão salva:');
      console.log(`   ID: ${savedConnection.id}`);
      console.log(`   Client ID: ${savedConnection.client_id}`);
      console.log(`   Customer ID: ${savedConnection.customer_id}`);
      console.log(`   Status: ${savedConnection.status}`);
      console.log(`   Has Access Token: ${!!savedConnection.access_token}`);
      console.log(`   Has Refresh Token: ${!!savedConnection.refresh_token}`);
      console.log(`   Token Expires: ${savedConnection.token_expires_at}`);
    }

    // 7. Limpar dados de teste
    console.log('\n7. Limpando dados de teste...');
    
    await supabase.from('google_ads_connections').delete().eq('id', connection.id);
    await supabase.from('oauth_states').delete().eq('state', state);
    await supabase.from('clients').delete().eq('id', client.id);
    await supabase.from('organizations').delete().eq('id', org.id);
    
    console.log('✅ Dados de teste removidos');

  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
  }
}

// Executar teste
testCompleteOAuthFlow().catch(console.error);