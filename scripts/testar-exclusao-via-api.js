const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testarExclusaoViaAPI() {
  console.log('🧪 TESTANDO EXCLUSÃO VIA API');
  console.log('============================');
  
  // 1. Listar clientes atuais
  console.log('1. Listando clientes atuais...');
  const { data: clientes, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.log('❌ Erro ao buscar clientes:', error);
    return;
  }
  
  console.log(`📊 Total de clientes: ${clientes.length}`);
  
  if (clientes.length === 0) {
    console.log('❌ Nenhum cliente encontrado para testar');
    return;
  }
  
  // Pegar o primeiro cliente para testar
  const clienteParaTestar = clientes[0];
  console.log(`\n🎯 Cliente selecionado para teste:`);
  console.log(`   ID: ${clienteParaTestar.id}`);
  console.log(`   Nome: ${clienteParaTestar.name}`);
  console.log(`   Org ID: ${clienteParaTestar.org_id}`);
  
  // 2. Simular chamada da API DELETE
  console.log('\n2. Simulando chamada da API DELETE...');
  
  try {
    // Primeiro, vamos verificar se conseguimos buscar o usuário admin
    const { data: adminUser } = await supabase.auth.admin.listUsers();
    console.log(`👥 Usuários encontrados: ${adminUser.users.length}`);
    
    if (adminUser.users.length === 0) {
      console.log('❌ Nenhum usuário encontrado');
      return;
    }
    
    const usuario = adminUser.users[0];
    console.log(`👤 Usando usuário: ${usuario.email}`);
    
    // Verificar membership do usuário
    const { data: membership } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', usuario.id)
      .eq('status', 'active')
      .single();
      
    if (!membership) {
      console.log('❌ Usuário não tem membership ativa');
      return;
    }
    
    console.log(`🏢 Organização do usuário: ${membership.organization_id}`);
    
    // Verificar se o cliente pertence à mesma organização
    if (clienteParaTestar.org_id !== membership.organization_id) {
      console.log('❌ Cliente não pertence à organização do usuário');
      return;
    }
    
    console.log('✅ Permissões verificadas');
    
    // 3. Excluir o cliente
    console.log('\n3. Excluindo cliente...');
    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', clienteParaTestar.id);
      
    if (deleteError) {
      console.log('❌ Erro ao excluir:', deleteError);
    } else {
      console.log('✅ Cliente excluído com sucesso!');
    }
    
    // 4. Verificar se foi excluído
    console.log('\n4. Verificando exclusão...');
    const { data: clienteVerificacao } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clienteParaTestar.id)
      .single();
      
    if (clienteVerificacao) {
      console.log('❌ Cliente ainda existe no banco');
    } else {
      console.log('✅ Cliente foi excluído do banco');
    }
    
  } catch (error) {
    console.log('❌ Erro durante o teste:', error);
  }
}

testarExclusaoViaAPI().catch(console.error);