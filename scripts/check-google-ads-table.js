const { createClient } = require('@supabase/supabase-js');

// Carregar variáveis de ambiente
require('dotenv').config();

console.log('🔍 Verificando tabela google_ads_connections...\n');

async function checkTable() {
  try {
    // Criar cliente Supabase com service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('📊 Testando acesso à tabela google_ads_connections...');
    
    // Tentar fazer uma query simples na tabela
    const { data, error, count } = await supabase
      .from('google_ads_connections')
      .select('*', { count: 'exact' })
      .limit(1);

    if (error) {
      console.log('❌ Erro ao acessar tabela:', error);
      console.log('   Código:', error.code);
      console.log('   Mensagem:', error.message);
      console.log('   Detalhes:', error.details);
      
      if (error.code === 'PGRST116') {
        console.log('\n💡 DIAGNÓSTICO: Tabela não existe!');
        console.log('   - A tabela google_ads_connections não foi criada');
        console.log('   - Precisa executar o schema SQL');
      }
    } else {
      console.log('✅ Tabela existe e é acessível!');
      console.log('   Registros encontrados:', count);
      console.log('   Dados de exemplo:', data);
    }

    // Verificar estrutura da tabela
    console.log('\n🔍 Verificando estrutura da tabela...');
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'google_ads_connections' });

    if (columnsError) {
      console.log('⚠️ Não foi possível verificar estrutura:', columnsError.message);
    } else {
      console.log('📋 Colunas da tabela:');
      columns?.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

async function testInsert() {
  console.log('\n🧪 Testando inserção na tabela...');
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Tentar inserir um registro de teste
    const testData = {
      client_id: '550e8400-e29b-41d4-a716-446655440000', // UUID válido
      customer_id: 'test-pending',
      refresh_token: 'test-token',
      status: 'pending'
    };

    console.log('📝 Dados de teste:', testData);

    const { data, error } = await supabase
      .from('google_ads_connections')
      .insert(testData)
      .select('id')
      .single();

    if (error) {
      console.log('❌ Erro na inserção:', error);
      console.log('   Código:', error.code);
      console.log('   Mensagem:', error.message);
      console.log('   Detalhes:', error.details);
    } else {
      console.log('✅ Inserção bem-sucedida!');
      console.log('   ID criado:', data.id);
      
      // Limpar o registro de teste
      await supabase
        .from('google_ads_connections')
        .delete()
        .eq('id', data.id);
      console.log('🧹 Registro de teste removido');
    }

  } catch (error) {
    console.error('❌ Erro no teste de inserção:', error.message);
  }
}

async function main() {
  console.log('🎯 OBJETIVO: Verificar se tabela google_ads_connections existe e funciona\n');
  
  await checkTable();
  await testInsert();
  
  console.log('\n📋 CONCLUSÃO:');
  console.log('Se a tabela não existir, execute:');
  console.log('1. Abra Supabase SQL Editor');
  console.log('2. Execute o arquivo database/google-ads-schema.sql');
  console.log('3. Teste novamente a conexão Google Ads');
}

main().catch(console.error);