/**
 * Verificar se o Developer Token está válido
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function verificarDeveloperToken() {
  console.log('🔍 Verificando Developer Token do Google Ads...\n');

  try {
    const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;
    console.log('📋 Developer Token:', developerToken);
    console.log('📋 Tamanho:', developerToken?.length || 0, 'caracteres');
    
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
    console.log('\n📋 Usando conexão:', connection.id);

    // Testar com um customer ID específico (se tivermos)
    if (connection.customer_id && connection.customer_id !== 'pending') {
      console.log('\n🧪 Testando com Customer ID específico:', connection.customer_id);
      
      const query = `
        SELECT
          customer.id,
          customer.descriptive_name,
          customer.currency_code,
          customer.time_zone
        FROM customer
        LIMIT 1
      `;

      const response = await fetch(`https://googleads.googleapis.com/v16/customers/${connection.customer_id}/googleAds:search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      console.log('📡 Status da resposta:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ SUCESSO! Developer Token está funcionando');
        console.log('📊 Dados recebidos:', JSON.stringify(data, null, 2));
      } else {
        const errorText = await response.text();
        console.log('❌ Erro:', errorText);
        
        // Analisar o tipo de erro
        if (errorText.includes('DEVELOPER_TOKEN_NOT_APPROVED')) {
          console.log('💡 O Developer Token não está aprovado pelo Google');
        } else if (errorText.includes('INVALID_DEVELOPER_TOKEN')) {
          console.log('💡 O Developer Token é inválido');
        } else if (errorText.includes('AUTHENTICATION_ERROR')) {
          console.log('💡 Erro de autenticação - token pode estar expirado');
        }
      }
    } else {
      console.log('\n⚠️ Não há Customer ID específico para testar');
      console.log('💡 Isso é normal se você ainda não selecionou uma conta');
      
      // Vamos tentar uma abordagem diferente - testar o endpoint de customers
      console.log('\n🧪 Testando endpoint básico...');
      
      // Tentar com um customer ID genérico para teste
      const testCustomerId = '1234567890'; // ID de teste
      
      const response = await fetch(`https://googleads.googleapis.com/v16/customers/${testCustomerId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 Status da resposta:', response.status);
      const responseText = await response.text();
      console.log('📄 Resposta:', responseText.substring(0, 500) + '...');
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

// Executar teste
verificarDeveloperToken();