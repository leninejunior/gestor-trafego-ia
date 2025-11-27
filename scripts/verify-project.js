require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyProject() {
  console.log('🔍 Verificando projeto Supabase\n');
  
  console.log('📋 Configuração:');
  console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('Projeto ID:', process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]);
  console.log('\n');
  
  // Verificar tabelas existentes
  console.log('📊 Verificando tabelas Google Ads:\n');
  
  const tables = [
    'google_ads_encryption_keys',
    'google_ads_connections',
    'google_ads_campaigns',
    'google_ads_metrics',
    'google_ads_sync_logs',
    'google_ads_audit_log'
  ];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`❌ ${table}: NÃO EXISTE`);
      console.log(`   Erro: ${error.message}`);
    } else {
      console.log(`✅ ${table}: existe (${data?.length || 0} registros)`);
    }
  }
  
  // Verificar estrutura da tabela encryption_keys
  console.log('\n\n🔍 Estrutura da tabela google_ads_encryption_keys:\n');
  
  const testColumns = [
    'id',
    'key_data',
    'algorithm',
    'version',
    'key_hash',
    'is_active',
    'expires_at',
    'created_at'
  ];
  
  for (const col of testColumns) {
    const { error } = await supabase
      .from('google_ads_encryption_keys')
      .select(col)
      .limit(0);
    
    if (error) {
      console.log(`❌ ${col}`);
    } else {
      console.log(`✅ ${col}`);
    }
  }
  
  // Tentar descobrir quais colunas existem
  console.log('\n\n🔍 Tentando descobrir colunas existentes:\n');
  
  const { data: sample, error: sampleError } = await supabase
    .from('google_ads_encryption_keys')
    .select('*')
    .limit(1);
  
  if (!sampleError && sample && sample.length > 0) {
    console.log('Colunas encontradas:', Object.keys(sample[0]));
  } else if (!sampleError) {
    console.log('⚠️  Tabela vazia, não é possível listar colunas via SELECT');
    console.log('\n💡 Vou tentar INSERT para descobrir colunas obrigatórias...\n');
    
    const { error: insertError } = await supabase
      .from('google_ads_encryption_keys')
      .insert({});
    
    if (insertError) {
      console.log('Erro:', insertError.message);
      console.log('Detalhes:', insertError.details);
      console.log('Hint:', insertError.hint);
    }
  }
  
  console.log('\n\n💡 DIAGNÓSTICO:');
  console.log('Se as colunas algorithm, version, key_hash NÃO aparecem acima,');
  console.log('significa que o SQL NÃO foi executado no Supabase.');
  console.log('\nPossíveis causas:');
  console.log('1. Você está no projeto errado no Supabase Dashboard');
  console.log('2. O SQL deu erro mas você não viu a mensagem');
  console.log('3. Você não clicou em RUN após colar o SQL');
  console.log('4. Há um problema de permissões no projeto');
}

verifyProject().catch(console.error);
