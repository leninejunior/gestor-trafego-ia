/**
 * Criar conexão Google de teste
 * Para testar a API de accounts
 */

// Carregar variáveis de ambiente
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestConnection() {
  console.log('🔧 Criando conexão Google de teste...\n');

  try {
    // 1. Criar organização de teste
    console.log('1. Criando organização de teste...');
    
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: 'Organização Teste Google',
        slug: 'org-teste-google-' + Date.now()
      })
      .select()
      .single();

    if (orgError) {
      console.error('❌ Erro ao criar organização:', orgError);
      return;
    }

    console.log('✅ Organização criada:', org.id);

    // 2. Criar cliente de teste
    console.log('\n2. Criando cliente de teste...');
    
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert({
        name: 'Cliente Teste Google',
        org_id: org.id
      })
      .select()
      .single();

    if (clientError) {
      console.error('❌ Erro ao criar cliente:', clientError);
      return;
    }

    console.log('✅ Cliente criado:', client.id);

    // 3. Criar conexão Google
    console.log('\n3. Criando conexão Google...');
    
    const { data: connection, error: connectionError } = await supabase
      .from('google_ads_connections')
      .insert({
        client_id: client.id,
        user_id: '00000000-0000-0000-0000-000000000000', // User ID fictício
        customer_id: 'pending', // Ainda não selecionou conta
        refresh_token: 'test_refresh_token_' + Date.now(),
        status: 'active'
      })
      .select()
      .single();

    if (connectionError) {
      console.error('❌ Erro ao criar conexão:', connectionError);
      return;
    }

    console.log('✅ Conexão criada:', connection.id);

    // 4. Testar API de accounts
    console.log('\n4. Testando API de accounts...');
    
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
        console.log('✅ API funcionou! Resposta:');
        console.log(JSON.stringify(data, null, 2));
      } else {
        const errorText = await response.text();
        console.log('❌ Erro na API:', errorText);
      }
    } catch (apiError) {
      console.error('❌ Erro ao chamar API:', apiError.message);
    }

    // 5. Informações para teste manual
    console.log('\n5. Informações para teste manual:');
    console.log(`   Connection ID: ${connection.id}`);
    console.log(`   Client ID: ${client.id}`);
    console.log(`   Organization ID: ${org.id}`);
    console.log(`   URL de teste: http://localhost:3000/api/google/accounts?connectionId=${connection.id}`);
    
    console.log('\n📝 Para testar no navegador:');
    console.log(`   1. Acesse: http://localhost:3000/google/select-accounts?connectionId=${connection.id}&clientId=${client.id}`);
    console.log(`   2. Ou teste a API diretamente com o Connection ID acima`);

    // Não limpar os dados para permitir teste manual
    console.log('\n⚠️ Dados de teste mantidos para teste manual');
    console.log('   Execute o script cleanup se quiser remover depois');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Executar criação
createTestConnection().catch(console.error);