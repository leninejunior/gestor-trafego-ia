/**
 * Test Google Account Selection
 * 
 * Testa o fluxo de seleção de contas Google Ads
 */

require('dotenv').config();

console.log('🧪 Testando seleção de contas Google Ads...\n');

async function testAccountSelection() {
  try {
    const connectionId = '1aeaf6ff-d4d4-4726-a8f2-637dfd04eddf'; // ID da conexão criada
    const clientId = 'e0ae65bf-1f97-474a-988e-a5418ab28e77';     // ID do cliente Coan Consultoria
    
    console.log('📋 1. Testando API de busca de contas...');
    console.log(`   Connection ID: ${connectionId}`);
    console.log(`   Client ID: ${clientId}`);
    
    // Simular chamada para a API de contas
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const apiUrl = `${baseUrl}/api/google/accounts?connectionId=${connectionId}`;
    
    console.log(`\n🔗 URL da API: ${apiUrl}`);
    
    try {
      const response = await fetch(apiUrl);
      console.log(`📊 Status da resposta: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Resposta da API:', JSON.stringify(data, null, 2));
      } else {
        const errorText = await response.text();
        console.log('❌ Erro na API:', errorText);
      }
    } catch (fetchError) {
      console.log('❌ Erro na requisição:', fetchError.message);
    }
    
    console.log('\n📋 2. URL para acessar a página de seleção:');
    const selectionUrl = `${baseUrl}/google/select-accounts?connectionId=${connectionId}&clientId=${clientId}`;
    console.log(`🔗 ${selectionUrl}`);
    
    console.log('\n📋 3. Verificando se a conexão precisa de seleção de conta...');
    
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data: connection, error } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('id', connectionId)
      .single();
    
    if (error) {
      console.log('❌ Erro ao buscar conexão:', error);
      return;
    }
    
    console.log('📊 Status da conexão:');
    console.log(`   - Customer ID: ${connection.customer_id}`);
    console.log(`   - Status: ${connection.status}`);
    console.log(`   - Precisa seleção: ${connection.customer_id === 'pending' ? 'SIM' : 'NÃO'}`);
    
    if (connection.customer_id === 'pending') {
      console.log('\n✅ A conexão está aguardando seleção de conta!');
      console.log('📋 PRÓXIMOS PASSOS:');
      console.log('1. Acesse a URL de seleção de contas');
      console.log('2. Selecione uma conta do Google Ads');
      console.log('3. A conexão será atualizada com o customer_id real');
      console.log('4. A conexão aparecerá no dashboard do cliente');
    } else {
      console.log('\n⚠️  A conexão já tem um customer_id definido');
    }
    
    console.log('\n📋 4. Testando componente de exibição...');
    console.log('Para verificar se a conexão aparece no frontend:');
    console.log('1. Acesse o dashboard do cliente Coan Consultoria');
    console.log('2. Verifique se há uma seção "Conexões Google Ads"');
    console.log('3. Se não aparecer, pode ser problema de RLS ou cache');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Executar teste
testAccountSelection();