/**
 * Teste com endpoints corretos da API do Google Ads
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testarGoogleAdsCorreto() {
  console.log('🔍 Testando Google Ads API com endpoints corretos...\n');

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Buscar conexão com tokens válidos
    const { data: connections } = await supabase
      .from('google_ads_connections')
      .select('*')
      .not('access_token', 'eq', 'pending')
      .not('access_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!connections || connections.length === 0) {
      console.log('❌ Nenhuma conexão encontrada');
      return;
    }

    const connection = connections[0];
    const accessToken = connection.access_token;
    const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;

    console.log('📋 Developer Token:', developerToken);
    console.log('📋 Access Token:', accessToken.substring(0, 20) + '...');

    // 1. Primeiro, vamos tentar listar customers acessíveis
    console.log('\n🧪 Teste 1: Listando customers acessíveis...');
    
    try {
      const listResponse = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': developerToken,
        },
      });

      console.log('📡 Status:', listResponse.status);
      
      if (listResponse.ok) {
        const data = await listResponse.json();
        console.log('✅ SUCESSO! Customers acessíveis:', data);
        
        if (data.resourceNames && data.resourceNames.length > 0) {
          console.log(`\n🎉 Encontrados ${data.resourceNames.length} customers:`);
          
          // Extrair IDs dos customers
          const customerIds = data.resourceNames.map(name => name.replace('customers/', ''));
          
          // Testar o primeiro customer
          const firstCustomerId = customerIds[0];
          console.log(`\n🧪 Teste 2: Buscando info do customer ${firstCustomerId}...`);
          
          const query = `
            SELECT
              customer.id,
              customer.descriptive_name,
              customer.currency_code,
              customer.time_zone,
              customer.manager
            FROM customer
            WHERE customer.id = ${firstCustomerId}
          `;

          const searchResponse = await fetch(`https://googleads.googleapis.com/v16/customers/${firstCustomerId}/googleAds:search`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'developer-token': developerToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
          });

          console.log('📡 Status da busca:', searchResponse.status);
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            console.log('✅ SUCESSO! Info do customer:', searchData);
            
            if (searchData.results && searchData.results.length > 0) {
              const customer = searchData.results[0].customer;
              console.log('\n🎯 DADOS REAIS ENCONTRADOS:');
              console.log(`- ID: ${customer.id}`);
              console.log(`- Nome: ${customer.descriptiveName}`);
              console.log(`- Moeda: ${customer.currencyCode}`);
              console.log(`- Fuso: ${customer.timeZone}`);
              console.log(`- É Manager: ${customer.manager ? 'Sim' : 'Não'}`);
            }
          } else {
            const searchError = await searchResponse.text();
            console.log('❌ Erro na busca:', searchError);
          }
        }
      } else {
        const errorText = await listResponse.text();
        console.log('❌ Erro ao listar customers:', errorText);
        
        // Verificar se é erro de token expirado
        if (listResponse.status === 401) {
          console.log('\n🔄 Token pode estar expirado, tentando refresh...');
          
          const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              refresh_token: connection.refresh_token,
              client_id: process.env.GOOGLE_CLIENT_ID,
              client_secret: process.env.GOOGLE_CLIENT_SECRET,
              grant_type: 'refresh_token',
            }),
          });

          if (refreshResponse.ok) {
            const tokens = await refreshResponse.json();
            console.log('✅ Token refreshed com sucesso');
            
            // Atualizar no banco
            await supabase
              .from('google_ads_connections')
              .update({ 
                access_token: tokens.access_token,
                updated_at: new Date().toISOString()
              })
              .eq('id', connection.id);
            
            console.log('💾 Token atualizado no banco de dados');
            
            // Tentar novamente
            console.log('\n🔄 Tentando novamente com token novo...');
            const retryResponse = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'developer-token': developerToken,
              },
            });

            console.log('📡 Status da segunda tentativa:', retryResponse.status);
            
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              console.log('✅ SUCESSO na segunda tentativa!', retryData);
            } else {
              const retryError = await retryResponse.text();
              console.log('❌ Erro na segunda tentativa:', retryError);
            }
          }
        }
      }
    } catch (fetchError) {
      console.log('❌ Erro na requisição:', fetchError.message);
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

// Executar teste
testarGoogleAdsCorreto();