const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugOrganizationsQuery() {
  try {
    console.log('🔍 Debugando query de organizações...');
    
    // Query exata da API
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, created_at')
      .order('name', { ascending: true })
      .range(0, 49);
    
    if (orgError) {
      console.log('❌ Erro na query:', orgError.message);
      return;
    }
    
    console.log('✅ Organizações encontradas:', orgs?.length || 0);
    
    if (orgs && orgs.length > 0) {
      console.log('📋 Primeira organização:', orgs[0]);
      
      // Testar query de subscription
      const { data: sub, error: subError } = await supabase
        .from('subscriptions')
        .select(`
          id,
          status,
          billing_cycle,
          current_period_start,
          current_period_end,
          plan_id,
          subscription_plans!inner (
            id,
            name,
            monthly_price,
            annual_price
          )
        `)
        .eq('organization_id', orgs[0].id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (subError) {
        console.log('⚠️ Erro ao buscar subscription ativa:', subError.message);
        
        // Tentar buscar qualquer subscription
        const { data: anySub, error: anySubError } = await supabase
          .from('subscriptions')
          .select(`
            id,
            status,
            billing_cycle,
            current_period_start,
            current_period_end,
            plan_id,
            subscription_plans!inner (
              id,
              name,
              monthly_price,
              annual_price
            )
          `)
          .eq('organization_id', orgs[0].id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (anySubError) {
          console.log('⚠️ Erro ao buscar qualquer subscription:', anySubError.message);
        } else {
          console.log('✅ Subscription encontrada (qualquer status):', anySub);
        }
      } else {
        console.log('✅ Subscription ativa encontrada:', sub);
      }
    }
    
  } catch (err) {
    console.log('❌ Erro geral:', err.message);
  }
}

debugOrganizationsQuery();