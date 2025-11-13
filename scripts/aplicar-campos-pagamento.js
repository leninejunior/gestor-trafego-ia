const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

async function aplicarCamposPagamento() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('📊 Aplicando campos de meio de pagamento e limite de gastos...\n');

  const sql = fs.readFileSync('database/add-balance-payment-info.sql', 'utf8');
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('❌ Erro ao aplicar SQL:', error);
    
    // Tentar aplicar manualmente
    console.log('\n🔧 Tentando aplicar manualmente...');
    
    const commands = [
      'ALTER TABLE ad_account_balances ADD COLUMN IF NOT EXISTS funding_source_type INTEGER',
      'ALTER TABLE ad_account_balances ADD COLUMN IF NOT EXISTS funding_source_display TEXT',
      'ALTER TABLE ad_account_balances ADD COLUMN IF NOT EXISTS spend_cap DECIMAL(15, 2)',
      'ALTER TABLE ad_account_balances ADD COLUMN IF NOT EXISTS amount_spent DECIMAL(15, 2)'
    ];
    
    for (const cmd of commands) {
      console.log(`\nExecutando: ${cmd}`);
      const { error: cmdError } = await supabase.rpc('exec_sql', { sql_query: cmd });
      if (cmdError) {
        console.error('❌ Erro:', cmdError.message);
      } else {
        console.log('✅ Sucesso');
      }
    }
  } else {
    console.log('✅ Campos adicionados com sucesso!');
  }

  console.log('\n📋 Verificando estrutura da tabela...');
  const { data: columns, error: colError } = await supabase
    .from('ad_account_balances')
    .select('*')
    .limit(1);

  if (!colError && columns) {
    console.log('Colunas disponíveis:', Object.keys(columns[0] || {}));
  }

  console.log('\n✅ Processo concluído!');
  console.log('\n📝 PRÓXIMO PASSO: Execute no SQL Editor do Supabase:');
  console.log(sql);
}

aplicarCamposPagamento().catch(console.error);
