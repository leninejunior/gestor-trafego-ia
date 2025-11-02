#!/usr/bin/env node

/**
 * Script para executar as migrações do sistema de checkout no Supabase
 * Executa os 5 arquivos SQL na ordem correta e com verificações de segurança
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente do Supabase não encontradas');
  console.error('Certifique-se de que NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidas no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Lista dos arquivos de migração na ordem correta
const migrationFiles = [
  'checkout-migration-step-1-core-tables.sql',
  'checkout-migration-step-2-indexes.sql', 
  'checkout-migration-step-3-triggers.sql',
  'checkout-migration-step-4-functions.sql',
  'checkout-migration-step-5-rls-policies.sql',
  'checkout-migration-step-6-fix-rls-policies.sql'
];

const migrationDescriptions = [
  '📋 Passo 1: Criando tabelas principais (subscription_intents, webhook_logs, etc.)',
  '⚡ Passo 2: Criando índices para performance',
  '🔄 Passo 3: Configurando triggers de auditoria e validação',
  '⚙️  Passo 4: Instalando funções do sistema',
  '🔒 Passo 5: Aplicando políticas de segurança (RLS)',
  '🔧 Passo 6: Corrigindo políticas RLS para segurança adequada'
];

async function readSqlFile(filename) {
  const filePath = path.join(__dirname, '..', 'database', filename);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }
  
  return fs.readFileSync(filePath, 'utf8');
}

async function executeSql(sql, description) {
  console.log(`\n${description}`);
  console.log('⏳ Executando...');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro:', error.message);
    return false;
  }
}

async function checkTablesExist() {
  console.log('\n🔍 Verificando se as tabelas já existem...');
  
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .in('table_name', ['subscription_intents', 'subscription_intent_transitions', 'webhook_logs', 'payment_analytics']);
  
  if (error) {
    console.log('⚠️  Não foi possível verificar tabelas existentes, continuando...');
    return false;
  }
  
  if (data && data.length > 0) {
    console.log('⚠️  Algumas tabelas do checkout já existem:');
    data.forEach(table => console.log(`   - ${table.table_name}`));
    return true;
  }
  
  console.log('✅ Nenhuma tabela do checkout encontrada, prosseguindo com a migração');
  return false;
}

async function main() {
  console.log('🚀 EXECUTANDO MIGRAÇÕES DO SISTEMA DE CHECKOUT');
  console.log('='.repeat(50));
  
  // Verificar conexão com Supabase
  console.log('\n🔗 Testando conexão com Supabase...');
  try {
    const { data, error } = await supabase.from('information_schema.tables').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Conexão estabelecida com sucesso!');
  } catch (error) {
    console.error('❌ Erro de conexão:', error.message);
    process.exit(1);
  }
  
  // Verificar se tabelas já existem
  const tablesExist = await checkTablesExist();
  
  if (tablesExist) {
    console.log('\n⚠️  ATENÇÃO: Algumas tabelas do checkout já existem no banco.');
    console.log('Deseja continuar mesmo assim? Isso pode causar erros se as tabelas já estiverem criadas.');
    console.log('Pressione Ctrl+C para cancelar ou Enter para continuar...');
    
    // Aguardar input do usuário
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
  }
  
  console.log('\n📁 Executando migrações na ordem correta...');
  
  let successCount = 0;
  
  // Executar cada arquivo de migração
  for (let i = 0; i < migrationFiles.length; i++) {
    const filename = migrationFiles[i];
    const description = migrationDescriptions[i];
    
    try {
      const sql = await readSqlFile(filename);
      const success = await executeSql(sql, description);
      
      if (success) {
        successCount++;
      } else {
        console.log(`\n❌ Falha na execução do ${filename}`);
        console.log('🛑 Interrompendo execução para evitar inconsistências');
        break;
      }
      
      // Pequena pausa entre execuções
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`\n❌ Erro ao processar ${filename}:`, error.message);
      break;
    }
  }
  
  // Resumo final
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMO DA EXECUÇÃO');
  console.log('='.repeat(50));
  
  if (successCount === migrationFiles.length) {
    console.log('🎉 SUCESSO! Todas as migrações foram executadas com sucesso!');
    console.log('\n✅ Sistema de checkout configurado e pronto para uso');
    console.log('\n📋 Próximos passos:');
    console.log('   1. Verificar se todas as tabelas foram criadas corretamente');
    console.log('   2. Testar as APIs de checkout');
    console.log('   3. Configurar as variáveis de ambiente do IUGU');
  } else {
    console.log(`⚠️  Execução parcial: ${successCount}/${migrationFiles.length} migrações executadas`);
    console.log('\n🔧 Recomendações:');
    console.log('   1. Verificar os erros acima');
    console.log('   2. Corrigir problemas no banco de dados');
    console.log('   3. Executar novamente o script');
  }
  
  console.log('\n🏁 Execução finalizada');
}

// Executar o script
main().catch(error => {
  console.error('\n💥 Erro fatal:', error.message);
  process.exit(1);
});