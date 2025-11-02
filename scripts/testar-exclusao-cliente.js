const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testarExclusaoCliente() {
  try {
    console.log('🔍 Verificando clientes de teste...');
    
    // Buscar clientes de teste
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select(`
        id, 
        name, 
        org_id,
        created_at,
        organizations(id, name)
      `)
      .ilike('name', '%teste%');

    if (clientsError) {
      throw new Error(`Erro ao buscar clientes: ${clientsError.message}`);
    }

    if (!clients || clients.length === 0) {
      console.log('⚠️ Nenhum cliente de teste encontrado');
      return;
    }

    console.log(`✅ Encontrados ${clients.length} clientes de teste:`);
    console.log('');
    
    clients.forEach((client, index) => {
      console.log(`${index + 1}. ${client.name}`);
      console.log(`   ID: ${client.id}`);
      console.log(`   Organização: ${client.organizations?.name || 'N/A'}`);
      console.log(`   Criado em: ${new Date(client.created_at).toLocaleString('pt-BR')}`);
      console.log(`   URL: http://localhost:3000/dashboard/clients/${client.id}`);
      console.log('');
    });

    console.log('🎯 Para testar a exclusão:');
    console.log('1. Acesse uma das URLs acima');
    console.log('2. Verifique se as informações da organização aparecem');
    console.log('3. Clique no botão "Excluir Cliente" (vermelho)');
    console.log('4. Confirme a exclusão no dialog');
    console.log('5. Verifique se foi redirecionado para /dashboard/clients');
    console.log('6. Confirme que o cliente foi removido da lista');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testarExclusaoCliente();