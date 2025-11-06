require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function investigar404() {
  console.log('🔍 INVESTIGANDO 404 COM TOKEN APROVADO\n');

  try {
    // Buscar conexão ativa
    const { data: connections } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('status', 'active')
      .limit(1);

    const connection = connections[0];
    const newAccessToken = connection.access_token;
    const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;

    console.log('📋 INFORMAÇÕES:');
    console.log('✅ Developer Token aprovado por email');
    console.log('✅ OAuth funcionando');
    console.log('✅ Escopo correto');
    console.log('❌ API retorna 404');

    console.log('\n🧪 TESTE 1: Verificar diferentes versões da API');
    
    const versions = ['v16', 'v15', 'v14'];
    
    for (const version of versions) {
      console.log(`\n🔍 Testando versão ${version}...`);
      
      const response = await fetch(`https://googleads.googleapis.com/${version}/customers:listAccessibleCustomers`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${newAccessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        },
      });

      console.log(`📡 ${version}: Status ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${version} FUNCIONOU!`, data);
        break;
      } else if (response.status !== 404) {
        const errorText = await response.text();
        console.log(`⚠️ ${version}: Erro diferente de 404:`, errorText.substring(0, 100));
      }
    }

    console.log('\n🧪 TESTE 2: Verificar se você tem contas Google Ads');
    console.log('📚 INSTRUÇÕES IMPORTANTES:');
    console.log('1. Abra uma nova aba e acesse: https://ads.google.com');
    console.log('2. Faça login com a MESMA conta do OAuth');
    console.log('3. Verifique se você vê:');
    console.log('   - Campanhas ativas');
    console.log('   - Contas de anúncios');
    console.log('   - Dashboard com dados');
    console.log('4. Se não vê nada, você precisa:');
    console.log('   - Criar uma conta Google Ads');
    console.log('   - Configurar pelo menos uma campanha');
    console.log('   - Adicionar método de pagamento');

    console.log('\n🧪 TESTE 3: Verificar configuração do projeto Google Cloud');
    console.log('📚 VERIFICAÇÕES NECESSÁRIAS:');
    console.log('1. Acesse: https://console.cloud.google.com');
    console.log('2. Selecione seu projeto');
    console.log('3. Vá em "APIs e Serviços" → "Biblioteca"');
    console.log('4. Procure por "Google Ads API"');
    console.log('5. Verifique se está ATIVADA');
    console.log('6. Se não estiver, clique em "ATIVAR"');

    console.log('\n🧪 TESTE 4: Verificar credenciais OAuth');
    console.log('📚 VERIFICAÇÕES:');
    console.log('1. No Google Cloud Console');
    console.log('2. Vá em "APIs e Serviços" → "Credenciais"');
    console.log('3. Encontre seu OAuth 2.0 Client ID');
    console.log('4. Verifique se os escopos incluem:');
    console.log('   - https://www.googleapis.com/auth/adwords');
    console.log('5. Verifique URIs de redirecionamento');

    console.log('\n🧪 TESTE 5: Testar com Customer ID específico');
    console.log('💡 Se você souber um Customer ID específico, podemos testar diretamente');
    
    // Tentar alguns Customer IDs comuns de teste
    const testCustomerIds = ['1234567890', '9876543210', '1111111111'];
    
    for (const customerId of testCustomerIds) {
      console.log(`\n🔍 Testando Customer ID: ${customerId}`);
      
      const customerResponse = await fetch(`https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${newAccessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'SELECT customer.id FROM customer LIMIT 1'
        }),
      });

      console.log(`📡 Status para ${customerId}: ${customerResponse.status}`);
      
      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        console.log(`✅ Sucesso para ${customerId}:`, customerData);
        console.log('🎉 Isso significa que a API funciona com Customer IDs específicos!');
        break;
      } else if (customerResponse.status !== 404 && customerResponse.status !== 400) {
        const customerError = await customerResponse.text();
        console.log(`⚠️ Erro diferente para ${customerId}:`, customerError.substring(0, 100));
      }
    }

    console.log('\n📋 DIAGNÓSTICO FINAL:');
    console.log('');
    console.log('🔍 CENÁRIO MAIS PROVÁVEL:');
    console.log('   Seu Developer Token foi aprovado, mas você não tem');
    console.log('   contas Google Ads ativas acessíveis via API.');
    console.log('');
    console.log('💡 ISSO ACONTECE QUANDO:');
    console.log('   1. Você tem o token aprovado');
    console.log('   2. Mas nunca criou uma conta Google Ads');
    console.log('   3. Ou a conta existe mas não tem campanhas');
    console.log('   4. Ou a conta não está vinculada ao mesmo email');
    console.log('');
    console.log('🚀 SOLUÇÃO:');
    console.log('   1. Acesse https://ads.google.com');
    console.log('   2. Crie uma conta Google Ads');
    console.log('   3. Configure pelo menos uma campanha (pode ser pausada)');
    console.log('   4. Adicione método de pagamento');
    console.log('   5. Aguarde algumas horas para propagação');
    console.log('   6. Teste novamente');
    console.log('');
    console.log('📞 ALTERNATIVA:');
    console.log('   Se você já tem conta Google Ads mas não aparece,');
    console.log('   verifique se está usando o mesmo email do OAuth');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

investigar404();