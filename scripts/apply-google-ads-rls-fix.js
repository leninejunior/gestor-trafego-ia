const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente
require('dotenv').config();

console.log('🔧 Aplicando correção RLS para Google Ads...\n');

async function applyRLSFix() {
  try {
    // Criar cliente Supabase com service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('📖 Lendo arquivo SQL...');
    const sqlPath = path.join(__dirname, '..', 'database', 'fix-google-ads-rls.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('🗃️ Executando correção RLS...');
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: sqlContent 
    });

    if (error) {
      console.error('❌ Erro ao executar SQL:', error);
      
      // Tentar método alternativo
      console.log('🔄 Tentando método alternativo...');
      
      // Executar comandos individualmente
      const commands = [
        `DROP POLICY IF EXISTS "Users can only access their client's Google connections" ON google_ads_connections;`,
        `CREATE POLICY "Authenticated users can access Google connections" ON google_ads_connections FOR ALL USING (auth.uid() IS NOT NULL);`
      ];

      for (const command of commands) {
        console.log('📝 Executando:', command.substring(0, 50) + '...');
        const { error: cmdError } = await supabase.rpc('exec_sql', { 
          sql_query: command 
        });
        
        if (cmdError) {
          console.error('❌ Erro no comando:', cmdError);
        } else {
          console.log('✅ Comando executado com sucesso');
        }
      }
    } else {
      console.log('✅ Correção RLS aplicada com sucesso!');
      console.log('📊 Resultado:', data);
    }

    // Verificar políticas atuais
    console.log('\n🔍 Verificando políticas atuais...');
    const { data: policies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'google_ads_connections');

    if (policiesError) {
      console.log('⚠️ Não foi possível verificar políticas:', policiesError.message);
    } else {
      console.log('📋 Políticas atuais:');
      policies.forEach(policy => {
        console.log(`   - ${policy.policyname}: ${policy.cmd}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

async function testConnection() {
  console.log('\n🧪 Testando conexão com Supabase...');
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('google_ads_connections')
      .select('count(*)')
      .limit(1);

    if (error) {
      console.log('❌ Erro ao acessar tabela:', error.message);
    } else {
      console.log('✅ Tabela google_ads_connections acessível');
    }
  } catch (error) {
    console.error('❌ Erro de conexão:', error.message);
  }
}

async function main() {
  console.log('🎯 OBJETIVO: Corrigir RLS da tabela google_ads_connections');
  console.log('   para alinhar com as APIs Google Auth simplificadas\n');

  await testConnection();
  await applyRLSFix();

  console.log('\n📋 PRÓXIMOS PASSOS:');
  console.log('1. Teste novamente a conexão Google Ads no navegador');
  console.log('2. Deve resolver o erro "Erro ao criar conexão"');
  console.log('3. Se ainda falhar, verifique logs do servidor');
}

main().catch(console.error);