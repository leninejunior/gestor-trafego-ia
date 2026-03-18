require('dotenv').config({ path: '.env' });

async function forceSchemaReload() {
  console.log('🔄 Forçando reload do schema do Supabase\n');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceKey) {
    console.log('❌ Variáveis de ambiente não configuradas');
    return;
  }
  
  console.log('📋 Projeto:', supabaseUrl.split('//')[1].split('.')[0]);
  console.log('\n');
  
  // PostgREST recarrega o schema automaticamente, mas podemos forçar
  // fazendo uma requisição especial
  
  console.log('💡 SOLUÇÃO: O PostgREST do Supabase tem cache de schema.\n');
  console.log('Para forçar reload do schema, você tem 3 opções:\n');
  console.log('1️⃣  REINICIAR O PROJETO NO SUPABASE DASHBOARD');
  console.log('   - Vá em Settings > General');
  console.log('   - Clique em "Pause project"');
  console.log('   - Aguarde pausar');
  console.log('   - Clique em "Resume project"');
  console.log('   - Aguarde 2-3 minutos\n');
  
  console.log('2️⃣  AGUARDAR O CACHE EXPIRAR (pode levar até 10 minutos)\n');
  
  console.log('3️⃣  USAR SQL PARA NOTIFICAR O POSTGREST');
  console.log('   Execute este SQL no Supabase SQL Editor:\n');
  console.log('   ```sql');
  console.log('   NOTIFY pgrst, \'reload schema\';');
  console.log('   ```\n');
  
  console.log('🔗 Link para Settings:');
  const projectRef = supabaseUrl.split('//')[1].split('.')[0];
  console.log(`https://supabase.com/dashboard/project/${projectRef}/settings/general\n`);
  
  console.log('🔗 Link para SQL Editor:');
  console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new\n`);
  
  console.log('⚠️  RECOMENDAÇÃO: Use a opção 3 (NOTIFY) - é a mais rápida!\n');
}

forceSchemaReload().catch(console.error);
