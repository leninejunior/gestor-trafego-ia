const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addPriceColumns() {
  console.log('🔧 Adicionando colunas de preço...\n');
  
  // Tentar adicionar as colunas via SQL direto
  const alterTableSQL = `
    ALTER TABLE subscription_plans 
    ADD COLUMN IF NOT EXISTS monthly_price DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS annual_price DECIMAL(10,2) DEFAULT 0;
  `;
  
  console.log('📝 Executando ALTER TABLE...');
  const { error: alterError } = await supabase.rpc('exec_sql', { query: alterTableSQL });
  
  if (alterError) {
    console.log('⚠️  Não foi possível usar RPC, tentando atualização direta...\n');
  } else {
    console.log('✅ Colunas adicionadas com sucesso!\n');
  }
  
  // Atualizar preços
  console.log('📝 Atualizando preços dos planos...\n');
  
  const updates = [
    { name: 'Basic', monthly: 29.00, annual: 290.00 },
    { name: 'Pro', monthly: 99.00, annual: 990.00 },
    { name: 'Enterprise', monthly: 299.00, annual: 2990.00 }
  ];
  
  for (const plan of updates) {
    const { data, error } = await supabase
      .from('subscription_plans')
      .update({
        monthly_price: plan.monthly,
        annual_price: plan.annual
      })
      .eq('name', plan.name)
      .select();
    
    if (error) {
      console.error(`❌ Erro ao atualizar ${plan.name}:`, error.message);
      console.error('   Detalhes:', error);
    } else if (data && data.length > 0) {
      console.log(`✅ ${plan.name}: R$ ${plan.monthly}/mês, R$ ${plan.annual}/ano`);
    } else {
      console.log(`⚠️  ${plan.name}: Nenhum registro atualizado`);
    }
  }
  
  // Verificar resultado
  console.log('\n📊 Verificando resultado final...\n');
  const { data: finalData, error: finalError } = await supabase
    .from('subscription_plans')
    .select('name, monthly_price, annual_price');
  
  if (finalError) {
    console.error('❌ Erro ao verificar:', finalError);
  } else {
    finalData.forEach(plan => {
      console.log(`   ${plan.name}: R$ ${plan.monthly_price}/mês, R$ ${plan.annual_price}/ano`);
    });
  }
  
  console.log('\n✅ Processo concluído!');
  console.log('\n📌 PRÓXIMO PASSO: Recarregue a página /admin/plans no navegador');
}

addPriceColumns().then(() => process.exit(0)).catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
