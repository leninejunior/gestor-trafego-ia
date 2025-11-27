#!/usr/bin/env node

/**
 * Script para diagnosticar e fornecer SQL exato para corrigir o schema
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente faltando!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('\n========================================');
  console.log('🔍 DIAGNÓSTICO DO SCHEMA');
  console.log('========================================\n');

  // Verificar colunas da tabela google_ads_encryption_keys
  const { data: encryptionColumns, error: encError } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_name', 'google_ads_encryption_keys')
    .order('ordinal_position');

  console.log('📋 Colunas em google_ads_encryption_keys:');
  if (encError) {
    console.error('❌ Erro:', encError.message);
  } else {
    encryptionColumns?.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
  }

  // Verificar colunas da tabela google_ads_audit_log
  const { data: auditColumns, error: auditError } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_name', 'google_ads_audit_log')
    .order('ordinal_position');

  console.log('\n📋 Colunas em google_ads_audit_log:');
  if (auditError) {
    console.error('❌ Erro:', auditError.message);
  } else {
    auditColumns?.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
  }

  // Verificar colunas faltantes
  const encryptionColumnsNeeded = ['algorithm', 'version', 'key_hash', 'is_active', 'expires_at'];
  const auditColumnsNeeded = ['client_id', 'operation', 'metadata', 'resource_type', 'resource_id', 'success', 'error_message'];

  const missingEncryption = encryptionColumnsNeeded.filter(
    col => !encryptionColumns?.some(c => c.column_name === col)
  );

  const missingAudit = auditColumnsNeeded.filter(
    col => !auditColumns?.some(c => c.column_name === col)
  );

  console.log('\n========================================');
  console.log('⚠️  COLUNAS FALTANTES');
  console.log('========================================\n');

  if (missingEncryption.length > 0) {
    console.log('❌ google_ads_encryption_keys faltando:');
    missingEncryption.forEach(col => console.log(`   - ${col}`));
  } else {
    console.log('✅ google_ads_encryption_keys: todas as colunas presentes');
  }

  if (missingAudit.length > 0) {
    console.log('\n❌ google_ads_audit_log faltando:');
    missingAudit.forEach(col => console.log(`   - ${col}`));
  } else {
    console.log('✅ google_ads_audit_log: todas as colunas presentes');
  }

  // Gerar SQL para corrigir
  if (missingEncryption.length > 0 || missingAudit.length > 0) {
    console.log('\n========================================');
    console.log('🔧 SQL PARA APLICAR NO SUPABASE');
    console.log('========================================\n');
    console.log('COPIE E COLE NO SUPABASE SQL EDITOR:');
    console.log(`${supabaseUrl.replace('//', '//supabase.com/dashboard/project/')}/sql\n`);
    console.log('```sql');

    if (missingEncryption.length > 0) {
      console.log('-- Adicionar colunas em google_ads_encryption_keys');
      if (missingEncryption.includes('algorithm')) {
        console.log("ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS algorithm VARCHAR(50) DEFAULT 'aes-256-gcm';");
      }
      if (missingEncryption.includes('version')) {
        console.log('ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;');
      }
      if (missingEncryption.includes('key_hash')) {
        console.log('ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS key_hash TEXT;');
      }
      if (missingEncryption.includes('is_active')) {
        console.log('ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;');
      }
      if (missingEncryption.includes('expires_at')) {
        console.log('ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;');
      }
      console.log('');
    }

    if (missingAudit.length > 0) {
      console.log('-- Adicionar colunas em google_ads_audit_log');
      if (missingAudit.includes('client_id')) {
        console.log('ALTER TABLE google_ads_audit_log ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);');
      }
      if (missingAudit.includes('operation')) {
        console.log('ALTER TABLE google_ads_audit_log ADD COLUMN IF NOT EXISTS operation TEXT;');
      }
      if (missingAudit.includes('metadata')) {
        console.log("ALTER TABLE google_ads_audit_log ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;");
      }
      if (missingAudit.includes('resource_type')) {
        console.log('ALTER TABLE google_ads_audit_log ADD COLUMN IF NOT EXISTS resource_type TEXT;');
      }
      if (missingAudit.includes('resource_id')) {
        console.log('ALTER TABLE google_ads_audit_log ADD COLUMN IF NOT EXISTS resource_id TEXT;');
      }
      if (missingAudit.includes('success')) {
        console.log('ALTER TABLE google_ads_audit_log ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true;');
      }
      if (missingAudit.includes('error_message')) {
        console.log('ALTER TABLE google_ads_audit_log ADD COLUMN IF NOT EXISTS error_message TEXT;');
      }
      console.log('');
    }

    console.log('-- Forçar reload do cache do PostgREST');
    console.log("NOTIFY pgrst, 'reload schema';");
    console.log('```\n');

    console.log('========================================');
    console.log('📝 PRÓXIMOS PASSOS');
    console.log('========================================\n');
    console.log('1. Copie o SQL acima');
    console.log('2. Abra o Supabase SQL Editor no navegador');
    console.log('3. Cole e execute o SQL');
    console.log('4. Aguarde 5 segundos');
    console.log('5. Execute: node scripts/test-google-health-check.js\n');
  } else {
    console.log('\n✅ Schema está correto! Se ainda há erros, execute:');
    console.log('\nNOTIFY pgrst, \'reload schema\';\n');
    console.log('no Supabase SQL Editor para forçar reload do cache.\n');
  }
}

checkSchema().catch(console.error);
