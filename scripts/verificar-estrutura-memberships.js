const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarEstruturaMemberships() {
  try {
    console.log('🔍 VERIFICANDO ESTRUTURA DA TABELA MEMBERSHIPS');
    console.log('==============================================\n');

    // Verificar estrutura da tabela
    const { data: columns } = await supabase.rpc('exec', {
      sql: `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'memberships' 
        ORDER BY ordinal_position;
      `
    });
    
    console.log('📋 Colunas da tabela memberships:');
    if (columns) {
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (Nullable: ${col.is_nullable})`);
      });
    }
    
    // Verificar dados existentes
    const { data: existingData } = await supabase
      .from('memberships')
      .select('*')
      .limit(5);
    
    console.log('\n📊 Dados existentes (primeiros 5):');
    if (existingData && existingData.length > 0) {
      existingData.forEach((row, index) => {
        console.log(`  ${index + 1}. User: ${row.user_id}, Org: ${row.org_id || row.organization_id}, Role: ${row.role_id}`);
      });
    } else {
      console.log('  Nenhum dado encontrado');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

verificarEstruturaMemberships();