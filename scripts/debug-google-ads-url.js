/**
 * Debug da URL da API do Google Ads
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function debugGoogleAdsURL() {
  console.log('🔍 Debugando URLs da API do Google Ads...\n');

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

    console.log('📋 Testando diferentes versões e URLs...\n');

    // Testar diferentes versões da API
    const versions = ['v16', 'v15', 'v14'];
    const customerId = '1234567890'; // ID de teste

    for (const version of versions) {
      console.log(`🧪 Testando versão ${version}...`);
      
      const urls = [
        `https://googleads.googleapis.com/${version}/customers/${customerId}`,
        `https://googleads.googleapis.com/${version}/customers/${customerId}/googleAds:search`,
        `https://ads.googleapis.com/${version}/customers/${customerId}`,
        `https://ads.googleapis.com/${version}/customers/${customerId}/googleAds:search`,
      ];

      for (const url of urls) {
        try {
          console.log(`  📡 Testando: ${url}`);
          
          const response = await fetch(url, {
            method: url.includes(':search') ? 'POST' : 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'developer-token': developerToken,
              'Content-Type': 'application/json',
            },
            ...(url.includes(':search') && {
              body: JSON.stringify({
                query: 'SELECT customer.id FROM customer LIMIT 1'
              })
            })
          });

          console.log(`    Status: ${response.status}`);
          
          if (response.status !== 404) {
            const responseText = await response.text();
            console.log(`    Resposta: ${responseText.substring(0, 100)}...`);
            
            if (response.status === 200) {
              console.log(`    ✅ URL FUNCIONANDO: ${url}`);
            }
          }
        } catch (error) {
          console.log(`    ❌ Erro: ${error.message}`);
        }
      }
      console.log('');
    }

    // Testar também endpoints de descoberta
    console.log('🔍 Testando endpoints de descoberta...\n');
    
    const discoveryUrls = [
      'https://www.googleapis.com/discovery/v1/apis/googleads/v16/rest',
      'https://googleads.googleapis.com/$discovery/rest?version=v16',
      'https://developers.google.com/google-ads/api/rest/reference',
    ];

    for (const url of discoveryUrls) {
      try {
        console.log(`📡 Testando discovery: ${url}`);
        const response = await fetch(url);
        console.log(`  Status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.text();
          console.log(`  ✅ Discovery funcionando: ${data.substring(0, 100)}...`);
        }
      } catch (error) {
        console.log(`  ❌ Erro: ${error.message}`);
      }
    }

    // Informações importantes
    console.log('\n📚 INFORMAÇÕES IMPORTANTES:');
    console.log('1. Google Ads API é diferente de outras APIs do Google');
    console.log('2. Requer Developer Token aprovado pelo Google');
    console.log('3. Não tem endpoint público de descoberta');
    console.log('4. Customer ID deve ser real e acessível');
    console.log('5. Documentação: https://developers.google.com/google-ads/api/docs');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

// Executar debug
debugGoogleAdsURL();