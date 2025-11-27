require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addColumns() {
  console.log('🔧 Adicionando colunas via SQL direto\n');
  console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('Projeto:', process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]);
  console.log('\n');
  
  const queries = [
    {
      name: 'algorithm em encryption_keys',
      sql: `ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS algorithm VARCHAR(50) DEFAULT 'aes-256-gcm';`
    },
    {
      name: 'version em encryption_keys',
      sql: `ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;`
    },
    {
      name: 'key_hash em encryption_keys',
      sql: `ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS key_hash TEXT;`
    },
    {
      name: 'expires_at em encryption_keys',
      sql: `ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;`
    },
    {
      name: 'is_active em connections',
      sql: `ALTER TABLE google_ads_connections ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`
    },
    {
      name: 'last_sync_at em connections',
      sql: `ALTER TABLE google_ads_connections ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;`
    },
    {
      name: 'budget_amount_micros em campaigns',
      sql: `ALTER TABLE google_ads_campaigns ADD COLUMN IF NOT EXISTS budget_amount_micros BIGINT;`
    }
  ];
  
  console.log('⚠️  IMPORTANTE: O Supabase não permite executar DDL via API JavaScript!\n');
  console.log('Você DEVE executar o SQL manualmente no Supabase SQL Editor.\n');
  console.log('📋 Copie e cole este SQL no editor:\n');
  console.log('=' .repeat(80));
  console.log(queries.map(q => q.sql).join('\n'));
  console.log('=' .repeat(80));
  console.log('\n');
  console.log('🔗 Link direto para o SQL Editor:');
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0];
  console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.log('\n');
  
  // Verificar se as colunas já existem
  console.log('🔍 Verificando estado atual das colunas:\n');
  
  const checks = [
    { table: 'google_ads_encryption_keys', column: 'algorithm' },
    { table: 'google_ads_encryption_keys', column: 'version' },
    { table: 'google_ads_encryption_keys', column: 'key_hash' },
    { table: 'google_ads_connections', column: 'is_active' },
  ];
  
  for (const check of checks) {
    const { error } = await supabase
      .from(check.table)
      .select(check.column)
      .limit(0);
    
    if (error) {
      console.log(`❌ ${check.table}.${check.column} - NÃO EXISTE`);
    } else {
      console.log(`✅ ${check.table}.${check.column} - existe`);
    }
  }
  
  console.log('\n');
  console.log('💡 PRÓXIMOS PASSOS:');
  console.log('1. Abra o link do SQL Editor acima');
  console.log('2. Cole o SQL entre as linhas ===');
  console.log('3. Clique em RUN');
  console.log('4. Execute este script novamente para verificar');
}

addColumns().catch(console.error);
