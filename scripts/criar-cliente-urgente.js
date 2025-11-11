const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function criarCliente() {
  const clientId = 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751';
  
  console.log('🔍 Verificando se cliente existe...');
  
  const { data: existing } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();
  
  if (existing) {
    console.log('✅ Cliente já existe:', existing);
    return;
  }
  
  console.log('📝 Criando cliente...');
  
  // Buscar primeira organização
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .limit(1);
  
  if (!orgs || orgs.length === 0) {
    console.error('❌ Nenhuma organização encontrada');
    return;
  }
  
  const { data, error } = await supabase
    .from('clients')
    .insert({
      id: clientId,
      name: 'Cliente Meta Ads',
      org_id: orgs[0].id
    })
    .select()
    .single();
  
  if (error) {
    console.error('❌ Erro:', error);
  } else {
    console.log('✅ Cliente criado:', data);
  }
}

criarCliente();
