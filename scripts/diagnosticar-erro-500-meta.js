require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function diagnosticar() {
  console.log('🔍 DIAGNÓSTICO COMPLETO DO ERRO 500\n');
  console.log('='.repeat(50));
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('\n1️⃣ VARIÁVEIS DE AMBIENTE:');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅' : '❌');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('\n❌ Variáveis faltando!');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  console.log('\n2️⃣ VERIFICANDO TABELA:');
  const { data: tableData, error: tableError } = await supabase
    .from('client_meta_connections')
    .select('*')
    .limit(1);
  
  if (tableError) {
    console.log('❌ Tabela não existe:', tableError.message);
    return;
  }
  console.log('✅ Tabela existe');
  
  console.log('\n3️⃣ VERIFICANDO CLIENTE:');
  const clientId = 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751';
  const { data: clientData, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();
  
  if (clientError) {
    console.log('❌ Cliente não encontrado:', clientError.message);
    console.log('\n🔧 SOLUÇÃO: Você precisa criar o cliente primeiro!');
    console.log('Execute: node scripts/criar-cliente-urgente.js');
    return;
  }
  console.log('✅ Cliente existe:', clientData.name);
  
  console.log('\n4️⃣ TESTANDO INSERÇÃO:');
  const testConnection = {
    client_id: clientId,
    ad_account_id: 'act_test_' + Date.now(),
    ad_account_name: 'Teste',
    access_token: 'test_token',
    status: 'active'
  };
  
  const { data: insertData, error: insertError } = await supabase
    .from('client_meta_connections')
    .insert(testConnection)
    .select();
  
  if (insertError) {
    console.log('❌ Erro ao inserir:', insertError.message);
    console.log('Detalhes:', insertError);
    return;
  }
  console.log('✅ Inserção funcionou!');
  
  // Limpar teste
  await supabase
    .from('client_meta_connections')
    .delete()
    .eq('ad_account_id', testConnection.ad_account_id);
  
  console.log('\n5️⃣ VERIFICANDO RLS (Row Level Security):');
  const { data: rlsData, error: rlsError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT tablename, policyname, permissive, roles, cmd, qual 
        FROM pg_policies 
        WHERE tablename = 'client_meta_connections'
      `
    });
  
  if (rlsError) {
    console.log('⚠️  Não foi possível verificar RLS');
  } else {
    console.log('Políticas RLS:', rlsData?.length || 0);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ DIAGNÓSTICO COMPLETO!');
  console.log('\nSe tudo está OK acima, o erro 500 pode ser:');
  console.log('1. Problema de autenticação no navegador');
  console.log('2. Token Meta inválido');
  console.log('3. Dados malformados no frontend');
  console.log('\nVerifique os logs do servidor Next.js para mais detalhes.');
}

diagnosticar().catch(console.error);
