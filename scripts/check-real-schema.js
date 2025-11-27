#!/usr/bin/env node

/**
 * Verifica o schema REAL do Supabase (não o cache)
 * Conecta direto no PostgreSQL via service role
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function checkRealSchema() {
  console.log('\n========================================');
  console.log('Verificando Schema REAL do PostgreSQL');
  console.log('========================================\n');

  // Query direto no information_schema (fonte da verdade)
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('google_ads_encryption_keys', 'google_ads_audit_log')
      ORDER BY table_name, ordinal_position;
    `
  });

  if (error) {
    console.log('❌ Erro ao consultar schema:', error.message);
    console.log('\nTentando query alternativa...\n');
    
    // Tenta query direta
    const { data: keysData, error: keysError } = await supabase
      .from('google_ads_encryption_keys')
      .select('*')
      .limit(1);
    
    if (keysError) {
      console.log('Erro na tabela encryption_keys:', keysError);
    } else {
      console.log('Colunas encontradas em encryption_keys:');
      if (keysData && keysData[0]) {
        console.log(Object.keys(keysData[0]));
      } else {
        console.log('Tabela vazia, não é possível determinar colunas');
      }
    }

    const { data: auditData, error: auditError } = await supabase
      .from('google_ads_audit_log')
      .select('*')
      .limit(1);
    
    if (auditError) {
      console.log('\nErro na tabela audit_log:', auditError);
    } else {
      console.log('\nColunas encontradas em audit_log:');
      if (auditData && auditData[0]) {
        console.log(Object.keys(auditData[0]));
      } else {
        console.log('Tabela vazia, não é possível determinar colunas');
      }
    }
    
    return;
  }

  console.log('Schema encontrado:');
  console.log(JSON.stringify(data, null, 2));

  // Verificar colunas específicas
  const hasAlgorithm = data?.some(col => 
    col.table_name === 'google_ads_encryption_keys' && 
    col.column_name === 'algorithm'
  );

  const hasClientId = data?.some(col => 
    col.table_name === 'google_ads_audit_log' && 
    col.column_name === 'client_id'
  );

  console.log('\n========================================');
  console.log('Verificação de Colunas Críticas');
  console.log('========================================\n');
  console.log(`encryption_keys.algorithm: ${hasAlgorithm ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);
  console.log(`audit_log.client_id: ${hasClientId ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);

  if (!hasAlgorithm || !hasClientId) {
    console.log('\n⚠️  COLUNAS FALTANDO NO BANCO DE DADOS REAL!');
    console.log('\nVocê PRECISA aplicar as migrações manualmente no Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql');
  }
}

checkRealSchema().catch(console.error);
