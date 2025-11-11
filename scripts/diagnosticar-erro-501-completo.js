require('dotenv').config();

async function diagnosticarErro501() {
  console.log('🔍 DIAGNÓSTICO COMPLETO DO ERRO 501\n');
  
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  // Buscar conexão
  const { data: connection } = await supabase
    .from('google_ads_connections')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (!connection) {
    console.log('❌ Nenhuma conexão encontrada');
    return;
  }
  
  console.log('📋 INFORMAÇÕES DA CONFIGURAÇÃO:');
  console.log(`   Developer Token: ${process.env.GOOGLE_DEVELOPER_TOKEN}`);
  console.log(`   Client ID: ${process.env.GOOGLE_CLIENT_ID?.substring(0, 30)}...`);
  console.log(`   Access Token: ${connection.access_token?.substring(0, 30)}...`);
  console.log('');
  
  // Teste 1: Verificar se o token OAuth está válido
  console.log('🧪 TESTE 1: Verificando token OAuth...');
  try {
    const oauthTest = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + connection.access_token);
    const oauthData = await oauthTest.json();
    
    if (oauthTest.ok) {
      console.log('✅ Token OAuth válido');
      console.log(`   Scopes: ${oauthData.scope}`);
      console.log(`   Expira em: ${oauthData.expires_in}s`);
      
      // Verificar se tem o scope correto
      if (oauthData.scope?.includes('adwords')) {
        console.log('✅ Scope "adwords" presente');
      } else {
        console.log('❌ Scope "adwords" AUSENTE!');
        console.log('💡 Você precisa refazer o OAuth com o scope correto');
      }
    } else {
      console.log('❌ Token OAuth inválido:', oauthData);
    }
  } catch (error) {
    console.log('❌ Erro ao verificar token:', error.message);
  }
  console.log('');
  
  // Teste 2: Testar diferentes endpoints da API
  console.log('🧪 TESTE 2: Testando endpoints da Google Ads API...');
  
  const endpoints = [
    {
      name: 'listAccessibleCustomers',
      url: 'https://googleads.googleapis.com/v18/customers:listAccessibleCustomers',
      method: 'GET'
    },
    {
      name: 'searchStream (v17)',
      url: 'https://googleads.googleapis.com/v17/customers:listAccessibleCustomers',
      method: 'GET'
    },
    {
      name: 'searchStream (v16)',
      url: 'https://googleads.googleapis.com/v16/customers:listAccessibleCustomers',
      method: 'GET'
    }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
          'developer-token': process.env.GOOGLE_DEVELOPER_TOKEN,
          'Content-Type': 'application/json',
        },
      });
      
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
      
      console.log(`\n   ${endpoint.name}:`);
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.status === 501) {
        console.log('   ❌ 501 Not Implemented');
        if (data.error) {
          console.log(`   Mensagem: ${data.error.message}`);
        }
      } else if (response.status === 200) {
        console.log('   ✅ Sucesso!');
        console.log(`   Dados:`, JSON.stringify(data, null, 2).substring(0, 200));
      } else {
        console.log(`   ⚠️ Outro erro: ${JSON.stringify(data).substring(0, 200)}`);
      }
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }
  }
  
  console.log('\n');
  console.log('📊 POSSÍVEIS CAUSAS DO ERRO 501:');
  console.log('');
  console.log('1. ❌ Developer Token não aprovado');
  console.log('   - Status: Test/Pending');
  console.log('   - Solução: Solicitar aprovação no Google Ads');
  console.log('   - Link: https://ads.google.com/aw/apicenter');
  console.log('');
  console.log('2. ❌ Developer Token de conta errada');
  console.log('   - O token deve ser da conta MCC (gerenciadora)');
  console.log('   - Não pode ser de uma conta cliente individual');
  console.log('');
  console.log('3. ❌ API não habilitada no projeto correto');
  console.log('   - Verifique se está no projeto:', process.env.GOOGLE_CLIENT_ID?.split('-')[0]);
  console.log('   - Link: https://console.cloud.google.com/apis/library/googleads.googleapis.com');
  console.log('');
  console.log('4. ❌ Falta de permissões na conta Google Ads');
  console.log('   - Você precisa ter acesso de Admin na conta MCC');
  console.log('   - Verifique em: https://ads.google.com/');
  console.log('');
  console.log('5. ❌ Versão da API incorreta');
  console.log('   - Tente usar v17 ou v16 ao invés de v18');
  console.log('');
  
  console.log('🔧 PRÓXIMOS PASSOS:');
  console.log('');
  console.log('1. Verifique o status do Developer Token:');
  console.log('   https://ads.google.com/aw/apicenter');
  console.log('');
  console.log('2. Confirme que o token é da conta MCC (gerenciadora)');
  console.log('');
  console.log('3. Se o token estiver "Pending", solicite aprovação');
  console.log('   (pode levar alguns dias)');
  console.log('');
  console.log('4. Enquanto isso, use dados mockados para desenvolvimento');
}

diagnosticarErro501().catch(console.error);
