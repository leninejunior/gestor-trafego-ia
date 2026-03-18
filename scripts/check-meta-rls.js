require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRLS() {
  console.log('🔍 Verificando políticas RLS das tabelas Meta...\n');

  const tables = [
    'meta_campaigns',
    'meta_adsets',
    'meta_ads'
  ];

  for (const table of tables) {
    console.log(`\n📋 Tabela: ${table}`);
    console.log('='.repeat(50));

    // Buscar políticas
    const { data: policies, error } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', table);

    if (error) {
      console.log('⚠️  Erro ao buscar políticas:', error.message);
    } else if (policies && policies.length > 0) {
      console.log(`✅ ${policies.length} políticas encontradas`);
      policies.forEach(p => {
        console.log(`\n   📜 ${p.policyname}`);
        console.log(`      Comando: ${p.cmd}`);
      });
    } else {
      console.log('❌ Nenhuma política encontrada');
    }
  }

  console.log('\n\n🔍 Verificando estrutura de relacionamentos...\n');

  // Verificar colunas
  const { data: columns, error: colError } = await supabase
    .from('information_schema.columns')
    .select('table_name, column_name, data_type')
    .in('table_name', ['meta_campaigns', 'meta_adsets', 'meta_ads'])
    .in('column_name', ['connection_id', 'campaign_id', 'adset_id', 'client_id']);

  if (colError) {
    console.log('⚠️  Não foi possível verificar colunas:', colError.message);
  } else if (columns) {
    console.log('📊 Colunas de relacionamento:');
    let currentTable = '';
    columns.forEach(col => {
      if (col.table_name !== currentTable) {
        currentTable = col.table_name;
        console.log(`\n   ${currentTable}:`);
      }
      console.log(`      - ${col.column_name} (${col.data_type})`);
    });
  }

  console.log('\n✅ Verificação concluída!');
}

checkRLS().catch(console.error);
