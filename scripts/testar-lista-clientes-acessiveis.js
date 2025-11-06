require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testarListaClientesAcessiveis() {
  console.log('🔍 Testando lista de clientes acessíveis do Google Ads...\n');

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
    console.log('📋 Conexão encontrada:', {
      id: connection.id,
      client_id: connection.client_id,
      customer_id: connection.customer_id,
      status: connection.status
    });

    if (!connection.access_token) {
      console.error('❌ Access token não encontrado');
      return;
    }

    const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;
    if (!developerToken) {
      console.error('❌ Developer Token não configurado');
      return;
    }

    console.log('\n🧪 Testando API listAccessibleCustomers...');
    console.log('📋 Developer Token:', developerToken);
    console.log('📋 Access Token:', connection.access_token.substring(0, 20) + '...');

    // Testar API de clientes acessíveis
    const response = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
      },
    });

    console.log('\n📡 Status da resposta:', response.status);
    console.log('📡 Headers da resposta:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro da API:', errorText);
      
      if (response.status === 401) {
        console.log('\n🔄 Tentando refresh do token...');
        
        // Tentar refresh do token
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

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          console.log('✅ Token refreshed com sucesso');
          
          // Atualizar token no banco
          const { error: updateError } = await supabase
            .from('google_ads_connections')
            .update({
              access_token: refreshData.access_token,
              token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
            })
            .eq('id', connection.id);

          if (updateError) {
            console.error('❌ Erro ao atualizar token:', updateError);
          } else {
            console.log('💾 Token atualizado no banco');
            console.log('🔄 Execute o script novamente com o token novo');
          }
        } else {
          console.error('❌ Erro ao fazer refresh do token');
        }
      }
      
      return;
    }

    const data = await response.json();
    console.log('\n✅ Resposta da API:', JSON.stringify(data, null, 2));

    if (!data.resourceNames || data.resourceNames.length === 0) {
      console.log('\n⚠️ Nenhum cliente acessível encontrado');
      console.log('\n💡 POSSÍVEIS CAUSAS:');
      console.log('1. Developer Token não aprovado pelo Google');
      console.log('2. Conta não tem acesso a nenhuma conta Google Ads');
      console.log('3. Conta precisa de permissões adicionais');
      console.log('\n📚 VERIFICAÇÕES:');
      console.log('1. Acesse https://ads.google.com');
      console.log('2. Vá em Ferramentas → Centro de API');
      console.log('3. Verifique o status do Developer Token');
      console.log('4. Verifique se você tem contas Google Ads ativas');
    } else {
      console.log(`\n✅ ${data.resourceNames.length} cliente(s) acessível(is) encontrado(s):`);
      data.resourceNames.forEach((resourceName, index) => {
        const customerId = resourceName.replace('customers/', '');
        console.log(`${index + 1}. Customer ID: ${customerId}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testarListaClientesAcessiveis();