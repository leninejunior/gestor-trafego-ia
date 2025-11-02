const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function limparSistemaCompleto() {
  console.log('🧹 LIMPEZA COMPLETA DO SISTEMA');
  console.log('==============================');
  
  try {
    // 1. Listar todos os clientes atuais
    console.log('1. Listando clientes atuais...');
    const { data: clientes, error } = await supabase
      .from('clients')
      .select('*');
      
    if (error) {
      console.log('❌ Erro ao buscar clientes:', error);
      return;
    }
    
    console.log(`📊 Total de clientes: ${clientes.length}`);
    
    // 2. Excluir todos os clientes (isso vai limpar dados relacionados via CASCADE)
    console.log('\n2. Excluindo todos os clientes...');
    
    for (const cliente of clientes) {
      console.log(`🗑️ Excluindo: ${cliente.name} (${cliente.id})`);
      
      const { error: deleteError } = await supabase
        .from('clients')
        .delete()
        .eq('id', cliente.id);
        
      if (deleteError) {
        console.log(`❌ Erro ao excluir ${cliente.name}:`, deleteError);
      } else {
        console.log(`✅ ${cliente.name} excluído`);
      }
    }
    
    // 3. Verificar se todos foram excluídos
    console.log('\n3. Verificando limpeza...');
    const { data: clientesRestantes } = await supabase
      .from('clients')
      .select('*');
      
    console.log(`📊 Clientes restantes: ${clientesRestantes?.length || 0}`);
    
    // 4. Criar novos clientes de teste com IDs limpos
    console.log('\n4. Criando novos clientes de teste...');
    
    const novosClientes = [
      { name: 'Cliente Limpo A - Loja Online', org_id: '01bdaa04-1873-427f-8caa-b79bc7dd2fa2' },
      { name: 'Cliente Limpo B - Restaurante', org_id: '01bdaa04-1873-427f-8caa-b79bc7dd2fa2' },
      { name: 'Cliente Limpo C - Academia', org_id: '01bdaa04-1873-427f-8caa-b79bc7dd2fa2' }
    ];
    
    for (const novoCliente of novosClientes) {
      const { data: clienteCriado, error: createError } = await supabase
        .from('clients')
        .insert(novoCliente)
        .select()
        .single();
        
      if (createError) {
        console.log(`❌ Erro ao criar ${novoCliente.name}:`, createError);
      } else {
        console.log(`✅ Criado: ${clienteCriado.name} (${clienteCriado.id})`);
      }
    }
    
    console.log('\n🎉 LIMPEZA COMPLETA FINALIZADA!');
    console.log('📋 Próximos passos:');
    console.log('1. Limpe o cache do navegador (Ctrl+Shift+Delete)');
    console.log('2. Faça logout e login novamente');
    console.log('3. Acesse /dashboard/clients');
    console.log('4. Teste a exclusão dos novos clientes');
    
  } catch (error) {
    console.log('❌ Erro durante a limpeza:', error);
  }
}

limparSistemaCompleto().catch(console.error);