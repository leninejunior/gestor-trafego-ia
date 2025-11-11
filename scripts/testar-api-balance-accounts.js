/**
 * Testa a API de contas de saldo
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  console.log('🔍 Testando API de Contas de Saldo\n');
  
  // Simular o que a API faz
  const { data: balances, error } = await supabase
    .from('ad_account_balances')
    .select(`
      *,
      clients (
        name
      )
    `)
    .order('status', { ascending: false })
    .order('balance', { ascending: true });

  if (error) {
    console.error('❌ Erro ao buscar saldos:', error);
    return;
  }

  console.log('📊 Saldos encontrados:', balances?.length || 0);
  
  if (balances && balances.length > 0) {
    // Formatar como a API faz
    const formattedBalances = balances.map(b => ({
      // Campos esperados pela interface AdAccount
      client_id: b.client_id,
      client_name: b.clients?.name || 'Cliente Desconhecido',
      ad_account_id: b.ad_account_id,
      ad_account_name: b.ad_account_name || b.ad_account_id,
      balance: b.balance || 0,
      status: b.status || 'unknown',
      has_alert: false,
      
      // Campos adicionais
      currency: b.currency,
      daily_spend: b.daily_spend,
      account_spend_limit: b.account_spend_limit,
      last_updated: b.last_checked_at,
      projected_days_remaining: b.daily_spend > 0 ? b.balance / b.daily_spend : 999
    }));

    console.log('\n✅ Primeira conta formatada:');
    console.log(JSON.stringify(formattedBalances[0], null, 2));
    
    console.log('\n📋 Resumo:');
    formattedBalances.forEach((acc, i) => {
      console.log(`  ${i + 1}. ${acc.ad_account_name}`);
      console.log(`     Cliente: ${acc.client_name}`);
      console.log(`     Saldo: ${acc.balance} ${acc.currency}`);
      console.log(`     Status: ${acc.status}`);
    });
  } else {
    console.log('❌ Nenhum saldo encontrado');
  }
}

test().catch(console.error);
