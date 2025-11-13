const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function investigarSaldoCoan() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('🔍 Investigando saldo da conta Coan...\n');

  // 1. Buscar conexões Meta da Coan
  const { data: connections, error: connError } = await supabase
    .from('client_meta_connections')
    .select('*')
    .ilike('account_name', '%coan%');

  if (connError) {
    console.error('❌ Erro ao buscar conexões:', connError);
    return;
  }

  console.log('📊 Conexões encontradas:', connections?.length || 0);
  connections?.forEach(conn => {
    console.log(`\n  ID: ${conn.id}`);
    console.log(`  Client ID: ${conn.client_id}`);
    console.log(`  Ad Account ID: ${conn.ad_account_id}`);
    console.log(`  Nome: ${conn.account_name}`);
    console.log(`  Ativa: ${conn.is_active}`);
  });

  // 2. Buscar saldo armazenado no banco
  const { data: balances, error: balError } = await supabase
    .from('ad_account_balances')
    .select('*')
    .in('ad_account_id', connections?.map(c => c.ad_account_id) || []);

  console.log('\n💰 Saldos armazenados no banco:');
  balances?.forEach(bal => {
    console.log(`\n  Ad Account: ${bal.ad_account_id}`);
    console.log(`  Saldo: R$ ${bal.balance}`);
    console.log(`  Status: ${bal.status}`);
    console.log(`  Última atualização: ${bal.last_sync_at}`);
  });

  // 3. Buscar saldo real da API do Meta
  console.log('\n🌐 Buscando saldo real da API do Meta...');
  
  for (const conn of connections || []) {
    if (!conn.is_active || !conn.access_token) continue;

    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${conn.ad_account_id}?fields=account_id,name,account_status,balance,amount_spent,currency,funding_source_details,spend_cap&access_token=${conn.access_token}`
      );

      const data = await response.json();
      
      console.log(`\n📱 Dados da API para ${conn.ad_account_id}:`);
      console.log('  Response completo:', JSON.stringify(data, null, 2));
      
      if (data.balance) {
        const balanceInReais = parseFloat(data.balance) / 100;
        console.log(`  ✅ Saldo real: R$ ${balanceInReais.toFixed(2)}`);
      }
      
      if (data.funding_source_details) {
        console.log('  💳 Meio de pagamento:', JSON.stringify(data.funding_source_details, null, 2));
      }
      
      if (data.spend_cap) {
        const spendCapInReais = parseFloat(data.spend_cap) / 100;
        console.log(`  📊 Limite de gastos: R$ ${spendCapInReais.toFixed(2)}`);
      }
      
      if (data.amount_spent) {
        const spentInReais = parseFloat(data.amount_spent) / 100;
        console.log(`  💸 Gasto total: R$ ${spentInReais.toFixed(2)}`);
      }

    } catch (error) {
      console.error(`  ❌ Erro ao buscar da API:`, error.message);
    }
  }

  console.log('\n✅ Investigação concluída!');
}

investigarSaldoCoan().catch(console.error);
