/**
 * Testar sincronização diretamente sem passar pela API
 */

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testarSync() {
  console.log('🔄 Testando sincronização direta...\n');

  // 1. Buscar conexões
  console.log('📊 Buscando conexões Meta...');
  const { data: connections, error: connError } = await supabase
    .from('client_meta_connections')
    .select('*')
    .eq('is_active', true);

  if (connError) {
    console.error('❌ Erro ao buscar conexões:', connError);
    return;
  }

  console.log(`✅ Encontradas ${connections?.length || 0} conexões\n`);

  if (!connections || connections.length === 0) {
    console.log('⚠️  Nenhuma conexão encontrada');
    return;
  }

  // 2. Para cada conexão, buscar saldo real
  for (const conn of connections) {
    console.log(`\n📊 Processando: ${conn.account_name || conn.ad_account_id}`);
    console.log(`   Cliente ID: ${conn.client_id}`);
    console.log(`   Conta: ${conn.ad_account_id}`);
    console.log(`   Token: ${conn.access_token ? 'Presente' : 'AUSENTE'}`);

    if (!conn.access_token) {
      console.log('   ❌ Token ausente, pulando...');
      continue;
    }

    try {
      // Buscar saldo real do Meta (SEM daily_spend_limit que não existe)
      const url = `https://graph.facebook.com/v18.0/${conn.ad_account_id}?fields=name,currency,balance,amount_spent,spend_cap&access_token=${conn.access_token}`;
      
      console.log('   🌐 Chamando API do Meta...');
      const response = await fetch(url);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('   ❌ Erro da API Meta:', error);
        continue;
      }

      const data = await response.json();
      console.log('   ✅ Dados recebidos do Meta:');
      console.log(`      Nome: ${data.name}`);
      console.log(`      Moeda: ${data.currency}`);
      console.log(`      Saldo (centavos): ${data.balance}`);
      console.log(`      Saldo (reais): ${parseFloat(data.balance || '0') / 100}`);

      // Converter valores
      const balance = parseFloat(data.balance || '0') / 100;
      const spendCap = parseFloat(data.spend_cap || '0') / 100;

      // Determinar status
      let status = 'healthy';
      if (balance <= 0) {
        status = 'critical';
      } else if (spendCap > 0) {
        const percentage = (balance / spendCap) * 100;
        if (percentage < 20) {
          status = 'critical';
        } else if (percentage < 40) {
          status = 'warning';
        }
      }

      // Salvar no banco - deletar e inserir
      console.log('   💾 Salvando no banco...');
      
      // Primeiro deletar se existir
      await supabase
        .from('ad_account_balances')
        .delete()
        .eq('client_id', conn.client_id)
        .eq('ad_account_id', conn.ad_account_id);
      
      // Depois inserir
      const { error: insertError } = await supabase
        .from('ad_account_balances')
        .insert({
          client_id: conn.client_id,
          ad_account_id: conn.ad_account_id,
          ad_account_name: data.name,
          balance: balance,
          currency: data.currency || 'BRL',
          status: status
        });

      if (insertError) {
        console.error('   ❌ Erro ao salvar:', insertError);
      } else {
        console.log(`   ✅ Salvo com sucesso! Saldo: ${data.currency} ${balance} - Status: ${status}`);
      }

    } catch (error) {
      console.error('   ❌ Erro:', error.message);
    }
  }

  // 3. Verificar resultado final
  console.log('\n\n📊 Verificando resultado final...');
  const { data: balances, error: balError } = await supabase
    .from('ad_account_balances')
    .select('*');

  if (balError) {
    console.error('❌ Erro ao buscar saldos:', balError);
  } else {
    console.log(`✅ Total de ${balances?.length || 0} saldos na tabela:`);
    balances?.forEach((bal, i) => {
      console.log(`\n   ${i + 1}. ${bal.ad_account_name || bal.ad_account_id}`);
      console.log(`      Saldo: ${bal.currency} ${bal.balance}`);
      console.log(`      Status: ${bal.status}`);
      console.log(`      Atualizado: ${bal.last_updated}`);
    });
  }

  console.log('\n✅ Sincronização concluída! Recarregue a página do navegador.');
}

testarSync().catch(console.error);
