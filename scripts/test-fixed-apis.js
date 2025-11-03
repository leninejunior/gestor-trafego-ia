const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testOrganizationsQuery() {
  try {
    console.log('🔍 Testando query corrigida de organizações...');
    
    // Testar query básica de organizações (sem is_active)
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, created_at')
      .limit(5);
    
    if (orgError) {
      console.log('❌ Erro ao buscar organizações:', orgError.message);
      return;
    }
    
    console.log('✅ Organizações encontradas:', orgs?.length || 0);
    
    if (orgs && orgs.length > 0) {
      console.log('📋 Primeira organização:', orgs[0]);
      
      // Testar query de subscription para primeira organização
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
        .limit(1);
      
      if (subError) {
        console.log('⚠️ Erro ao buscar subscription:', subError.message);
      } else {
        console.log('✅ Subscription encontrada:', sub?.length || 0);
      }
    }
    
  } catch (err) {
    console.log('❌ Erro geral:', err.message);
  }
}

async function testAuditQuery() {
  try {
    console.log('\n🔍 Testando query corrigida de auditoria...');
    
    const { data: audit, error: auditError } = await supabase
      .from('subscription_audit_log')
      .select('*')
      .limit(5);
    
    if (auditError) {
      console.log('❌ Erro ao buscar auditoria:', auditError.message);
      return;
    }
    
    console.log('✅ Logs de auditoria encontrados:', audit?.length || 0);
    
    if (audit && audit.length > 0) {
      console.log('📋 Primeiro log:', audit[0]);
    }
    
  } catch (err) {
    console.log('❌ Erro geral na auditoria:', err.message);
  }
}

async function main() {
  await testOrganizationsQuery();
  await testAuditQuery();
}

main();