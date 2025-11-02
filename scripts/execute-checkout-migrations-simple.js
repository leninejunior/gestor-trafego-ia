#!/usr/bin/env node

/**
 * Script simplificado para executar as migrações do sistema de checkout
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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Lista dos arquivos de migração na ordem correta
const migrationFiles = [
  'checkout-migration-step-1-core-tables.sql',
  'checkout-migration-step-2-indexes.sql', 
  'checkout-migration-step-3-triggers.sql',
  'checkout-migration-step-4-functions.sql',
  'checkout-migration-step-5-rls-policies.sql'
];

const migrationDescriptions = [
  '📋 Passo 1: Criando tabelas principais',
  '⚡ Passo 2: Criando índices para performance',
  '🔄 Passo 3: Configurando triggers',
  '⚙️  Passo 4: Instalando funções',
  '🔒 Passo 5: Aplicando políticas RLS'
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
    // Dividir o SQL em comandos individuais
    const commands = sql.split(';').filter(cmd => cmd.trim().length > 0);
    
    for (const command of commands) {
      if (command.trim()) {
        const { error } = await supabase.rpc('exec_sql', { 
          sql_query: command.trim() + ';' 
        });
        
        if (error) {
          console.error('Erro no comando:', command.substring(0, 100) + '...');
          throw error;
        }
      }
    }
    
    console.log('✅ Sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 EXECUTANDO MIGRAÇÕES DO SISTEMA DE CHECKOUT');
  console.log('='.repeat(50));
  
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
        break;
      }
      
      // Pausa entre execuções
      await new Promise(resolve => setTimeout(resolve, 2000));
      
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
    console.log('🎉 SUCESSO! Todas as migrações foram executadas!');
    console.log('\n✅ Sistema de checkout configurado e pronto para uso');
  } else {
    console.log(`⚠️  Execução parcial: ${successCount}/${migrationFiles.length} migrações executadas`);
  }
  
  console.log('\n🏁 Execução finalizada');
}

// Executar o script
main().catch(error => {
  console.error('\n💥 Erro fatal:', error.message);
  process.exit(1);
});