const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function criarClientesTeste() {
  try {
    console.log('🔍 Buscando organizações existentes...');
    
    // Buscar a primeira organização disponível
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(1);

    if (orgError) {
      throw new Error(`Erro ao buscar organizações: ${orgError.message}`);
    }

    if (!organizations || organizations.length === 0) {
      throw new Error('Nenhuma organização encontrada');
    }

    const orgId = organizations[0].id;
    console.log(`✅ Usando organização: ${organizations[0].name} (${orgId})`);

    // Criar 3 clientes de teste
    const clientesTeste = [
      {
        name: 'Cliente Teste A - Loja de Roupas',
        org_id: orgId,
        created_at: new Date().toISOString()
      },
      {
        name: 'Cliente Teste B - Restaurante',
        org_id: orgId,
        created_at: new Date().toISOString()
      },
      {
        name: 'Cliente Teste C - Academia',
        org_id: orgId,
        created_at: new Date().toISOString()
      }
    ];

    console.log('📝 Criando clientes de teste...');
    
    const { data: clientesCriados, error: clientError } = await supabase
      .from('clients')
      .insert(clientesTeste)
      .select();

    if (clientError) {
      throw new Error(`Erro ao criar clientes: ${clientError.message}`);
    }

    console.log('🎉 Clientes de teste criados com sucesso!');
    console.log('');
    
    clientesCriados.forEach((cliente, index) => {
      console.log(`${index + 1}. ${cliente.name}`);
      console.log(`   ID: ${cliente.id}`);
      console.log(`   Criado em: ${new Date(cliente.created_at).toLocaleString('pt-BR')}`);
      console.log('');
    });

    console.log('✅ Agora você pode testar a exclusão em /dashboard/clients');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

criarClientesTeste();