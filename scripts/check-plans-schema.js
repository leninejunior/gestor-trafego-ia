const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('🔍 Verificando schema da tabela subscription_plans...\n');
  
  const { data, error } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'subscription_plans'
        ORDER BY ordinal_position;
      `
    });
  
  if (error) {
    console.log('⚠️  RPC não disponível, tentando query direta...\n');
    
    // Alternativa: pegar um registro e ver suas colunas
    const { data: sample, error: sampleError } = await supabase
      .from('subscription_plans')
      .select('*')
      .limit(1)
      .single();
    
    if (sampleError) {
      console.error('❌ Erro:', sampleError);
      return;
    }
    
    console.log('📋 Colunas encontradas no registro:');
    Object.keys(sample).forEach(key => {
      console.log(`   - ${key}: ${typeof sample[key]}`);
    });
    
    return;
  }
  
  console.log('📋 Schema da tabela:\n');
  data.forEach(col => {
    console.log(`   ${col.column_name}`);
    console.log(`      Tipo: ${col.data_type}`);
    console.log(`      Nullable: ${col.is_nullable}`);
    console.log(`      Default: ${col.column_default || 'N/A'}`);
    console.log('');
  });
}

checkSchema().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
