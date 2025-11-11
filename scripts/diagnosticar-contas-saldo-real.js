require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não encontradas!');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'OK' : 'FALTANDO');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? 'OK' : 'FALTANDO');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosticar() {
  console.log('=== DIAGNÓSTICO: Contas Meta para Saldos ===\n');
  
  // 1. Verificar conexões Meta existentes
  const { data: connections, error: connError } = await supabase
    .from('client_meta_connections')
    .select('*');
  
  console.log('1. Conexões Meta no banco:');
  console.log('Total:', connections?.length || 0);
  if (connError) console.log('Erro:', connError.message);
  if (connections?.length > 0) {
    console.log('Primeira conexão:', JSON.stringify(connections[0], null, 2));
  }
  console.log('');
  
  // 2. Verificar estrutura da tabela ad_account_balances
  const { data: balances, error: balError } = await supabase
    .from('ad_account_balances')
    .select('*')
    .limit(5);
  
  console.log('2. Registros em ad_account_balances:');
  console.log('Total:', balances?.length || 0);
  if (balError) console.log('Erro:', balError.message);
  if (balances?.length > 0) {
    console.log('Primeiro registro:', JSON.stringify(balances[0], null, 2));
  }
  console.log('');
  
  // 3. Verificar se há clientes
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, name');
  
  console.log('3. Clientes no sistema:');
  console.log('Total:', clients?.length || 0);
  if (clientError) console.log('Erro:', clientError.message);
  if (clients?.length > 0) {
    console.log('Clientes:', clients.map(c => `${c.name} (${c.id})`).join(', '));
  }
  console.log('');
  
  // 4. Verificar se servidor está rodando
  console.log('4. Testando servidor Next.js...');
  try {
    const response = await fetch('http://localhost:3000/api/balance/my-accounts');
    console.log('Status:', response.status);
    const apiData = await response.json();
    console.log('Resposta:', JSON.stringify(apiData, null, 2));
  } catch (error) {
    console.log('❌ Servidor não está rodando ou API com erro:', error.message);
  }
  
  console.log('\n=== RESUMO ===');
  console.log('Conexões Meta:', connections?.length || 0);
  console.log('Saldos cadastrados:', balances?.length || 0);
  console.log('Clientes:', clients?.length || 0);
}

diagnosticar().catch(console.error);
