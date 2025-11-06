require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testarTokenAprovado() {
  console.log('🎉 TESTANDO COM DEVELOPER TOKEN APROVADO\n');

  const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;
  console.log('📋 Developer Token:', developerToken);
  console.log('✅ Status: APROVADO (confirmado por email)\n');

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
    console.log('✅ Conexão encontrada:', connection.id);

    // Fazer refresh do token primeiro
    console.log('🔄 Fazendo refresh do token...');
    
    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!refreshResponse.ok) {
      const refreshError = await refreshResponse.text();
      console.error('❌ Erro ao fazer refresh:', refreshError);
      return;
    }

    const refreshData = await refreshResponse.json();
    console.log('✅ Token refreshed com sucesso');

    // Atualizar token no banco
    const { error: updateError } = await supabase
      .from('google_ads_connections')
      .update({
        access_token: refreshData.access_token
      })
      .eq('id', connection.id);

    if (updateError) {
      console.error('❌ Erro ao atualizar token:', updateError);
      return;
    }

    console.log('💾 Token atualizado no banco');
    
    const newAccessToken = refreshData.access_token;

    // Verificar token OAuth
    console.log('\n1️⃣ Verificando token OAuth...');
    const tokenResponse = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + newAccessToken);
    
    if (tokenResponse.ok) {
      const tokenInfo = await tokenResponse.json();
      console.log('✅ Token OAuth válido');
      console.log(`   Expira em: ${tokenInfo.expires_in} segundos`);
      console.log(`   Escopo: ${tokenInfo.scope}`);
      
      if (!tokenInfo.scope || !tokenInfo.scope.includes('adwords')) {
        console.log('❌ Escopo Google Ads ausente - problema no OAuth');
        return;
      }
    } else {
      console.log('❌ Token OAuth inválido');
      return;
    }

    // Testar API com diferentes versões
    console.log('\n2️⃣ Testando Google Ads API v16...');
    
    const headers = {
      'Authorization': `Bearer ${newAccessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    };

    console.log('📋 Headers da requisição:');
    console.log('   Authorization: Bearer ' + newAccessToken.substring(0, 20) + '...');
    console.log('   developer-token:', developerToken);

    const listResponse = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
      method: 'GET',
      headers: headers,
    });

    console.log(`📡 Status: ${listResponse.status}`);
    console.log(`📡 Headers de resposta:`, Object.fromEntries(listResponse.headers.entries()));
    
    if (listResponse.ok) {
      const data = await listResponse.json();
      console.log('🎉 API FUNCIONANDO!');
      console.log('📊 Resposta completa:', JSON.stringify(data, null, 2));
      
      if (data.resourceNames && data.resourceNames.length > 0) {
        console.log(`\n✅ ${data.resourceNames.length} conta(s) encontrada(s):`);
        data.resourceNames.forEach((resourceName, index) => {
          const customerId = resourceName.replace('customers/', '');
          console.log(`   ${index + 1}. Customer ID: ${customerId}`);
        });
        
        console.log('\n🎉 SUCESSO TOTAL!');
        console.log('   O sistema está funcionando perfeitamente!');
        console.log('   Agora você pode selecionar contas na interface');
        
        // Testar buscar detalhes de uma conta
        if (data.resourceNames.length > 0) {
          const firstCustomerId = data.resourceNames[0].replace('customers/', '');
          console.log(`\n3️⃣ Testando detalhes da conta ${firstCustomerId}...`);
          
          const customerResponse = await fetch(`https://googleads.googleapis.com/v16/customers/${firstCustomerId}/googleAds:search`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
              query: `
                SELECT
                  customer.id,
                  customer.descriptive_name,
                  customer.currency_code,
                  customer.time_zone,
                  customer.manager
                FROM customer
                WHERE customer.id = ${firstCustomerId}
              `
            }),
          });

          if (customerResponse.ok) {
            const customerData = await customerResponse.json();
            console.log('✅ Detalhes da conta obtidos com sucesso:');
            console.log(JSON.stringify(customerData, null, 2));
          } else {
            const customerError = await customerResponse.text();
            console.log('⚠️ Erro ao buscar detalhes da conta:', customerError.substring(0, 200));
          }
        }
        
      } else {
        console.log('\n⚠️ API funcionou mas nenhuma conta encontrada');
        console.log('💡 Possíveis causas:');
        console.log('   1. Você não tem contas Google Ads ativas');
        console.log('   2. Contas existem mas não estão acessíveis via API');
        console.log('   3. Precisa criar uma conta Google Ads primeiro');
        
        console.log('\n📚 VERIFICAÇÕES:');
        console.log('   1. Acesse https://ads.google.com');
        console.log('   2. Verifique se você vê campanhas ou contas');
        console.log('   3. Se não vê nada, crie uma conta Google Ads');
        console.log('   4. Crie pelo menos uma campanha de teste');
      }
    } else {
      const errorText = await listResponse.text();
      console.log('❌ API ainda não funcionando');
      console.log('📄 Erro completo:', errorText);
      
      if (listResponse.status === 404) {
        console.log('\n🤔 ESTRANHO: Token aprovado mas API retorna 404');
        console.log('💡 Possíveis causas:');
        console.log('   1. Token aprovado mas para conta diferente');
        console.log('   2. Problema de propagação (aguarde algumas horas)');
        console.log('   3. Token aprovado mas sem contas Google Ads');
        console.log('   4. Problema na configuração do projeto Google Cloud');
      } else if (listResponse.status === 401) {
        console.log('\n💡 Problema de autenticação');
        console.log('   Verifique se o token OAuth tem o escopo correto');
      } else if (listResponse.status === 403) {
        console.log('\n💡 Problema de permissões');
        console.log('   Token pode estar aprovado mas sem permissões suficientes');
      }
    }

    console.log('\n📋 RESUMO FINAL:');
    console.log('🔄 Token refreshed: ✅');
    console.log('🔗 OAuth válido: ✅');
    console.log('🎯 Escopo correto: ✅');
    console.log('✅ Developer Token: APROVADO (confirmado)');
    console.log(`📡 API Status: ${listResponse.status}`);
    
    if (listResponse.ok) {
      console.log('\n🎉 SISTEMA FUNCIONANDO PERFEITAMENTE!');
      console.log('   Agora você pode usar a interface normalmente');
    } else {
      console.log('\n🔍 INVESTIGAÇÃO NECESSÁRIA:');
      console.log('   Token aprovado mas API ainda não funciona');
      console.log('   Pode ser problema de propagação ou configuração');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testarTokenAprovado();