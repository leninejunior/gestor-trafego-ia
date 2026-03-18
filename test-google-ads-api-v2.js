require('dotenv').config();
const axios = require('axios');

async function testGoogleAdsAPI() {
  try {
    console.log('🔧 Testando Google Ads API com login-customer-id...\n');

    // 1. Obter access token
    console.log('1️⃣ Obtendo access token...');
    const tokenData = {
      refresh_token: '1//0hlgatzSyPBy_CgYIARAAGBESNwF-L9Irx1um8YK0X1r_ABjfsU0El6crEvwx1XztlPjlhdkoAeWzyci0Qwftm61_N-YnnvmNmx0',
      client_id: '839778729862-rctp31o4ai6hcsmuj9lpqcg05fuolv43.apps.googleusercontent.com',
      client_secret: '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',
      grant_type: 'refresh_token'
    };

    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', tokenData);
    const accessToken = tokenResponse.data.access_token;
    console.log('✅ Access token obtido com sucesso');

    // 2. Listar contas acessíveis
    console.log('\n2️⃣ Listando contas acessíveis...');
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': '3LA2oAR9Ev2wI7AZDQVc2w',
      'Content-Type': 'application/json'
    };

    const accountsResponse = await axios.get('https://googleads.googleapis.com/v22/customers:listAccessibleCustomers', { headers });
    console.log('✅ Contas obtidas:', accountsResponse.data);

    if (accountsResponse.data.resourceNames && accountsResponse.data.resourceNames.length > 0) {
      // Tentar com cada conta até encontrar uma que funcione
      for (const resourceName of accountsResponse.data.resourceNames.slice(0, 3)) {
        const customerId = resourceName.replace('customers/', '');
        console.log(`\n3️⃣ Testando com a conta: ${customerId}`);

        try {
          // 3. Obter detalhes da conta
          const accountQuery = `
            SELECT
              customer.id,
              customer.descriptive_name,
              customer.currency_code,
              customer.time_zone,
              customer.manager
            FROM customer
            WHERE customer.id = ${customerId}
          `;

          const accountResponse = await axios.post(
            `https://googleads.googleapis.com/v22/customers/${customerId}/googleAds:search`,
            { query: accountQuery },
            { headers }
          );

          console.log('✅ Detalhes da conta:', accountResponse.data.results[0]?.customer);

          // 4. Listar campanhas
          console.log('\n4️⃣ Listando campanhas...');
          const campaignsQuery = `
            SELECT
              campaign.id,
              campaign.name,
              campaign.status,
              campaign_budget.amount_micros,
              campaign.start_date,
              campaign.end_date,
              metrics.impressions,
              metrics.clicks,
              metrics.conversions,
              metrics.cost_micros,
              metrics.ctr,
              metrics.conversions_from_interactions_rate,
              metrics.average_cpc,
              metrics.cost_per_conversion,
              metrics.conversions_value
            FROM campaign
            WHERE campaign.status != 'REMOVED'
            ORDER BY campaign.id
            LIMIT 5
          `;

          const campaignsResponse = await axios.post(
            `https://googleads.googleapis.com/v22/customers/${customerId}/googleAds:search`,
            { query: campaignsQuery },
            { headers }
          );

          console.log('✅ Campanhas obtidas:', campaignsResponse.data.results?.length || 0);
          
          if (campaignsResponse.data.results && campaignsResponse.data.results.length > 0) {
            console.log('🎉 Teste concluído com sucesso!');
            console.log('\n📊 Resumo:');
            console.log(`- Conta: ${customerId}`);
            console.log(`- Nome: ${accountResponse.data.results[0].customer.descriptiveName}`);
            console.log(`- Moeda: ${accountResponse.data.results[0].customer.currencyCode}`);
            console.log(`- Campanhas encontradas: ${campaignsResponse.data.results.length}`);
            
            campaignsResponse.data.results.forEach((campaign, index) => {
              console.log(`\nCampanha ${index + 1}:`);
              console.log(`- ID: ${campaign.campaign.id}`);
              console.log(`- Nome: ${campaign.campaign.name}`);
              console.log(`- Status: ${campaign.campaign.status}`);
              console.log(`- Impressões: ${campaign.metrics?.impressions || 0}`);
              console.log(`- Cliques: ${campaign.metrics?.clicks || 0}`);
              console.log(`- Custo: $${(parseFloat(campaign.metrics?.costMicros || 0) / 1000000).toFixed(2)}`);
            });
            
            return; // Sucesso! Sair do loop
          }
        } catch (accountError) {
          console.log(`❌ Erro com conta ${customerId}:`, accountError.response?.data?.error?.message || accountError.message);
          continue; // Tentar próxima conta
        }
      }
    }

    console.log('\n🏁 Teste finalizado');

  } catch (error) {
    console.error('\n❌ Erro geral durante o teste:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Message:', error.message);
    }
  }
}

testGoogleAdsAPI();