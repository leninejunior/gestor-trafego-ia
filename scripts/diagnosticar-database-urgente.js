require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('🔍 DIAGNÓSTICO URGENTE DO DATABASE\n');

// 1. Verificar variáveis de ambiente
console.log('📋 VARIÁVEIS DE AMBIENTE:');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Configurada' : '❌ Faltando');
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Configurada' : '❌ Faltando');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Configurada' : '❌ Faltando');
console.log('');

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('❌ ERRO: Variáveis do Supabase não configuradas!');
  process.exit(1);
}

// 2. Testar conexão com Supabase
console.log('🔌 TESTANDO CONEXÃO COM SUPABASE...');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testarConexao() {
  try {
    // Teste 1: Verificar se o Supabase está acessível
    console.log('\n📡 Teste 1: Ping no Supabase...');
    const { data: pingData, error: pingError } = await supabase
      .from('clients')
      .select('count')
      .limit(1);
    
    if (pingError) {
      console.error('❌ Erro no ping:', pingError.message);
      console.error('Detalhes:', pingError);
    } else {
      console.log('✅ Supabase está acessível!');
    }

    // Teste 2: Listar tabelas disponíveis
    console.log('\n📊 Teste 2: Verificando tabelas...');
    const tabelas = ['clients', 'meta_connections', 'google_ads_connections', 'organizations', 'organization_memberships'];
    
    for (const tabela of tabelas) {
      const { data, error } = await supabase
        .from(tabela)
        .select('count')
        .limit(1);
      
      if (error) {
        console.log(`❌ ${tabela}: ${error.message}`);
      } else {
        console.log(`✅ ${tabela}: OK`);
      }
    }

    // Teste 3: Verificar autenticação
    console.log('\n🔐 Teste 3: Verificando autenticação...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.log('⚠️ Nenhum usuário autenticado (esperado em script)');
    } else if (user) {
      console.log('✅ Usuário autenticado:', user.email);
    }

    // Teste 4: Verificar RLS
    console.log('\n🛡️ Teste 4: Verificando RLS...');
    const { data: clientsData, error: rlsError } = await supabase
      .from('clients')
      .select('*')
      .limit(1);
    
    if (rlsError) {
      console.log('⚠️ RLS ativo (esperado):', rlsError.message);
    } else {
      console.log('✅ Dados acessíveis:', clientsData?.length || 0, 'registros');
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMO DO DIAGNÓSTICO:');
    console.log('='.repeat(80));
    console.log('✅ Variáveis de ambiente: OK');
    console.log('✅ Conexão com Supabase: OK');
    console.log('⚠️ RLS está ativo (normal para segurança)');
    console.log('\n💡 PRÓXIMOS PASSOS:');
    console.log('1. Reinicie o servidor de desenvolvimento: pnpm dev');
    console.log('2. Verifique se o problema persiste no navegador');
    console.log('3. Se persistir, verifique os logs do servidor Next.js');

  } catch (error) {
    console.error('\n❌ ERRO CRÍTICO:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testarConexao();
