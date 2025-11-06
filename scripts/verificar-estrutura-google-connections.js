require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verificarEstrutura() {
  console.log('🔍 VERIFICANDO ESTRUTURA DA TABELA google_ads_connections\n');

  try {
    // Buscar uma conexão para ver a estrutura
    const { data: connections, error: connError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .limit(1);

    if (connError) {
      console.error('❌ Erro ao buscar conexões:', connError);
      return;
    }

    if (!connections || connections.length === 0) {
      console.log('⚠️ Nenhuma conexão encontrada');
      return;
    }

    const connection = connections[0];
    console.log('📋 ESTRUTURA ATUAL DA TABELA:');
    console.log('Colunas encontradas:');
    
    Object.keys(connection).forEach((key, index) => {
      console.log(`   ${index + 1}. ${key}: ${typeof connection[key]} = ${connection[key]}`);
    });

    console.log('\n🔄 Tentando refresh do token sem salvar expires_at...');
    
    if (!connection.refresh_token) {
      console.error('❌ Refresh token não encontrado');
      return;
    }

    // Fazer refresh do token
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

    // Atualizar apenas o access_token
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
    
    // Testar API
    const newAccessToken = refreshData.access_token;
    const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;

    console.log('\n🧪 TESTANDO API...');
    
    // Verificar token OAuth
    const tokenResponse = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + newAccessToken);
    
    if (tokenResponse.ok) {
      const tokenInfo = await tokenResponse.json();
      console.log('✅ Token OAuth válido');
      console.log(`   Expira em: ${tokenInfo.expires_in} segundos`);
      console.log(`   Escopo: ${tokenInfo.scope}`);
    } else {
      console.log('❌ Token OAuth inválido');
      return;
    }

    // Testar API Google Ads
    console.log('\n🧪 Testando Google Ads API...');
    const listResponse = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${newAccessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
      },
    });

    console.log(`📡 Status: ${listResponse.status}`);
    
    if (listResponse.ok) {
      const data = await listResponse.json();
      console.log('🎉 API FUNCIONANDO!');
      console.log('📊 Resposta:', JSON.stringify(data, null, 2));
      
      if (data.resourceNames && data.resourceNames.length > 0) {
        console.log(`\n✅ ${data.resourceNames.length} conta(s) encontrada(s):`);
        data.resourceNames.forEach((resourceName, index) => {
          const customerId = resourceName.replace('customers/', '');
          console.log(`   ${index + 1}. Customer ID: ${customerId}`);
        });
        
        console.log('\n🎉 SUCESSO! O sistema está funcionando!');
        console.log('   Agora você pode selecionar contas na interface');
      } else {
        console.log('\n⚠️ API funcionou mas nenhuma conta encontrada');
        console.log('💡 Developer Token aprovado, mas sem contas Google Ads');
      }
    } else {
      const errorText = await listResponse.text();
      console.log('❌ API não funcionando');
      console.log('📄 Status:', listResponse.status);
      console.log('📄 Erro:', errorText.substring(0, 200) + '...');
      
      if (listResponse.status === 404) {
        console.log('\n💡 Developer Token não aprovado pelo Google');
        console.log('📚 Acesse https://ads.google.com → Ferramentas → Centro de API');
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

verificarEstrutura();