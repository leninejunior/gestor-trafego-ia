/**
 * Verificar estrutura da tabela google_ads_connections
 */

// Carregar variáveis de ambiente
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTableStructure() {
  console.log('🔍 Verificando estrutura da tabela google_ads_connections...\n');

  try {
    // 1. Verificar se a tabela existe
    console.log('1. Verificando se a tabela existe...');
    
    const { data: tables, error: tablesError } = await supabase
      .rpc('exec_sql', { 
        sql: `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'google_ads_connections'
        `
      });

    if (tablesError) {
      console.log('⚠️ Erro ao verificar tabelas (tentando método alternativo):', tablesError.message);
      
      // Tentar método alternativo
      const { data: testData, error: testError } = await supabase
        .from('google_ads_connections')
        .select('*')
        .limit(1);

      if (testError) {
        console.log('❌ Tabela google_ads_connections não existe:', testError.message);
        return;
      } else {
        console.log('✅ Tabela existe (verificado via select)');
      }
    } else {
      if (tables && tables.length > 0) {
        console.log('✅ Tabela google_ads_connections existe');
      } else {
        console.log('❌ Tabela google_ads_connections não encontrada');
        return;
      }
    }

    // 2. Verificar colunas da tabela
    console.log('\n2. Verificando colunas da tabela...');
    
    try {
      const { data: columns, error: columnsError } = await supabase
        .rpc('exec_sql', { 
          sql: `
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'google_ads_connections'
            ORDER BY ordinal_position
          `
        });

      if (columnsError) {
        console.log('⚠️ Erro ao verificar colunas:', columnsError.message);
      } else {
        console.log('✅ Colunas da tabela:');
        columns.forEach(col => {
          console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
      }
    } catch (colError) {
      console.log('⚠️ Não foi possível verificar colunas via RPC');
    }

    // 3. Tentar inserir um registro de teste
    console.log('\n3. Testando inserção...');
    
    const testData = {
      client_id: '00000000-0000-0000-0000-000000000001',
      customer_id: 'test-customer',
      refresh_token: 'test-refresh-token',
      status: 'active'
    };

    const { data: insertResult, error: insertError } = await supabase
      .from('google_ads_connections')
      .insert(testData)
      .select();

    if (insertError) {
      console.log('❌ Erro na inserção:', insertError);
      console.log('   Code:', insertError.code);
      console.log('   Details:', insertError.details);
      console.log('   Hint:', insertError.hint);
    } else {
      console.log('✅ Inserção bem-sucedida:', insertResult);
      
      // Limpar o registro de teste
      await supabase
        .from('google_ads_connections')
        .delete()
        .eq('id', insertResult[0].id);
      
      console.log('✅ Registro de teste removido');
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Executar verificação
checkTableStructure().catch(console.error);