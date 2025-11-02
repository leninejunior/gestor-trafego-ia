const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Script unificado para desenvolvimento e debug
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'check-user':
      await checkCurrentUser();
      break;
    case 'check-orgs':
      await checkOrganizations();
      break;
    case 'check-clients':
      await checkClients();
      break;
    case 'create-test-client':
      await createTestClient();
      break;
    default:
      console.log('Comandos disponíveis:');
      console.log('- check-user: Verificar usuário atual');
      console.log('- check-orgs: Verificar organizações');
      console.log('- check-clients: Verificar clientes');
      console.log('- create-test-client: Criar cliente de teste');
  }
}

async function checkCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  console.log('Usuário atual:', user?.email || 'Não logado');
}

async function checkOrganizations() {
  const { data: orgs } = await supabase.from('organizations').select('*');
  console.log('Organizações:', orgs?.length || 0);
  orgs?.forEach(org => console.log(`- ${org.name} (${org.id})`));
}

async function checkClients() {
  const { data: clients } = await supabase.from('clients').select('*');
  console.log('Clientes:', clients?.length || 0);
  clients?.forEach(client => console.log(`- ${client.name} (${client.id})`));
}

async function createTestClient() {
  const { data: orgs } = await supabase.from('organizations').select('*').limit(1);
  if (!orgs || orgs.length === 0) {
    console.log('❌ Nenhuma organização encontrada');
    return;
  }
  
  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: `Cliente Teste ${Date.now()}`,
      org_id: orgs[0].id
    })
    .select()
    .single();
    
  if (error) {
    console.error('❌ Erro:', error);
  } else {
    console.log('✅ Cliente criado:', data.name);
  }
}

main().catch(console.error);