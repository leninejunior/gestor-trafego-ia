const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testarSyncComPagamento() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('🔄 Testando sincronização com informações de pagamento...\n');

  // 1. Aplicar schema (se necessário)
  console.log('📊 Verificando estrutura da tabela...');
  const { data: sample, error: sampleError } = await supabase
    .from('ad_account_balances')
    .select('*')
    .limit(1);

  if (sample && sample[0]) {
    const columns = Object.keys(sample[0]);
    console.log('Colunas atuais:', columns);
    
    const hasNewColumns = columns.includes('funding_source_type') && 
                          columns.includes('funding_source_display') &&
                          columns.includes('spend_cap') &&
                          columns.includes('amount_spent');
    
    if (!hasNewColumns) {
      console.log('\n⚠️ Colunas novas não encontradas!');
      console.log('📝 Execute no SQL Editor do Supabase:');
      console.log(`
ALTER TABLE ad_account_balances 
ADD COLUMN IF NOT EXISTS funding_source_type INTEGER,
ADD COLUMN IF NOT EXISTS funding_source_display TEXT,
ADD COLUMN IF NOT EXISTS spend_cap DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS amount_spent DECIMAL(15, 2);
      `);
      return;
    }
    
    console.log('✅ Todas as colunas necessárias estão presentes!\n');
  }

  // 2. Chamar API de sincronização
  console.log('🔄 Chamando API de sincronização...');
  
  try {
    const response = await fetch('http://localhost:3000/api/balance/sync', {
      method: 'POST'
    });

    const result = await response.json();
    console.log('\n📊 Resultado da sincronização:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Erro ao chamar API:', error.message);
    console.log('\n⚠️ Certifique-se de que o servidor está rodando: pnpm dev');
    return;
  }

  // 3. Verificar dados salvos
  console.log('\n💾 Verificando dados salvos...');
  
  const { data: balances, error: balError } = await supabase
    .from('ad_account_balances')
    .select('*')
    .order('balance', { ascending: false });

  if (balError) {
    console.error('❌ Erro ao buscar saldos:', balError);
    return;
  }

  console.log(`\n📊 ${balances?.length || 0} contas encontradas:\n`);
  
  balances?.forEach(bal => {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📱 ${bal.ad_account_name || bal.ad_account_id}`);
    console.log(`   Saldo: R$ ${bal.balance}`);
    console.log(`   Status: ${bal.status}`);
    
    if (bal.spend_cap) {
      console.log(`   💰 Limite de gastos: R$ ${bal.spend_cap}`);
    }
    
    if (bal.amount_spent) {
      console.log(`   💸 Total gasto: R$ ${bal.amount_spent}`);
    }
    
    if (bal.funding_source_display) {
      console.log(`   💳 Meio de pagamento: ${bal.funding_source_display}`);
    }
    
    if (bal.funding_source_type) {
      console.log(`   🔢 Tipo: ${bal.funding_source_type}`);
    }
  });

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log('\n✅ Teste concluído!');
}

testarSyncComPagamento().catch(console.error);
