/**
 * Script para verificar e criar cliente para teste Meta
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function verificarECriarCliente() {
  console.log('🔍 Verificando cliente...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  const clientId = 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751';

  // Verificar se o cliente existe
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (client) {
    console.log('✅ Cliente encontrado:');
    console.log('   ID:', client.id);
    console.log('   Nome:', client.name);
    console.log('   Org ID:', client.org_id);
    return;
  }

  console.log('⚠️ Cliente não encontrado. Vamos buscar uma organização...\n');

  // Buscar primeira organização disponível
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .limit(1);

  if (!orgs || orgs.length === 0) {
    console.error('❌ Nenhuma organização encontrada!');
    return;
  }

  const org = orgs[0];
  console.log('📋 Organização encontrada:', org.name);

  // Criar o cliente
  console.log('\n🔨 Criando cliente...');
  const { data: newClient, error: createError } = await supabase
    .from('clients')
    .insert({
      id: clientId,
      name: 'Cliente Meta Teste',
      org_id: org.id,
      status: 'active'
    })
    .select()
    .single();

  if (createError) {
    console.error('❌ Erro ao criar cliente:', createError);
    return;
  }

  console.log('✅ Cliente criado com sucesso!');
  console.log('   ID:', newClient.id);
  console.log('   Nome:', newClient.name);
  console.log('   Org ID:', newClient.org_id);
}

verificarECriarCliente().catch(console.error);
