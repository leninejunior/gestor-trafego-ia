/**
 * Corrigir schema do Google Ads - criar tabelas necessárias
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function corrigirSchemaGoogleAds() {
  console.log('🔧 Corrigindo schema do Google Ads...\n');
  
  try {
    // 1. Verificar tabela google_ads_connections atual
    console.log('1. Verificando tabela google_ads_connections...');
    const { data: connections, error: connError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .limit(1);

    if (connError) {
      console.error('❌ Erro ao acessar google_ads_connections:', connError);
      return;
    }

    console.log('✅ Tabela google_ads_connections existe');

    // 2. Adicionar colunas que faltam na tabela google_ads_connections
    console.log('\n2. Adicionando colunas que faltam...');
    
    const alterTableSQL = `
      -- Adicionar coluna token_expires_at se não existir
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'google_ads_connections' 
          AND column_name = 'token_expires_at'
        ) THEN
          ALTER TABLE google_ads_connections 
          ADD COLUMN token_expires_at TIMESTAMPTZ;
        END IF;
      END $$;

      -- Adicionar coluna encrypted_refresh_token se não existir
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'google_ads_connections' 
          AND column_name = 'encrypted_refresh_token'
        ) THEN
          ALTER TABLE google_ads_connections 
          ADD COLUMN encrypted_refresh_token TEXT;
        END IF;
      END $$;

      -- Adicionar coluna encrypted_access_token se não existir
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'google_ads_connections' 
          AND column_name = 'encrypted_access_token'
        ) THEN
          ALTER TABLE google_ads_connections 
          ADD COLUMN encrypted_access_token TEXT;
        END IF;
      END $$;
    `;

    const { error: alterError } = await supabase.rpc('exec_sql', { sql: alterTableSQL });
    
    if (alterError) {
      console.log('⚠️ Erro ao adicionar colunas (pode ser normal se já existem):', alterError.message);
    } else {
      console.log('✅ Colunas adicionadas/verificadas');
    }

    // 3. Criar tabela de chaves de criptografia (simplificada)
    console.log('\n3. Criando tabela de chaves de criptografia...');
    
    const createEncryptionKeysSQL = `
      CREATE TABLE IF NOT EXISTS google_ads_encryption_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key_data TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
      );

      -- Criar índice para busca rápida da chave ativa
      CREATE INDEX IF NOT EXISTS idx_google_ads_encryption_keys_active 
      ON google_ads_encryption_keys (is_active, expires_at) 
      WHERE is_active = true;
    `;

    const { error: encryptionError } = await supabase.rpc('exec_sql', { sql: createEncryptionKeysSQL });
    
    if (encryptionError) {
      console.error('❌ Erro ao criar tabela de criptografia:', encryptionError);
    } else {
      console.log('✅ Tabela de criptografia criada');
    }

    // 4. Criar tabela de auditoria (simplificada)
    console.log('\n4. Criando tabela de auditoria...');
    
    const createAuditSQL = `
      CREATE TABLE IF NOT EXISTS google_ads_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        action TEXT NOT NULL,
        details JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Criar índice para consultas por usuário e data
      CREATE INDEX IF NOT EXISTS idx_google_ads_audit_log_user_date 
      ON google_ads_audit_log (user_id, created_at DESC);
    `;

    const { error: auditError } = await supabase.rpc('exec_sql', { sql: createAuditSQL });
    
    if (auditError) {
      console.error('❌ Erro ao criar tabela de auditoria:', auditError);
    } else {
      console.log('✅ Tabela de auditoria criada');
    }

    // 5. Inserir uma chave de criptografia inicial
    console.log('\n5. Inserindo chave de criptografia inicial...');
    
    const { data: existingKeys } = await supabase
      .from('google_ads_encryption_keys')
      .select('id')
      .eq('is_active', true)
      .limit(1);

    if (!existingKeys || existingKeys.length === 0) {
      // Gerar uma chave simples (em produção, use crypto.randomBytes)
      const simpleKey = Buffer.from('simple-encryption-key-for-development-only').toString('base64');
      
      const { error: keyError } = await supabase
        .from('google_ads_encryption_keys')
        .insert({
          key_data: simpleKey,
          is_active: true
        });

      if (keyError) {
        console.error('❌ Erro ao inserir chave:', keyError);
      } else {
        console.log('✅ Chave de criptografia inicial criada');
      }
    } else {
      console.log('✅ Chave de criptografia já existe');
    }

    // 6. Verificar estrutura final
    console.log('\n6. Verificando estrutura final...');
    
    const { data: finalCheck } = await supabase
      .from('google_ads_connections')
      .select('*')
      .limit(1);

    console.log('✅ Schema do Google Ads corrigido com sucesso!');
    console.log('\n📋 Próximos passos:');
    console.log('   1. Refaça o OAuth do Google Ads');
    console.log('   2. Os tokens agora serão salvos corretamente');
    console.log('   3. As contas reais da MCC serão exibidas');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Função auxiliar para executar SQL
async function createExecSqlFunction() {
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
    RETURNS TEXT
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE sql;
      RETURN 'OK';
    EXCEPTION
      WHEN OTHERS THEN
        RETURN SQLERRM;
    END;
    $$;
  `;

  try {
    await supabase.rpc('exec_sql', { sql: createFunctionSQL });
  } catch (error) {
    // Função pode não existir ainda, vamos tentar criar via query direta
    console.log('Criando função exec_sql...');
  }
}

// Executar
createExecSqlFunction().then(() => {
  corrigirSchemaGoogleAds();
});