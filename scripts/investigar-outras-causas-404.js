require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function investigarOutrasCausas() {
  console.log('🔍 INVESTIGANDO OUTRAS CAUSAS DO 404\n');

  console.log('📋 CORREÇÃO IMPORTANTE:');
  console.log('✅ Google confirma: BASIC ACCESS funciona com MCC');
  console.log('❌ Minha informação anterior estava incorreta');
  console.log('🔍 Vamos investigar outras causas possíveis\n');

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

    console.log('🧪 TESTE 1: Verificar se a API Google Ads está ativada no projeto');
    console.log('💡 Projeto identificado:', '839778729862-rctp31o4ai6hcsmuj9lpqcg05fuolv43.apps.googleusercontent.com');
    
    // Testar um endpoint diferente para verificar se a API está ativada
    const testResponse = await fetch('https://googleads.googleapis.com/v16/customers/1234567890/googleAds:search', {
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

    console.log(`📡 Status do endpoint search: ${testResponse.status}`);
    
    if (testResponse.status === 403) {
      const error403 = await testResponse.text();
      console.log('⚠️ Erro 403 - API pode não estar ativada no projeto:');
      console.log(error403.substring(0, 500));
      
      if (error403.includes('Google Ads API has not been used')) {
        console.log('\n💡 CAUSA ENCONTRADA: API Google Ads não está ativada!');
        console.log('🚀 SOLUÇÃO:');
        console.log('1. Acesse https://console.cloud.google.com');
        console.log('2. Selecione o projeto correto');
        console.log('3. Vá em APIs e Serviços → Biblioteca');
        console.log('4. Procure "Google Ads API"');
        console.log('5. Clique em "ATIVAR"');
        return;
      }
    } else if (testResponse.status === 400) {
      console.log('✅ API está ativada (erro 400 é esperado com customer ID inválido)');
    } else if (testResponse.status === 404) {
      console.log('❌ Ainda retorna 404 - problema persiste');
    }

    console.log('\n🧪 TESTE 2: Verificar se o Developer Token está vinculado ao projeto correto');
    console.log('💡 Possível causa: Token criado em projeto diferente');
    
    // Verificar informações do token OAuth
    const tokenInfoResponse = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + newAccessToken);
    
    if (tokenInfoResponse.ok) {
      const tokenInfo = await tokenInfoResponse.json();
      console.log('📊 Informações do OAuth:');
      console.log('   Client ID:', tokenInfo.issued_to);
      console.log('   Audience:', tokenInfo.audience);
      
      // Extrair o número do projeto do Client ID
      const projectNumber = tokenInfo.issued_to.split('-')[0];
      console.log('   Número do projeto:', projectNumber);
      
      console.log('\n💡 VERIFICAÇÃO NECESSÁRIA:');
      console.log('1. O Developer Token foi criado no mesmo projeto?');
      console.log('2. Projeto do OAuth:', projectNumber);
      console.log('3. Verifique se o Developer Token está no mesmo projeto');
    }

    console.log('\n🧪 TESTE 3: Testar com diferentes headers');
    console.log('💡 Alguns casos precisam de headers específicos');
    
    // Testar com diferentes combinações de headers
    const headerTests = [
      {
        name: 'Headers básicos',
        headers: {
          'Authorization': `Bearer ${newAccessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        }
      },
      {
        name: 'Com User-Agent',
        headers: {
          'Authorization': `Bearer ${newAccessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
          'User-Agent': 'GoogleAdsAPI-NodeJS'
        }
      },
      {
        name: 'Com Accept header',
        headers: {
          'Authorization': `Bearer ${newAccessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    ];

    for (const test of headerTests) {
      console.log(`\n🔍 Testando: ${test.name}`);
      
      const response = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
        method: 'GET',
        headers: test.headers,
      });

      console.log(`📡 Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`🎉 FUNCIONOU com ${test.name}!`);
        console.log('📊 Resposta:', JSON.stringify(data, null, 2));
        break;
      } else if (response.status !== 404) {
        const errorText = await response.text();
        console.log(`⚠️ Erro diferente (${response.status}):`, errorText.substring(0, 200));
      }
    }

    console.log('\n🧪 TESTE 4: Verificar se o problema é de propagação');
    console.log('💡 Às vezes leva tempo para o token ser reconhecido');
    
    console.log('📅 Quando você recebeu o email de aprovação?');
    console.log('⏰ Se foi recente (menos de 24h), pode ser propagação');
    console.log('🔄 Tente novamente em algumas horas');

    console.log('\n🧪 TESTE 5: Verificar configuração específica do Google Cloud');
    console.log('📚 CHECKLIST DETALHADO:');
    console.log('');
    console.log('1. 🏗️ PROJETO GOOGLE CLOUD:');
    console.log('   - Acesse https://console.cloud.google.com');
    console.log('   - Verifique se está no projeto correto');
    console.log('   - Número do projeto deve ser: 839778729862');
    console.log('');
    console.log('2. 🔌 GOOGLE ADS API:');
    console.log('   - Vá em APIs e Serviços → Biblioteca');
    console.log('   - Procure "Google Ads API"');
    console.log('   - Deve estar ATIVADA');
    console.log('   - Se não estiver, clique em ATIVAR');
    console.log('');
    console.log('3. 🔑 CREDENCIAIS OAUTH:');
    console.log('   - Vá em APIs e Serviços → Credenciais');
    console.log('   - Encontre o Client ID: 839778729862-rctp31o4ai6hcsmuj9lpqcg05fuolv43.apps.googleusercontent.com');
    console.log('   - Verifique URIs de redirecionamento');
    console.log('');
    console.log('4. 🎫 DEVELOPER TOKEN:');
    console.log('   - Acesse https://ads.google.com');
    console.log('   - Vá em Ferramentas → Centro de API');
    console.log('   - Verifique se o token está no MESMO projeto');
    console.log('   - Token:', developerToken);

    console.log('\n📋 POSSÍVEIS CAUSAS REAIS:');
    console.log('');
    console.log('🔴 MAIS PROVÁVEIS:');
    console.log('1. API Google Ads não ativada no projeto Google Cloud');
    console.log('2. Developer Token criado em projeto diferente');
    console.log('3. Propagação ainda não completada (se aprovação foi recente)');
    console.log('');
    console.log('🟡 POSSÍVEIS:');
    console.log('4. Problema de configuração no Centro de API');
    console.log('5. Token aprovado mas com restrições específicas');
    console.log('6. Problema temporário da API do Google');
    console.log('');
    console.log('🟢 MENOS PROVÁVEIS:');
    console.log('7. Problema no código (já testamos extensivamente)');
    console.log('8. Problema com MCC (Google confirma que BASIC funciona)');

    console.log('\n🚀 PRÓXIMOS PASSOS RECOMENDADOS:');
    console.log('');
    console.log('1. 🔧 VERIFICAR PROJETO GOOGLE CLOUD:');
    console.log('   - Confirmar que API Google Ads está ativada');
    console.log('   - Verificar se é o projeto correto (839778729862)');
    console.log('');
    console.log('2. 🎫 VERIFICAR DEVELOPER TOKEN:');
    console.log('   - Confirmar que foi criado no mesmo projeto');
    console.log('   - Verificar status no Centro de API');
    console.log('');
    console.log('3. ⏰ AGUARDAR PROPAGAÇÃO:');
    console.log('   - Se aprovação foi recente, aguardar 24-48h');
    console.log('   - Testar novamente periodicamente');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

investigarOutrasCausas();