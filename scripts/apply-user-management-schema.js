const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  console.log('Certifique-se de que NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyUserManagementSchema() {
  try {
    console.log('🚀 Aplicando schema de gerenciamento de usuários...');

    // Ler o arquivo SQL
    const schemaPath = path.join(__dirname, '..', 'database', 'user-management-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Executar o schema
    const { error } = await supabase.rpc('exec_sql', { sql: schema });

    if (error) {
      console.error('❌ Erro ao aplicar schema:', error);
      return false;
    }

    console.log('✅ Schema de gerenciamento de usuários aplicado com sucesso!');

    // Verificar se as tabelas foram criadas
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['user_activities']);

    if (tablesError) {
      console.error('❌ Erro ao verificar tabelas:', tablesError);
      return false;
    }

    console.log('📋 Tabelas verificadas:', tables?.map(t => t.table_name));

    // Verificar se as colunas foram adicionadas
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'user_profiles')
      .in('column_name', ['is_suspended', 'suspended_at', 'suspended_by', 'suspension_reason']);

    if (columnsError) {
      console.error('❌ Erro ao verificar colunas:', columnsError);
      return false;
    }

    console.log('📊 Colunas adicionadas:', columns?.map(c => c.column_name));

    return true;

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return false;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  applyUserManagementSchema()
    .then(success => {
      if (success) {
        console.log('🎉 Schema aplicado com sucesso!');
        process.exit(0);
      } else {
        console.log('💥 Falha ao aplicar schema');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Erro fatal:', error);
      process.exit(1);
    });
}

module.exports = { applyUserManagementSchema };