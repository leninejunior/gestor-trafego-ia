/**
 * Popular Saldos das Contas Meta
 * Busca saldo da API do Meta e salva no banco
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function popularSaldos() {
  console.log('💰 POPULANDO SALDOS DAS CONTAS META\n');

  // 1. Buscar todas as conexões ativas
  const { data: connections, error: connError } = await supabase
    .from('client_meta_connections')
    .select(`
      *,
      clients (
        id,
        name
      )
    `)
    .eq('status', 'active');

  if (connError) {
    console.error('❌ Erro ao buscar conexões:', connError);
    return;
  }

  if (!connections || connections.length === 0) {
    console.log('⚠️  Nenhuma conexão Meta ativa encontrada');
    return;
  }

  console.log(`✅ Encontradas ${connections.length} conexões ativas\n`);

  // 2. Para cada conexão, buscar saldo da Meta API
  for (const conn of connections) {
    console.log(`📊 Processando: ${conn.clients?.name || 'N/A'}`);
    console.log(`   Conta: ${conn.ad_account_id}`);

    try {
      // Buscar dados da Meta API
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${conn.ad_account_id}?` +
        `fields=account_status,balance,currency,spend_cap,amount_spent,name&` +
        `access_token=${conn.access_token}`
      );

      if (!response.ok) {
        console.log(`   ❌ Erro na Meta API: ${response.status}`);
        continue;
      }

      const metaData = await response.json();
      
      // Converter balance de centavos para reais
      const balance = (parseInt(metaData.balance) || 0) / 100;
      const amountSpent = (parseInt(metaData.amount_spent) || 0) / 100;
      const spendCap = metaData.spend_cap ? parseInt(metaData.spend_cap) / 100 : null;

      console.log(`   💵 Saldo: R$ ${balance.toFixed(2)}`);
      console.log(`   📈 Gasto: R$ ${amountSpent.toFixed(2)}`);

      // Calcular status baseado no saldo
      let status = 'healthy';
      if (balance < 50) {
        status = 'critical';
      } else if (balance < 200) {
        status = 'warning';
      }

      // Inserir ou atualizar no banco
      const { error: upsertError } = await supabase
        .from('ad_account_balances')
        .upsert({
          client_id: conn.clients.id,
          ad_account_id: conn.ad_account_id,
          ad_account_name: metaData.name || conn.ad_account_name || conn.ad_account_id,
          balance: balance,
          currency: metaData.currency || 'BRL',
          daily_spend: 0, // Será calculado depois
          account_spend_limit: spendCap,
          status: status,
          last_checked_at: new Date().toISOString()
        }, {
          onConflict: 'ad_account_id'
        });

      if (upsertError) {
        console.log(`   ❌ Erro ao salvar: ${upsertError.message}`);
      } else {
        console.log(`   ✅ Saldo salvo com sucesso! Status: ${status}`);
      }

    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }

    console.log('');
  }

  // 3. Verificar resultado final
  console.log('='.repeat(60));
  const { count } = await supabase
    .from('ad_account_balances')
    .select('*', { count: 'exact', head: true });

  console.log(`✅ Total de saldos registrados: ${count || 0}`);
  console.log('\n🎉 Pronto! Agora a página deve mostrar as contas.');
}

popularSaldos().catch(console.error);
