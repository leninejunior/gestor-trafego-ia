/**
 * Debug Google Connection Creation
 * 
 * Investiga problemas na criação de conexões Google Ads
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('🔍 Investigando problema de criação de conexão Google Ads...\n');

async function debugConnectionCreation() {
  try {
    // Configurar Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Variáveis Supabase não configuradas');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('✅ Cliente Supabase configurado');
    
    // 1. Verificar se a tabela google_ads_connections existe
    console.log('\n📋 1. Verificando estrutura da tabela...');
    
    const { data: tableInfo, error: tableError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Erro ao acessar tabela google_ads_connections:', tableError);
      
      // Verificar se a tabela existe
      const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .like('table_name', '%google%');
      
      if (!tablesError && tables) {
        console.log('📊 Tabelas relacionadas ao Google encontradas:', tables.map(t => t.table_name));
      }
      
      return;
    }
    
    console.log('✅ Tabela google_ads_connections acessível');
    
    // 2. Verificar estrutura da tabela
    console.log('\n📋 2. Verificando colunas da tabela...');
    
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'google_ads_connections')
      .eq('table_schema', 'public');
    
    if (columnsError) {
      console.error('❌ Erro ao verificar colunas:', columnsError);
    } else {
      console.log('📊 Estrutura da tabela:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }
    
    // 3. Testar inserção simples
    console.log('\n📋 3. Testando inserção simples...');
    
    const testData = {
      client_id: '00000000-0000-0000-0000-000000000000', // UUID de teste
      user_id: '00000000-0000-0000-0000-000000000000',   // UUID de teste
      customer_id: 'test-customer',
      refresh_token: 'test-token',
      status: 'active' // Usar status válido
    };
    
    console.log('📝 Dados de teste:', testData);
    
    const { data: insertResult, error: insertError } = await supabase
      .from('google_ads_connections')
      .insert(testData)
      .select('id');
    
    if (insertError) {
      console.error('❌ Erro na inserção de teste:', insertError);
      console.error('   Código:', insertError.code);
      console.error('   Detalhes:', insertError.details);
      console.error('   Hint:', insertError.hint);
    } else {
      console.log('✅ Inserção de teste bem-sucedida:', insertResult);
      
      // Limpar dados de teste
      if (insertResult && insertResult[0]) {
        await supabase
          .from('google_ads_connections')
          .delete()
          .eq('id', insertResult[0].id);
        console.log('🧹 Dados de teste removidos');
      }
    }
    
    // 4. Verificar políticas RLS
    console.log('\n📋 4. Verificando políticas RLS...');
    
    const { data: policies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('policyname, cmd, qual, with_check')
      .eq('tablename', 'google_ads_connections');
    
    if (policiesError) {
      console.error('❌ Erro ao verificar políticas RLS:', policiesError);
    } else if (policies && policies.length > 0) {
      console.log('🔒 Políticas RLS encontradas:');
      policies.forEach(policy => {
        console.log(`  - ${policy.policyname} (${policy.cmd})`);
      });
    } else {
      console.log('⚠️  Nenhuma política RLS encontrada');
    }
    
    // 5. Verificar se RLS está habilitado
    console.log('\n📋 5. Verificando status RLS...');
    
    const { data: rlsStatus, error: rlsError } = await supabase
      .from('pg_class')
      .select('relname, relrowsecurity')
      .eq('relname', 'google_ads_connections');
    
    if (rlsError) {
      console.error('❌ Erro ao verificar RLS:', rlsError);
    } else if (rlsStatus && rlsStatus[0]) {
      console.log(`🔒 RLS habilitado: ${rlsStatus[0].relrowsecurity ? 'SIM' : 'NÃO'}`);
    }
    
    console.log('\n📋 RESUMO DO DIAGNÓSTICO:');
    console.log('1. Verifique se todas as colunas obrigatórias estão sendo preenchidas');
    console.log('2. Verifique se as políticas RLS permitem inserção para o usuário');
    console.log('3. Verifique se os UUIDs são válidos');
    console.log('4. Considere usar service client para bypass temporário do RLS');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Executar diagnóstico
debugConnectionCreation();