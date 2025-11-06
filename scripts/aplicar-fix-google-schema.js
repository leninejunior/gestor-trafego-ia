/**
 * Aplicar correção do schema do Google Ads
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function aplicarFixGoogleSchema() {
  console.log('🔧 Aplicando correção do schema do Google Ads...\n');
  
  try {
    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, '..', 'database', 'fix-google-ads-schema.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Executando SQL...');
    
    // Dividir em comandos individuais e executar
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.length > 10) { // Ignorar comandos muito pequenos
        try {
          console.log(`   Executando comando ${i + 1}/${commands.length}...`);
          
          // Para comandos DO, usar uma abordagem diferente
          if (command.trim().startsWith('DO $$')) {
            const { error } = await supabase.rpc('exec_sql_block', { sql_block: command });
            if (error && !error.message.includes('already exists')) {
              console.log(`   ⚠️ Aviso no comando ${i + 1}: ${error.message}`);
            }
          } else {
            // Para outros comandos, tentar executar diretamente
            const { error } = await supabase.rpc('exec_sql_simple', { sql_text: command });
            if (error && !error.message.includes('already exists')) {
              console.log(`   ⚠️ Aviso no comando ${i + 1}: ${error.message}`);
            }
          }
        } catch (error) {
          if (!error.message.includes('already exists')) {
            console.log(`   ⚠️ Erro no comando ${i + 1}: ${error.message}`);
          }
        }
      }
    }

    // Verificar se as tabelas foram criadas
    console.log('\n✅ Verificando tabelas criadas...');
    
    // Verificar google_ads_encryption_keys
    try {
      const { data: keys, error: keysError } = await supabase
        .from('google_ads_encryption_keys')
        .select('id')
        .limit(1);
      
      if (keysError) {
        console.log('❌ Tabela google_ads_encryption_keys não foi criada');
      } else {
        console.log('✅ Tabela google_ads_encryption_keys criada');
      }
    } catch (error) {
      console.log('❌ Erro ao verificar google_ads_encryption_keys');
    }

    // Verificar google_ads_audit_log
    try {
      const { data: audit, error: auditError } = await supabase
        .from('google_ads_audit_log')
        .select('id')
        .limit(1);
      
      if (auditError) {
        console.log('❌ Tabela google_ads_audit_log não foi criada');
      } else {
        console.log('✅ Tabela google_ads_audit_log criada');
      }
    } catch (error) {
      console.log('❌ Erro ao verificar google_ads_audit_log');
    }

    console.log('\n🎉 Correção do schema aplicada!');
    console.log('\n📋 Próximos passos:');
    console.log('   1. Refaça o OAuth do Google Ads');
    console.log('   2. Os tokens serão salvos corretamente');
    console.log('   3. As contas reais da MCC aparecerão');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

aplicarFixGoogleSchema();