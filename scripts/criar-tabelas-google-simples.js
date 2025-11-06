/**
 * Criar tabelas do Google Ads de forma simples
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function criarTabelasGoogleSimples() {
  console.log('🔧 Criando tabelas do Google Ads...\n');
  
  try {
    // 1. Primeiro, vamos verificar a estrutura atual da tabela google_ads_connections
    console.log('1. Verificando estrutura atual...');
    
    const { data: connections, error: connError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .limit(1);

    if (connError) {
      console.error('❌ Erro ao acessar google_ads_connections:', connError);
      return;
    }

    console.log('✅ Tabela google_ads_connections acessível');

    // 2. Tentar criar a tabela de chaves de criptografia usando INSERT
    console.log('\n2. Criando tabela de chaves de criptografia...');
    
    try {
      // Tentar inserir um registro para forçar a criação da tabela
      const { error: insertError } = await supabase
        .from('google_ads_encryption_keys')
        .insert({
          key_data: Buffer.from('development-key-' + Date.now()).toString('base64'),
          is_active: true
        });

      if (insertError) {
        console.log('❌ Tabela google_ads_encryption_keys não existe:', insertError.message);
        console.log('   Você precisa criar esta tabela manualmente no Supabase SQL Editor');
        console.log('   SQL: CREATE TABLE google_ads_encryption_keys (');
        console.log('          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),');
        console.log('          key_data TEXT NOT NULL,');
        console.log('          is_active BOOLEAN DEFAULT true,');
        console.log('          created_at TIMESTAMPTZ DEFAULT NOW(),');
        console.log('          expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL \'30 days\')');
        console.log('        );');
      } else {
        console.log('✅ Tabela google_ads_encryption_keys criada/acessível');
      }
    } catch (error) {
      console.log('❌ Erro com google_ads_encryption_keys:', error.message);
    }

    // 3. Tentar criar a tabela de auditoria
    console.log('\n3. Criando tabela de auditoria...');
    
    try {
      const { error: auditError } = await supabase
        .from('google_ads_audit_log')
        .insert({
          action: 'test',
          details: { test: true }
        });

      if (auditError) {
        console.log('❌ Tabela google_ads_audit_log não existe:', auditError.message);
        console.log('   Você precisa criar esta tabela manualmente no Supabase SQL Editor');
        console.log('   SQL: CREATE TABLE google_ads_audit_log (');
        console.log('          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),');
        console.log('          user_id UUID,');
        console.log('          action TEXT NOT NULL,');
        console.log('          details JSONB,');
        console.log('          ip_address INET,');
        console.log('          user_agent TEXT,');
        console.log('          created_at TIMESTAMPTZ DEFAULT NOW()');
        console.log('        );');
      } else {
        console.log('✅ Tabela google_ads_audit_log criada/acessível');
        
        // Remover o registro de teste
        await supabase
          .from('google_ads_audit_log')
          .delete()
          .eq('action', 'test');
      }
    } catch (error) {
      console.log('❌ Erro com google_ads_audit_log:', error.message);
    }

    // 4. Criar versões simplificadas das APIs
    console.log('\n4. Vamos criar APIs simplificadas que não dependem dessas tabelas...');
    
    console.log('\n📋 INSTRUÇÕES MANUAIS:');
    console.log('1. Acesse o Supabase SQL Editor');
    console.log('2. Execute este SQL:');
    console.log('');
    console.log('-- Criar tabela de chaves de criptografia');
    console.log('CREATE TABLE IF NOT EXISTS google_ads_encryption_keys (');
    console.log('  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),');
    console.log('  key_data TEXT NOT NULL,');
    console.log('  is_active BOOLEAN DEFAULT true,');
    console.log('  created_at TIMESTAMPTZ DEFAULT NOW(),');
    console.log('  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL \'30 days\')');
    console.log(');');
    console.log('');
    console.log('-- Criar tabela de auditoria');
    console.log('CREATE TABLE IF NOT EXISTS google_ads_audit_log (');
    console.log('  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),');
    console.log('  user_id UUID,');
    console.log('  action TEXT NOT NULL,');
    console.log('  details JSONB,');
    console.log('  ip_address INET,');
    console.log('  user_agent TEXT,');
    console.log('  created_at TIMESTAMPTZ DEFAULT NOW()');
    console.log(');');
    console.log('');
    console.log('-- Adicionar colunas que faltam');
    console.log('ALTER TABLE google_ads_connections ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;');
    console.log('ALTER TABLE google_ads_connections ADD COLUMN IF NOT EXISTS encrypted_refresh_token TEXT;');
    console.log('ALTER TABLE google_ads_connections ADD COLUMN IF NOT EXISTS encrypted_access_token TEXT;');
    console.log('');
    console.log('-- Inserir chave inicial');
    console.log('INSERT INTO google_ads_encryption_keys (key_data, is_active)');
    console.log('SELECT encode(gen_random_bytes(32), \'base64\'), true');
    console.log('WHERE NOT EXISTS (SELECT 1 FROM google_ads_encryption_keys WHERE is_active = true);');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

criarTabelasGoogleSimples();