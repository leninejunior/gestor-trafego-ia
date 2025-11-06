/**
 * Corrigir estrutura da tabela google_ads_encryption_keys
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function corrigirTabelaEncryptionKeys() {
  console.log('🔧 Corrigindo estrutura da tabela google_ads_encryption_keys...\n');

  try {
    // SQL para corrigir a tabela
    const sql = `
      -- Adicionar colunas que faltam na tabela google_ads_encryption_keys
      ALTER TABLE google_ads_encryption_keys 
      ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS algorithm TEXT DEFAULT 'aes-256-gcm',
      ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES google_ads_connections(id);

      -- Criar índice para version
      CREATE INDEX IF NOT EXISTS idx_google_ads_encryption_keys_version 
      ON google_ads_encryption_keys (version DESC);

      -- Criar índice para connection_id
      CREATE INDEX IF NOT EXISTS idx_google_ads_encryption_keys_connection 
      ON google_ads_encryption_keys (connection_id);

      -- Atualizar registros existentes para ter version = 1
      UPDATE google_ads_encryption_keys 
      SET version = 1 
      WHERE version IS NULL;
    `;

    console.log('📝 Executando SQL para corrigir tabela...');
    
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Erro ao executar SQL:', error);
      
      // Tentar executar comando por comando
      console.log('🔄 Tentando executar comandos individualmente...');
      
      const commands = [
        'ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1',
        'ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS algorithm TEXT DEFAULT \'aes-256-gcm\'',
        'ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS connection_id UUID',
        'CREATE INDEX IF NOT EXISTS idx_google_ads_encryption_keys_version ON google_ads_encryption_keys (version DESC)',
        'CREATE INDEX IF NOT EXISTS idx_google_ads_encryption_keys_connection ON google_ads_encryption_keys (connection_id)',
        'UPDATE google_ads_encryption_keys SET version = 1 WHERE version IS NULL'
      ];

      for (const command of commands) {
        try {
          console.log(`   Executando: ${command}`);
          const { error: cmdError } = await supabase.rpc('exec_sql', { sql_query: command });
          if (cmdError) {
            console.error(`   ❌ Erro: ${cmdError.message}`);
          } else {
            console.log('   ✅ Sucesso');
          }
        } catch (cmdError) {
          console.error(`   ❌ Erro: ${cmdError.message}`);
        }
      }
    } else {
      console.log('✅ Tabela corrigida com sucesso!');
    }

    // Verificar estrutura final
    console.log('\n🔍 Verificando estrutura final da tabela...');
    const { data: tableInfo, error: infoError } = await supabase
      .from('google_ads_encryption_keys')
      .select('*')
      .limit(1);

    if (infoError) {
      console.error('❌ Erro ao verificar tabela:', infoError);
    } else {
      console.log('✅ Tabela verificada com sucesso');
      if (tableInfo && tableInfo.length > 0) {
        console.log('📋 Colunas disponíveis:', Object.keys(tableInfo[0]));
      }
    }

  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

corrigirTabelaEncryptionKeys().catch(console.error);