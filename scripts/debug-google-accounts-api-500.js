/**
 * Debug Google Accounts API 500 Error
 * Investigar o erro específico na API /api/google/accounts
 */

const { createClient } = require('@supabase/supabase-js');

// Carregar variáveis de ambiente
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugGoogleAccountsAPI() {
  console.log('🔍 Debugando erro 500 na API Google Accounts...\n');

  try {
    // 1. Verificar conexões Google existentes
    console.log('1. Verificando conexões Google existentes...');
    const { data: connections, error: connectionsError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .order('created_at', { ascending: false });

    if (connectionsError) {
      console.error('❌ Erro ao buscar conexões:', connectionsError);
      return;
    }

    console.log(`✅ Encontradas ${connections?.length || 0} conexões`);
    
    if (connections && connections.length > 0) {
      console.log('\n📋 Conexões encontradas:');
      connections.forEach((conn, index) => {
        console.log(`${index + 1}. ID: ${conn.id}`);
        console.log(`   Client ID: ${conn.client_id}`);
        console.log(`   Customer ID: ${conn.customer_id}`);
        console.log(`   Status: ${conn.status}`);
        console.log(`   Token Expires: ${conn.token_expires_at}`);
        console.log(`   Created: ${conn.created_at}`);
        console.log('');
      });

      // 2. Testar com uma conexão específica
      const testConnection = connections[0];
      console.log(`2. Testando API com conexão: ${testConnection.id}`);

      try {
        // Simular chamada da API
        const response = await fetch(`http://localhost:3000/api/google/accounts?connectionId=${testConnection.id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.log(`Status da resposta: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ API funcionou! Resposta:', data);
        } else {
          const errorText = await response.text();
          console.log('❌ Erro na API:', errorText);
        }
      } catch (apiError) {
        console.error('❌ Erro ao chamar API:', apiError.message);
      }
    }

    // 3. Verificar variáveis de ambiente Google
    console.log('\n3. Verificando variáveis de ambiente Google...');
    const googleVars = {
      'GOOGLE_CLIENT_ID': process.env.GOOGLE_CLIENT_ID ? '✅ Definida' : '❌ Não definida',
      'GOOGLE_CLIENT_SECRET': process.env.GOOGLE_CLIENT_SECRET ? '✅ Definida' : '❌ Não definida',
      'GOOGLE_DEVELOPER_TOKEN': process.env.GOOGLE_DEVELOPER_TOKEN ? '✅ Definida' : '❌ Não definida',
    };

    Object.entries(googleVars).forEach(([key, status]) => {
      console.log(`${key}: ${status}`);
    });

    // 4. Verificar estrutura da tabela google_ads_connections
    console.log('\n4. Verificando estrutura da tabela...');
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_info', { table_name: 'google_ads_connections' });

    if (tableError) {
      console.log('⚠️ Não foi possível verificar estrutura da tabela:', tableError.message);
    } else {
      console.log('✅ Estrutura da tabela verificada');
    }

    // 5. Verificar se há tokens válidos
    console.log('\n5. Verificando tokens...');
    if (connections && connections.length > 0) {
      const activeConnections = connections.filter(conn => conn.status === 'active');
      console.log(`Conexões ativas: ${activeConnections.length}`);
      
      activeConnections.forEach(conn => {
        const hasAccessToken = !!conn.access_token;
        const hasRefreshToken = !!conn.refresh_token;
        const tokenExpired = conn.token_expires_at ? new Date(conn.token_expires_at) < new Date() : true;
        
        console.log(`\nConexão ${conn.id}:`);
        console.log(`  Access Token: ${hasAccessToken ? '✅ Presente' : '❌ Ausente'}`);
        console.log(`  Refresh Token: ${hasRefreshToken ? '✅ Presente' : '❌ Ausente'}`);
        console.log(`  Token Expirado: ${tokenExpired ? '❌ Sim' : '✅ Não'}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro geral no debug:', error);
  }
}

// Executar debug
debugGoogleAccountsAPI().catch(console.error);