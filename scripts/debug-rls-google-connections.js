/**
 * Debug RLS policies para google_ads_connections
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugRLS() {
  console.log('🔍 Debugando RLS policies para google_ads_connections...\n');

  try {
    // 1. Verificar se a tabela existe
    console.log('📋 Verificando estrutura da tabela...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .limit(1);

    if (tableError) {
      console.error('❌ Erro ao acessar tabela:', tableError);
      return;
    }

    console.log('✅ Tabela acessível via service client');

    // 2. Contar registros total
    const { count, error: countError } = await supabase
      .from('google_ads_connections')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Erro ao contar registros:', countError);
    } else {
      console.log(`📊 Total de registros na tabela: ${count}`);
    }

    // 3. Listar todas as conexões
    const { data: connections, error: connectionsError } = await supabase
      .from('google_ads_connections')
      .select('*');

    if (connectionsError) {
      console.error('❌ Erro ao listar conexões:', connectionsError);
    } else {
      console.log(`🔗 Conexões encontradas: ${connections.length}`);
      
      connections.forEach((conn, index) => {
        console.log(`\nConexão ${index + 1}:`);
        console.log(`   ID: ${conn.id}`);
        console.log(`   User ID: ${conn.user_id}`);
        console.log(`   Client ID: ${conn.client_id}`);
        console.log(`   Status: ${conn.status}`);
        console.log(`   Tem tokens: ${!!conn.access_token && !!conn.refresh_token}`);
      });
    }

    // 4. Verificar políticas RLS
    console.log('\n🔒 Verificando políticas RLS...');
    const { data: policies, error: policiesError } = await supabase
      .rpc('exec_sql', { 
        sql_query: `
          SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
          FROM pg_policies 
          WHERE tablename = 'google_ads_connections'
        `
      });

    if (policiesError) {
      console.log('⚠️  Não foi possível verificar políticas RLS (função exec_sql não disponível)');
    } else {
      console.log('📋 Políticas RLS encontradas:', policies.length);
      policies.forEach((policy, index) => {
        console.log(`\nPolítica ${index + 1}:`);
        console.log(`   Nome: ${policy.policyname}`);
        console.log(`   Comando: ${policy.cmd}`);
        console.log(`   Roles: ${policy.roles}`);
        console.log(`   Condição: ${policy.qual}`);
      });
    }

    // 5. Testar acesso com cliente normal (simulando API)
    console.log('\n🧪 Testando acesso com cliente normal...');
    const normalClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: normalData, error: normalError } = await normalClient
      .from('google_ads_connections')
      .select('*')
      .limit(1);

    if (normalError) {
      console.log('❌ Cliente normal não consegue acessar:', normalError.message);
      console.log('   Isso indica que RLS está ativo e bloqueando acesso sem autenticação');
    } else {
      console.log('✅ Cliente normal consegue acessar');
    }

  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

debugRLS().catch(console.error);