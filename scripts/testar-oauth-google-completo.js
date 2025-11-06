/**
 * Testar fluxo OAuth completo do Google Ads
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testarOAuthCompleto() {
  console.log('🔍 Testando fluxo OAuth completo do Google Ads...\n');

  try {
    // 1. Limpar conexões existentes
    console.log('🧹 Limpando conexões existentes...');
    await supabase.from('google_ads_connections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('google_ads_encryption_keys').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('oauth_states').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('✅ Conexões limpas');

    // 2. Simular início do OAuth
    console.log('\n🚀 Simulando início do OAuth...');
    const clientId = 'e0ae65bf-1f97-474a-988e-a5418ab28e77'; // ID do cliente de teste
    const userId = '123e4567-e89b-12d3-a456-426614174000'; // ID do usuário de teste
    const state = 'test-state-' + Date.now();

    // Criar estado OAuth
    const { data: oauthState, error: stateError } = await supabase
      .from('oauth_states')
      .insert({
        state,
        client_id: clientId,
        user_id: userId,
        provider: 'google',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutos
      })
      .select()
      .single();

    if (stateError) {
      console.error('❌ Erro ao criar estado OAuth:', stateError);
      return;
    }

    console.log('✅ Estado OAuth criado:', state);

    // 3. Simular callback OAuth
    console.log('\n📞 Simulando callback OAuth...');
    
    const callbackUrl = `http://localhost:3000/api/google/callback?code=test-auth-code&state=${state}`;
    console.log('URL do callback:', callbackUrl);

    // Fazer requisição para o callback
    const response = await fetch(callbackUrl);
    console.log('Status do callback:', response.status);
    
    if (response.status === 302) {
      const location = response.headers.get('location');
      console.log('✅ Redirecionamento para:', location);
      
      if (location && location.includes('select-accounts')) {
        console.log('✅ Fluxo OAuth funcionando - redirecionou para seleção de contas');
      } else if (location && location.includes('error')) {
        console.log('❌ Erro no OAuth - redirecionou com erro');
      }
    } else {
      const text = await response.text();
      console.log('Resposta do callback:', text);
    }

    // 4. Verificar se a conexão foi criada
    console.log('\n🔍 Verificando conexão criada...');
    const { data: connections, error: connError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('client_id', clientId);

    if (connError) {
      console.error('❌ Erro ao buscar conexões:', connError);
    } else {
      console.log(`📊 Conexões encontradas: ${connections.length}`);
      
      if (connections.length > 0) {
        const conn = connections[0];
        console.log('🔗 Conexão criada:');
        console.log(`   ID: ${conn.id}`);
        console.log(`   Status: ${conn.status}`);
        console.log(`   Customer ID: ${conn.customer_id}`);
        console.log(`   Tem access_token: ${!!conn.access_token}`);
        console.log(`   Tem refresh_token: ${!!conn.refresh_token}`);
        console.log(`   Expira em: ${conn.expires_at}`);

        // Testar API de contas
        console.log('\n🏢 Testando API de contas...');
        const accountsUrl = `http://localhost:3000/api/google/accounts?connectionId=${conn.id}`;
        
        try {
          const accountsResponse = await fetch(accountsUrl);
          const accountsData = await accountsResponse.json();
          
          console.log('Status da API de contas:', accountsResponse.status);
          console.log('Dados das contas:', JSON.stringify(accountsData, null, 2));
          
          if (accountsData.accounts && accountsData.accounts.length > 0) {
            console.log('✅ API de contas funcionando - dados reais obtidos');
          } else if (accountsData.error) {
            console.log('❌ Erro na API de contas:', accountsData.error);
          }
        } catch (apiError) {
          console.error('❌ Erro ao testar API de contas:', apiError.message);
        }
      }
    }

  } catch (error) {
    console.error('💥 Erro no teste:', error);
  }
}

testarOAuthCompleto().catch(console.error);