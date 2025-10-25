const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPlansData() {
  console.log('🔍 Verificando dados dos planos...\n');
  
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*');
  
  if (error) {
    console.error('❌ Erro:', error);
    return;
  }
  
  console.log(`📊 Total de planos: ${data.length}\n`);
  
  data.forEach(plan => {
    console.log(`\n📝 Plano: ${plan.name}`);
    console.log(`   ID: ${plan.id}`);
    console.log(`   Preço Mensal: ${plan.price_monthly} (tipo: ${typeof plan.price_monthly})`);
    console.log(`   Preço Anual: ${plan.price_yearly} (tipo: ${typeof plan.price_yearly})`);
    console.log(`   Features: ${JSON.stringify(plan.features)}`);
    console.log(`   Features tipo: ${typeof plan.features}`);
    console.log(`   Features é array: ${Array.isArray(plan.features)}`);
    console.log(`   Max Clients: ${plan.max_clients}`);
    console.log(`   Max Users: ${plan.max_users}`);
    console.log(`   Max Ad Accounts: ${plan.max_ad_accounts}`);
    console.log(`   Ativo: ${plan.is_active}`);
  });
}

checkPlansData().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
