/**
 * Teste direto da API do Google Ads para verificar se o Developer Token funciona
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testarAPIGoogleDireta() {
  console.log('🔍 Testando API do Google Ads diretamente...\n');

  try {
    // Conectar ao Supabase
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
      console.log('❌ Nenhuma conexão com tokens válidos encontrada');
      return;
    }

    const connection = connections[0];
    console.log('📋 Usando conexão:', connection.id);
    console.log('- Access Token:', connection.access_token.substring(0, 20) + '...');
    console.log('- Developer Token:', process.env.GOOGLE_DEVELOPER_TOKEN);

    // Testar API listAccessibleCustomers
    console.log('\n🌐 Testando listAccessibleCustomers...');
    
    // Primeiro, vamos testar se conseguimos acessar a API básica
    const response = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'developer-token': process.env.GOOGLE_DEVELOPER_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 Status da resposta:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Erro da API:', errorText);
      
      // Se for erro 401, tentar refresh do token
      if (response.status === 401) {
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
          
          // Tentar novamente com novo token
          const retryResponse = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${tokens.access_token}`,
              'developer-token': process.env.GOOGLE_DEVELOPER_TOKEN,
              'Content-Type': 'application/json',
            },
          });

          console.log('📡 Status da segunda tentativa:', retryResponse.status);
          
          if (retryResponse.ok) {
            const data = await retryResponse.json();
            console.log('✅ SUCESSO! Dados recebidos:', data);
            
            if (data.resourceNames && data.resourceNames.length > 0) {
              console.log(`\n🎉 Encontradas ${data.resourceNames.length} contas acessíveis:`);
              data.resourceNames.forEach((resourceName, index) => {
                const customerId = resourceName.replace('customers/', '');
                console.log(`  ${index + 1}. Customer ID: ${customerId}`);
              });
            }
          } else {
            const retryError = await retryResponse.text();
            console.log('❌ Erro na segunda tentativa:', retryError);
          }
        } else {
          console.log('❌ Falha no refresh do token');
        }
      }
    } else {
      const data = await response.json();
      console.log('✅ SUCESSO! Dados recebidos:', data);
      
      if (data.resourceNames && data.resourceNames.length > 0) {
        console.log(`\n🎉 Encontradas ${data.resourceNames.length} contas acessíveis:`);
        data.resourceNames.forEach((resourceName, index) => {
          const customerId = resourceName.replace('customers/', '');
          console.log(`  ${index + 1}. Customer ID: ${customerId}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

// Executar teste
testarAPIGoogleDireta();