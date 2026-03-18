require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkColumns() {
  console.log('🔍 Verificando colunas reais no banco\n');
  
  // Tentar SELECT * para ver quais colunas existem
  const tables = [
    'google_ads_encryption_keys',
    'google_ads_connections',
    'google_ads_campaigns'
  ];
  
  for (const table of tables) {
    console.log(`\n📋 ${table}:`);
    
    // Tentar inserir um registro vazio para ver erro de colunas
    const { error } = await supabase
      .from(table)
      .insert({})
      .select();
    
    if (error) {
      console.log(`  Erro: ${error.message}`);
      
      // Extrair colunas NOT NULL do erro
      if (error.message.includes('null value')) {
        const match = error.message.match(/column "(\w+)"/);
        if (match) {
          console.log(`  ✅ Coluna obrigatória detectada: ${match[1]}`);
        }
      }
    }
  }
  
  // Tentar query com colunas específicas
  console.log('\n\n🔍 Testando colunas específicas:\n');
  
  const tests = [
    { table: 'google_ads_encryption_keys', columns: ['id', 'key_data', 'algorithm', 'version', 'is_active'] },
    { table: 'google_ads_connections', columns: ['id', 'client_id', 'customer_id', 'is_active', 'status'] },
    { table: 'google_ads_campaigns', columns: ['id', 'client_id', 'campaign_id', 'status'] },
  ];
  
  for (const test of tests) {
    console.log(`\n${test.table}:`);
    for (const col of test.columns) {
      const { error } = await supabase
        .from(test.table)
        .select(col)
        .limit(0);
      
      if (error) {
        console.log(`  ❌ ${col}: ${error.message}`);
      } else {
        console.log(`  ✅ ${col}: existe`);
      }
    }
  }
}

checkColumns().catch(console.error);
