const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigarIdsClientes() {
  console.log('🔍 INVESTIGANDO IDs DOS CLIENTES');
  console.log('================================');
  
  // Listar todos os clientes
  const { data: clientes, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.log('❌ Erro ao buscar clientes:', error);
    return;
  }
  
  console.log(`📊 Total de clientes: ${clientes.length}`);
  console.log('');
  
  clientes.forEach((cliente, index) => {
    console.log(`Cliente ${index + 1}:`);
    console.log(`  ID: ${cliente.id}`);
    console.log(`  Tipo do ID: ${typeof cliente.id}`);
    console.log(`  Tamanho do ID: ${cliente.id.length}`);
    console.log(`  Nome: ${cliente.name}`);
    console.log(`  É UUID válido: ${isValidUUID(cliente.id)}`);
    console.log('  ---');
  });
  
  // Verificar se há IDs duplicados
  const ids = clientes.map(c => c.id);
  const idsUnicos = [...new Set(ids)];
  
  if (ids.length !== idsUnicos.length) {
    console.log('⚠️ ATENÇÃO: Há IDs duplicados!');
  } else {
    console.log('✅ Todos os IDs são únicos');
  }
}

function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

investigarIdsClientes().catch(console.error);