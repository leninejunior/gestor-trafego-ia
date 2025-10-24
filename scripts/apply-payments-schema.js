#!/usr/bin/env node

/**
 * Script para aplicar o schema de pagamentos no Supabase
 * 
 * Uso:
 * node scripts/apply-payments-schema.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente do Supabase não encontradas');
  console.error('Certifique-se de que NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidas no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyPaymentsSchema() {
  try {
    console.log('🚀 Iniciando aplicação do schema de pagamentos...');
    
    // Ler o arquivo SQL
    const schemaPath = path.join(__dirname, '..', 'database', 'payments-schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Schema carregado, aplicando no Supabase...');
    
    // Executar o SQL
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: schemaSql 
    });
    
    if (error) {
      // Se a função exec_sql não existir, tentar executar diretamente
      if (error.message.includes('function exec_sql')) {
        console.log('⚠️  Função exec_sql não encontrada, executando SQL diretamente...');
        
        // Dividir o SQL em comandos individuais
        const commands = schemaSql
          .split(';')
          .map(cmd => cmd.trim())
          .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
        
        console.log(`📝 Executando ${commands.length} comandos SQL...`);
        
        for (let i = 0; i < commands.length; i++) {
          const command = commands[i];
          if (command) {
            try {
              const { error: cmdError } = await supabase
                .from('_temp_sql_execution')
                .select('*')
                .limit(0); // Isso vai falhar, mas nos dá acesso ao cliente SQL
              
              // Como não podemos executar SQL arbitrário diretamente,
              // vamos mostrar as instruções para o usuário
              console.log(`⚠️  Não é possível executar SQL diretamente via API.`);
              console.log(`📋 Por favor, execute o seguinte SQL no SQL Editor do Supabase:`);
              console.log(`\n${schemaSql}\n`);
              return;
              
            } catch (cmdError) {
              // Ignorar erros esperados
            }
          }
        }
      } else {
        throw error;
      }
    }
    
    console.log('✅ Schema de pagamentos aplicado com sucesso!');
    console.log('\n📊 Tabelas criadas:');
    console.log('  - payment_providers (Provedores de pagamento)');
    console.log('  - payment_transactions (Transações)');
    console.log('  - payment_subscriptions (Assinaturas)');
    console.log('  - payment_webhooks (Webhooks)');
    console.log('  - payment_audit_logs (Auditoria)');
    
    console.log('\n🔒 Políticas RLS aplicadas para isolamento de dados por organização');
    console.log('\n🎉 Sistema de pagamentos pronto para uso!');
    
  } catch (error) {
    console.error('❌ Erro ao aplicar schema:', error.message);
    
    if (error.message.includes('permission denied') || error.message.includes('insufficient_privilege')) {
      console.log('\n💡 Solução:');
      console.log('1. Abra o SQL Editor no painel do Supabase');
      console.log('2. Cole e execute o conteúdo do arquivo database/payments-schema.sql');
      console.log('3. Ou use a service role key com permissões adequadas');
    }
    
    process.exit(1);
  }
}

// Verificar se as tabelas já existem
async function checkExistingTables() {
  try {
    const { data, error } = await supabase
      .from('payment_providers')
      .select('id')
      .limit(1);
    
    if (!error) {
      console.log('⚠️  Tabelas de pagamento já existem!');
      console.log('Deseja continuar mesmo assim? (y/N)');
      
      // Em ambiente de script, vamos continuar
      return true;
    }
    
    return true;
  } catch (error) {
    return true; // Tabelas não existem, pode continuar
  }
}

// Executar o script
async function main() {
  console.log('💳 Configurador do Sistema de Pagamentos');
  console.log('=====================================\n');
  
  const canContinue = await checkExistingTables();
  if (canContinue) {
    await applyPaymentsSchema();
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { applyPaymentsSchema };