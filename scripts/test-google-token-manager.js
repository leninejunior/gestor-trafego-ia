/**
 * Teste do Google Token Manager
 * Verificar se os tokens estão sendo salvos e recuperados corretamente
 */

// Carregar variáveis de ambiente
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testGoogleTokenManager() {
  console.log('🔍 Testando Google Token Manager...\n');

  try {
    // 1. Buscar conexão existente
    console.log('1. Buscando conexão Google existente...');
    
    const { data: connections, error: connectionsError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .order('created_at', { ascending: false });

    if (connectionsError) {
      console.error('❌ Erro ao buscar conexões:', connectionsError);
      return;
    }

    if (!connections || connections.length === 0) {
      console.log('❌ Nenhuma conexão encontrada');
      return;
    }

    const connection = connections[0];
    console.log('✅ Conexão encontrada:', connection.id);
    console.log('   Detalhes da conexão:');
    console.log(`   - Client ID: ${connection.client_id}`);
    console.log(`   - Customer ID: ${connection.customer_id}`);
    console.log(`   - Status: ${connection.status}`);
    console.log(`   - Access Token: ${connection.access_token ? 'Presente' : 'AUSENTE'}`);
    console.log(`   - Refresh Token: ${connection.refresh_token ? 'Presente' : 'AUSENTE'}`);
    console.log(`   - Token Expires: ${connection.expires_at || 'NÃO DEFINIDO'}`);
    console.log(`   - Created: ${connection.created_at}`);
    console.log(`   - Updated: ${connection.updated_at}`);

    // 2. Simular salvamento de tokens
    if (!connection.access_token) {
      console.log('\n2. Access token ausente, simulando salvamento...');
      
      const mockTokens = {
        access_token: 'mock_access_token_' + Date.now(),
        refresh_token: connection.refresh_token || ('mock_refresh_token_' + Date.now()),
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString() // 1 hora
      };

      const { error: updateError } = await supabase
        .from('google_ads_connections')
        .update({
          access_token: mockTokens.access_token,
          refresh_token: mockTokens.refresh_token,
          expires_at: mockTokens.expires_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', connection.id);

      if (updateError) {
        console.error('❌ Erro ao atualizar tokens:', updateError);
      } else {
        console.log('✅ Tokens mock salvos com sucesso');
        console.log(`   Access Token: ${mockTokens.access_token.substring(0, 20)}...`);
        console.log(`   Expires At: ${mockTokens.expires_at}`);
      }
    } else {
      console.log('\n2. Access token já presente');
    }

    // 3. Testar API novamente
    console.log('\n3. Testando API após correção de tokens...');
    
    try {
      const response = await fetch(`http://localhost:3000/api/google/accounts?connectionId=${connection.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`Status da resposta: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API funcionou! Resposta resumida:');
        console.log(`   Total de contas: ${data.totalAccounts}`);
        console.log(`   É real: ${data.isReal ? 'Sim' : 'Não'}`);
        console.log(`   É MCC: ${data.isMCC ? 'Sim' : 'Não'}`);
        console.log(`   Mensagem: ${data.message}`);
        
        if (data.error) {
          console.log(`   Erro: ${data.error}`);
        }
        
      } else {
        const errorText = await response.text();
        console.log('❌ Erro na API:', errorText);
      }
    } catch (apiError) {
      console.error('❌ Erro ao chamar API:', apiError.message);
    }

    // 4. Verificar se o callback está salvando tokens
    console.log('\n4. Verificando processo de callback...');
    console.log('   Para obter dados reais, você precisa:');
    console.log('   1. Fazer o fluxo OAuth completo novamente');
    console.log('   2. Garantir que o callback salve os tokens corretamente');
    console.log('   3. Os tokens devem ser válidos e não expirados');
    console.log('');
    console.log('   Dica: Execute o OAuth novamente para obter tokens reais');

  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
  }
}

// Executar teste
testGoogleTokenManager().catch(console.error);