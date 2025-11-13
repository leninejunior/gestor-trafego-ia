/**
 * Script para diagnosticar e corrigir o problema do saldo mockado
 * Verifica toda a cadeia: conexões Meta -> sincronização -> exibição
 */

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosticar() {
  console.log('🔍 DIAGNÓSTICO COMPLETO DO SISTEMA DE SALDO\n');
  console.log('='.repeat(60));

  // 1. Verificar conexões Meta ativas
  console.log('\n📊 PASSO 1: Verificando conexões Meta ativas...');
  const { data: connections, error: connError } = await supabase
    .from('client_meta_connections')
    .select('*')
    .eq('is_active', true);

  if (connError) {
    console.error('❌ Erro ao buscar conexões:', connError);
    return;
  }

  console.log(`✅ Encontradas ${connections?.length || 0} conexões ativas`);
  
  if (connections && connections.length > 0) {
    connections.forEach((conn, i) => {
      console.log(`\n   Conexão ${i + 1}:`);
      console.log(`   - ID: ${conn.id}`);
      console.log(`   - Cliente: ${conn.client_id}`);
      console.log(`   - Conta: ${conn.ad_account_id}`);
      console.log(`   - Nome: ${conn.account_name || 'N/A'}`);
      console.log(`   - Token: ${conn.access_token ? 'Presente' : 'AUSENTE'}`);
    });
  }

  // 2. Verificar tabela ad_account_balances
  console.log('\n\n📊 PASSO 2: Verificando tabela ad_account_balances...');
  const { data: balances, error: balError } = await supabase
    .from('ad_account_balances')
    .select('*');

  if (balError) {
    console.error('❌ Erro ao buscar saldos:', balError);
  } else {
    console.log(`✅ Encontrados ${balances?.length || 0} registros de saldo`);
    
    if (balances && balances.length > 0) {
      balances.forEach((bal, i) => {
        console.log(`\n   Saldo ${i + 1}:`);
        console.log(`   - Conta: ${bal.ad_account_id}`);
        console.log(`   - Nome: ${bal.ad_account_name || 'N/A'}`);
        console.log(`   - Saldo: ${bal.balance} ${bal.currency}`);
        console.log(`   - Status: ${bal.status}`);
        console.log(`   - Última verificação: ${bal.last_checked_at}`);
      });
    } else {
      console.log('   ⚠️  Tabela está VAZIA - Este é o problema!');
    }
  }

  // 3. Testar API de sincronização
  console.log('\n\n📊 PASSO 3: Testando API de sincronização...');
  console.log('   Fazendo requisição para /api/balance/sync...');
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/balance/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Resposta:`, JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log('   ✅ API de sincronização funcionando');
    } else {
      console.log('   ❌ API de sincronização com erro');
    }
  } catch (error) {
    console.log('   ❌ Erro ao chamar API:', error.message);
  }

  // 4. Verificar novamente a tabela após sincronização
  console.log('\n\n📊 PASSO 4: Verificando tabela após sincronização...');
  const { data: balancesAfter, error: balAfterError } = await supabase
    .from('ad_account_balances')
    .select('*');

  if (balAfterError) {
    console.error('❌ Erro ao buscar saldos:', balAfterError);
  } else {
    console.log(`✅ Agora temos ${balancesAfter?.length || 0} registros de saldo`);
    
    if (balancesAfter && balancesAfter.length > 0) {
      console.log('\n   ✅ SUCESSO! Dados reais foram sincronizados:');
      balancesAfter.forEach((bal, i) => {
        console.log(`\n   Conta ${i + 1}:`);
        console.log(`   - ${bal.ad_account_name || bal.ad_account_id}`);
        console.log(`   - Saldo: ${bal.balance} ${bal.currency}`);
        console.log(`   - Status: ${bal.status}`);
      });
    } else {
      console.log('   ❌ Ainda sem dados - problema na sincronização');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📋 RESUMO DO DIAGNÓSTICO:');
  console.log(`   - Conexões Meta: ${connections?.length || 0}`);
  console.log(`   - Saldos antes: ${balances?.length || 0}`);
  console.log(`   - Saldos depois: ${balancesAfter?.length || 0}`);
  
  if ((balancesAfter?.length || 0) > 0) {
    console.log('\n✅ PROBLEMA RESOLVIDO! Recarregue a página do navegador.');
  } else {
    console.log('\n❌ PROBLEMA PERSISTE. Verifique:');
    console.log('   1. Tokens de acesso válidos nas conexões Meta');
    console.log('   2. Permissões da API do Meta');
    console.log('   3. Logs da API /api/balance/sync');
  }
}

diagnosticar().catch(console.error);
