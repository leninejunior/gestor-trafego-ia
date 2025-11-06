/**
 * Teste real da API do Google Ads usando endpoints que existem
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testarGoogleAdsReal() {
  console.log('🔍 Testando Google Ads API com abordagem real...\n');

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

    // Na API do Google Ads, você precisa saber o Customer ID para fazer consultas
    // Vamos tentar alguns Customer IDs comuns ou usar o que está na conexão
    
    let customerIds = [];
    
    // Se temos um customer_id na conexão, usar ele
    if (connection.customer_id && connection.customer_id !== 'pending') {
      customerIds.push(connection.customer_id);
    }
    
    // Adicionar alguns IDs de teste comuns (estes são IDs de exemplo da documentação)
    customerIds.push('1234567890', '9876543210');

    console.log('\n🧪 Testando com Customer IDs:', customerIds);

    for (const customerId of customerIds) {
      console.log(`\n🔍 Testando Customer ID: ${customerId}`);
      
      try {
        // Query simples para buscar informações do customer
        const query = `
          SELECT
            customer.id,
            customer.descriptive_name,
            customer.currency_code,
            customer.time_zone,
            customer.manager
          FROM customer
          LIMIT 1
        `;

        const response = await fetch(`https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:search`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': developerToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        });

        console.log(`📡 Status para ${customerId}:`, response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ SUCESSO para ${customerId}!`);
          console.log('📊 Dados:', JSON.stringify(data, null, 2));
          
          if (data.results && data.results.length > 0) {
            const customer = data.results[0].customer;
            console.log('\n🎯 CONTA REAL ENCONTRADA:');
            console.log(`- ID: ${customer.id}`);
            console.log(`- Nome: ${customer.descriptiveName}`);
            console.log(`- Moeda: ${customer.currencyCode}`);
            console.log(`- Fuso: ${customer.timeZone}`);
            console.log(`- É Manager: ${customer.manager ? 'Sim' : 'Não'}`);
            
            // Se encontramos uma conta real, vamos buscar campanhas também
            console.log('\n🚀 Buscando campanhas...');
            
            const campaignQuery = `
              SELECT
                campaign.id,
                campaign.name,
                campaign.status
              FROM campaign
              LIMIT 5
            `;

            const campaignResponse = await fetch(`https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:search`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': developerToken,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ query: campaignQuery }),
            });

            if (campaignResponse.ok) {
              const campaignData = await campaignResponse.json();
              console.log('📈 Campanhas encontradas:', campaignData.results?.length || 0);
              
              if (campaignData.results && campaignData.results.length > 0) {
                campaignData.results.forEach((result, index) => {
                  const campaign = result.campaign;
                  console.log(`  ${index + 1}. ${campaign.name} (${campaign.status})`);
                });
              }
            }
            
            // Parar no primeiro sucesso
            break;
          }
        } else {
          const errorText = await response.text();
          console.log(`❌ Erro para ${customerId}:`, errorText.substring(0, 200) + '...');
          
          // Analisar tipos de erro
          if (errorText.includes('CUSTOMER_NOT_FOUND')) {
            console.log('💡 Customer não encontrado - ID inválido');
          } else if (errorText.includes('PERMISSION_DENIED')) {
            console.log('💡 Sem permissão para acessar este customer');
          } else if (errorText.includes('DEVELOPER_TOKEN')) {
            console.log('💡 Problema com o Developer Token');
          } else if (response.status === 401) {
            console.log('💡 Token de acesso expirado');
          }
        }
      } catch (error) {
        console.log(`❌ Erro na requisição para ${customerId}:`, error.message);
      }
    }

    // Se chegamos aqui sem sucesso, vamos tentar refresh do token
    console.log('\n🔄 Tentando refresh do token...');
    
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
      
      console.log('💾 Token atualizado no banco');
      console.log('🔄 Tente executar o script novamente com o token novo');
    } else {
      console.log('❌ Falha no refresh do token');
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

// Executar teste
testarGoogleAdsReal();