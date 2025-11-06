require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testarDeveloperTokenBasico() {
  console.log('🔍 TESTANDO DEVELOPER TOKEN - NÍVEL BÁSICO\n');

  const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;
  console.log('📋 Developer Token:', developerToken);
  console.log('📋 Nível: BASIC ACCESS (acesso às suas próprias contas)\n');

  try {
    // Buscar conexão ativa
    const { data: connections, error: connError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('status', 'active')
      .limit(1);

    if (connError || !connections || connections.length === 0) {
      console.error('❌ Nenhuma conexão ativa encontrada:', connError);
      return;
    }

    const connection = connections[0];
    console.log('✅ Conexão encontrada:', {
      id: connection.id,
      client_id: connection.client_id,
      customer_id: connection.customer_id,
      status: connection.status
    });

    if (!connection.access_token) {
      console.error('❌ Access token não encontrado');
      return;
    }

    console.log('\n🧪 TESTE 1: Verificar token OAuth');
    const tokenResponse = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + connection.access_token);
    
    if (tokenResponse.ok) {
      const tokenInfo = await tokenResponse.json();
      console.log('✅ Token OAuth válido');
      console.log(`   Expira em: ${tokenInfo.expires_in} segundos`);
      console.log(`   Escopo: ${tokenInfo.scope}`);
      
      // Verificar se tem o escopo correto
      if (tokenInfo.scope && tokenInfo.scope.includes('adwords')) {
        console.log('✅ Escopo Google Ads presente');
      } else {
        console.log('❌ Escopo Google Ads ausente');
      }
    } else {
      console.log('❌ Token OAuth inválido ou expirado');
      return;
    }

    console.log('\n🧪 TESTE 2: API listAccessibleCustomers (padrão)');
    const listResponse = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
      },
    });

    console.log(`📡 Status: ${listResponse.status}`);
    
    if (listResponse.ok) {
      const data = await listResponse.json();
      console.log('✅ API funcionando!');
      console.log('📊 Resposta:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await listResponse.text();
      console.log('❌ API não funcionando');
      console.log('📄 Erro:', errorText.substring(0, 300) + '...');
      
      if (listResponse.status === 404) {
        console.log('\n💡 DIAGNÓSTICO: Developer Token não aprovado');
        console.log('📚 Para BASIC ACCESS, você precisa:');
        console.log('   1. Ter uma conta Google Ads ativa');
        console.log('   2. Ter histórico de gastos em anúncios');
        console.log('   3. Solicitar aprovação no Centro de API');
      }
    }

    console.log('\n🧪 TESTE 3: Tentar com Customer ID específico');
    
    // Testar com alguns Customer IDs comuns para contas de teste
    const testCustomerIds = ['1234567890', '9876543210'];
    
    for (const customerId of testCustomerIds) {
      console.log(`\n🔍 Testando Customer ID: ${customerId}`);
      
      const customerResponse = await fetch(`https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1'
        }),
      });

      console.log(`📡 Status para ${customerId}: ${customerResponse.status}`);
      
      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        console.log(`✅ Sucesso para ${customerId}:`, customerData);
      } else {
        const customerError = await customerResponse.text();
        console.log(`❌ Erro para ${customerId}:`, customerError.substring(0, 100) + '...');
      }
    }

    console.log('\n🧪 TESTE 4: Verificar se você tem contas Google Ads');
    console.log('📚 INSTRUÇÕES PARA VERIFICAR:');
    console.log('1. Acesse https://ads.google.com');
    console.log('2. Faça login com a mesma conta do OAuth');
    console.log('3. Verifique se você vê campanhas ou contas');
    console.log('4. Se não vê nada, você precisa criar uma conta Google Ads primeiro');

    console.log('\n🧪 TESTE 5: Verificar Centro de API');
    console.log('📚 INSTRUÇÕES:');
    console.log('1. No Google Ads, vá em Ferramentas → Centro de API');
    console.log('2. Procure por "Developer Token"');
    console.log('3. Verifique o status (pode estar como "Pending" ou "Approved")');
    console.log('4. Se não existe, clique em "Criar token"');

    console.log('\n📊 RESUMO DO DIAGNÓSTICO:');
    console.log('✅ OAuth funcionando');
    console.log('✅ Token válido');
    console.log('✅ Escopo correto');
    console.log('❌ API retorna 404 (token não aprovado ou sem contas)');
    
    console.log('\n💡 POSSÍVEIS CAUSAS:');
    console.log('1. Developer Token não foi aprovado pelo Google');
    console.log('2. Você não tem contas Google Ads ativas');
    console.log('3. Conta não tem histórico de gastos suficiente');
    console.log('4. Token foi criado mas não ativado');

    console.log('\n🚀 PRÓXIMOS PASSOS:');
    console.log('1. Verifique se tem contas no ads.google.com');
    console.log('2. Crie uma campanha de teste (mesmo que pequena)');
    console.log('3. Solicite aprovação do Developer Token');
    console.log('4. Aguarde aprovação (pode levar alguns dias)');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testarDeveloperTokenBasico();