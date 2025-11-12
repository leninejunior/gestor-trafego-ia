require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function verificar() {
  console.log('🔍 Verificando estrutura real da tabela...\n');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  // Buscar estrutura da tabela
  const { data, error } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'client_meta_connections'
        ORDER BY ordinal_position;
      `
    });
  
  if (error) {
    console.error('❌ Erro:', error.message);
    return;
  }
  
  console.log('📋 COLUNAS DA TABELA client_meta_connections:');
  console.log('='.repeat(60));
  data.forEach(col => {
    console.log(`- ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
  });
  
  console.log('\n✅ Estrutura verificada!');
}

verificar().catch(console.error);
