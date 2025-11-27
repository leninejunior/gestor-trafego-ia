require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyColumns() {
  console.log('🔍 Verificando colunas diretamente via SQL\n');
  
  // Query SQL direta para verificar colunas
  const query = `
    SELECT 
      table_name,
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'google_ads_encryption_keys',
        'google_ads_connections',
        'google_ads_campaigns',
        'google_ads_audit_log'
      )
    ORDER BY table_name, ordinal_position;
  `;
  
  const { data, error } = await supabase.rpc('exec_sql', { query });
  
  if (error) {
    console.log('❌ Erro ao executar SQL:', error.message);
    console.log('\n💡 Tentando método alternativo...\n');
    
    // Método alternativo: usar postgrest
    const tables = [
      'google_ads_encryption_keys',
      'google_ads_connections', 
      'google_ads_campaigns',
      'google_ads_audit_log'
    ];
    
    for (const table of tables) {
      console.log(`\n📋 Tabela: ${table}`);
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(0);
      
      if (error) {
        console.log(`  ❌ Erro: ${error.message}`);
        
        // Tentar identificar colunas faltantes
        if (error.message.includes('column')) {
          const match = error.message.match(/column [\w.]+\.(\w+)/);
          if (match) {
            console.log(`  ⚠️  Coluna faltante detectada: ${match[1]}`);
          }
        }
      } else {
        console.log(`  ✅ Tabela acessível`);
      }
    }
    
    console.log('\n\n🔧 DIAGNÓSTICO:');
    console.log('O Supabase está com cache desatualizado.');
    console.log('\n💡 SOLUÇÕES:');
    console.log('1. Aguarde 1-2 minutos para o cache atualizar');
    console.log('2. Ou force refresh do schema no Supabase Dashboard');
    console.log('3. Ou reinicie o servidor Next.js (Ctrl+C e npm run dev)');
    
  } else {
    console.log('✅ Colunas encontradas:');
    console.log(data);
  }
}

verifyColumns().catch(console.error);
