require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSubscriptionPlansStructure() {
  console.log('🔍 Verificando estrutura da tabela subscription_plans...\n');

  try {
    // Buscar um plano para ver a estrutura
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Erro ao buscar planos:', error);
      return;
    }

    if (plans && plans.length > 0) {
      console.log('✅ Estrutura da tabela subscription_plans:');
      console.log('Colunas disponíveis:', Object.keys(plans[0]));
      console.log('\nExemplo de plano:');
      console.log(JSON.stringify(plans[0], null, 2));
    } else {
      console.log('❌ Nenhum plano encontrado');
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

checkSubscriptionPlansStructure();