/**
 * Diagnosticar erros nas APIs do Google Ads
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnosticarErrosGoogle() {
  console.log('🔍 Diagnosticando erros do Google Ads...\n');
  
  try {
    // 1. Verificar conexões Google
    console.log('1. Verificando conexões Google...');
    const { data: connections, error: connError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .order('created_at', { ascending: false });

    if (connError) {
      console.error('❌ Erro ao buscar conexões:', connError);
      return;
    }

    console.log(`   Encontradas ${connections?.length || 0} conexões`);
    
    if (connections && connections.length > 0) {
      const conn = connections[0];
      console.log(`   Última conexão: ${conn.id}`);
      console.log(`   Access Token: ${conn.access_token ? 'Presente' : 'AUSENTE'}`);
      console.log(`   É Mock: ${conn.access_token?.startsWith('mock_') ? 'SIM' : 'NÃO'}`);
      console.log(`   Expires: ${conn.expires_at}`);
      console.log(`   User ID: ${conn.user_id}`);
      console.log(`   Client ID: ${conn.client_id}`);
    }

    // 2. Testar API de Auth
    console.log('\n2. Testando API de Auth...');
    try {
      const authResponse = await fetch('http://localhost:3000/api/google/auth?clientId=test');
      console.log(`   Status: ${authResponse.status}`);
      
      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        console.log(`   Erro: ${errorText}`);
      }
    } catch (error) {
      console.error('   Erro na requisição:', error.message);
    }

    // 3. Testar API de Métricas
    console.log('\n3. Testando API de Métricas...');
    try {
      const metricsResponse = await fetch('http://localhost:3000/api/google/metrics?startDate=2024-10-01&endDate=2024-11-01&groupBy=campaign');
      console.log(`   Status: ${metricsResponse.status}`);
      
      if (!metricsResponse.ok) {
        const errorText = await metricsResponse.text();
        console.log(`   Erro: ${errorText}`);
      }
    } catch (error) {
      console.error('   Erro na requisição:', error.message);
    }

    // 4. Verificar variáveis de ambiente
    console.log('\n4. Verificando variáveis de ambiente...');
    const requiredVars = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_DEVELOPER_TOKEN',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];

    requiredVars.forEach(varName => {
      const value = process.env[varName];
      console.log(`   ${varName}: ${value ? 'Presente' : 'AUSENTE'}`);
    });

    // 5. Verificar estrutura da tabela
    console.log('\n5. Verificando estrutura da tabela...');
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_info', { table_name: 'google_ads_connections' });

    if (tableError) {
      console.error('   Erro ao verificar tabela:', tableError);
    } else {
      console.log('   Tabela existe e está acessível');
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

diagnosticarErrosGoogle();