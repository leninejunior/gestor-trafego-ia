const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyAdminFunctions() {
  try {
    console.log('🔧 Aplicando funções administrativas...');
    
    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, '..', 'database', 'admin-functions.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Dividir em comandos individuais
    const commands = sqlContent
      .split(/;\s*\n/)
      .filter(cmd => cmd.trim().length > 0)
      .map(cmd => cmd.trim() + ';');
    
    console.log(`📝 Executando ${commands.length} comandos SQL...`);
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.trim() === ';') continue;
      
      console.log(`⚡ Executando comando ${i + 1}/${commands.length}...`);
      
      const { error } = await supabase.rpc('exec_sql', { 
        sql_query: command 
      });
      
      if (error) {
        console.error(`❌ Erro no comando ${i + 1}:`, error.message);
        // Continuar com os próximos comandos
      } else {
        console.log(`✅ Comando ${i + 1} executado com sucesso`);
      }
    }
    
    console.log('🎉 Funções administrativas aplicadas com sucesso!');
    
    // Testar as funções
    console.log('\n🧪 Testando funções...');
    
    const { data: metrics, error: metricsError } = await supabase.rpc('get_system_metrics');
    if (metricsError) {
      console.error('❌ Erro ao testar get_system_metrics:', metricsError.message);
    } else {
      console.log('✅ get_system_metrics funcionando:', metrics);
    }
    
    const { data: activity, error: activityError } = await supabase.rpc('get_recent_system_activity');
    if (activityError) {
      console.error('❌ Erro ao testar get_recent_system_activity:', activityError.message);
    } else {
      console.log('✅ get_recent_system_activity funcionando:', activity?.length || 0, 'registros');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    process.exit(1);
  }
}

// Executar
applyAdminFunctions();