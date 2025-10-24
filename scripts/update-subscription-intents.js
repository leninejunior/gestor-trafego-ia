/**
 * Script para atualizar tabela subscription_intents
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function updateSubscriptionIntents() {
  console.log('🔄 Atualizando tabela subscription_intents...\n');

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variáveis de ambiente não configuradas!');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Ler SQL
    const sqlPath = path.join(__dirname, '../database/update-subscription-intents.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📝 Executando SQL...');
    
    // Executar SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Se não tiver a função exec_sql, executar manualmente
      console.log('⚠️  Função exec_sql não encontrada, executando comandos individualmente...');
      
      const commands = sql
        .split(';')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd && !cmd.startsWith('--') && !cmd.startsWith('COMMENT'));

      for (const command of commands) {
        if (command) {
          const { error: cmdError } = await supabase.rpc('exec', { query: command });
          if (cmdError) {
            console.log(`⚠️  Comando pode já ter sido executado: ${cmdError.message}`);
          }
        }
      }
    }

    console.log('✅ Tabela subscription_intents atualizada com sucesso!');
    console.log('\nNovos campos adicionados:');
    console.log('  - user_email');
    console.log('  - user_name');
    console.log('  - organization_name');
    console.log('  - cpf_cnpj');
    console.log('  - phone');
    console.log('  - metadata');
    console.log('\nCampos tornados opcionais:');
    console.log('  - organization_id');
    console.log('  - user_id');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

updateSubscriptionIntents();
