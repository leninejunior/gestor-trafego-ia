const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixPlansPrices() {
  console.log('🔧 Corrigindo preços dos planos...\n');
  
  // Definir preços padrão para cada plano
  const planPrices = {
    'Basic': { monthly: 29.00, annual: 290.00 },
    'Pro': { monthly: 99.00, annual: 990.00 },
    'Enterprise': { monthly: 299.00, annual: 2990.00 }
  };
  
  for (const [planName, prices] of Object.entries(planPrices)) {
    console.log(`📝 Atualizando plano ${planName}...`);
    
    const { data, error } = await supabase
      .from('subscription_plans')
      .update({
        monthly_price: prices.monthly,
        annual_price: prices.annual
      })
      .eq('name', planName)
      .select();
    
    if (error) {
      console.error(`❌ Erro ao atualizar ${planName}:`, error);
    } else {
      console.log(`✅ ${planName} atualizado: R$ ${prices.monthly}/mês, R$ ${prices.annual}/ano`);
    }
  }
  
  console.log('\n✅ Preços atualizados com sucesso!');
}

fixPlansPrices().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
