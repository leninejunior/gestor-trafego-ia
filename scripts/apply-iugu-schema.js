#!/usr/bin/env node

/**
 * Script para aplicar schema do Iugu no Supabase
 * Adiciona campos necessários para integração com Iugu
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  console.error('Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySqlFile(filePath, description) {
  console.log(`\n📄 Aplicando: ${description}`);
  
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Tentar executar diretamente se RPC não funcionar
      const { error: directError } = await supabase.from('_sql').insert({ query: sql });
      
      if (directError) {
        console.error(`❌ Erro ao aplicar ${description}:`, error.message);
        return false;
      }
    }
    
    console.log(`✅ ${description} aplicado com sucesso`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao ler arquivo ${filePath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Iniciando aplicação do schema do Iugu...\n');
  
  const migrations = [
    {
      file: path.join(__dirname, '../database/add-iugu-fields.sql'),
      description: 'Campos do Iugu nas tabelas existentes'
    },
    {
      file: path.join(__dirname, '../database/subscription-intents-schema.sql'),
      description: 'Tabela de intenções de assinatura'
    }
  ];

  let success = true;
  
  for (const migration of migrations) {
    const result = await applySqlFile(migration.file, migration.description);
    if (!result) {
      success = false;
    }
  }

  if (success) {
    console.log('\n✅ Todas as migrações foram aplicadas com sucesso!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Configure as variáveis de ambiente do Iugu no .env:');
    console.log('   - IUGU_API_TOKEN');
    console.log('   - IUGU_ACCOUNT_ID');
    console.log('   - NEXT_PUBLIC_IUGU_ACCOUNT_ID');
    console.log('2. Configure o webhook do Iugu para: https://seu-dominio.com/api/webhooks/iugu');
    console.log('3. Teste o fluxo de checkout em /checkout?plan=pro');
  } else {
    console.log('\n⚠️  Algumas migrações falharam. Verifique os erros acima.');
    console.log('Você pode executar os arquivos SQL manualmente no Supabase SQL Editor.');
  }
}

main().catch(console.error);
