const { createClient } = require('@supabase/supabase-js');

async function verifyPlanChange() {
  console.log('🔍 VERIFICANDO MUDANÇA DE PLANO...\n');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('❌ Variáveis de ambiente não encontradas');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  const organizationId = '01bdaa04-1873-427f-8caa-b79bc7dd2fa2';
  
  try {
    // 1. Verificar assinatura atual
    console.log('1. Verificando assinatura atual...');
    
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        plan_id,
        status,
        billing_cycle,
        updated_at,
        subscription_plans (
          id,
          name,
          monthly_price,
          annual_price
        )
      `)
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    if (subError) {
      console.log('❌ Erro ao buscar assinatura:', subError.message);
      return;
    }
    
    console.log('📊 Assinatura atual:', {
      id: subscription.id,
      plan: subscription.subscription_plans.name,
      price: subscription.subscription_plans.monthly_price,
      status: subscription.status,
      billing_cycle: subscription.billing_cycle,
      updated_at: subscription.updated_at
    });
    
    // 2. Verificar histórico de auditoria
    console.log('\n2. Verificando histórico de auditoria...');
    
    const { data: auditLogs, error: auditError } = await supabase
      .from('subscription_audit_log')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (auditError) {
      console.log('⚠️ Erro ao buscar auditoria (tabela pode não existir):', auditError.message);
    } else {
      console.log(`📋 Encontrados ${auditLogs.length} registros de auditoria:`);
      auditLogs.forEach((log, i) => {
        console.log(`${i + 1}. ${log.action_type} - ${log.reason} (${log.created_at})`);
      });
    }
    
    // 3. Verificar todos os planos disponíveis
    console.log('\n3. Verificando planos disponíveis...');
    
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('monthly_price');
    
    if (plansError) {
      console.log('❌ Erro ao buscar planos:', plansError.message);
    } else {
      console.log(`📋 Planos disponíveis (${plans.length}):`);
      plans.forEach(plan => {
        const isCurrent = plan.id === subscription.plan_id;
        console.log(`${isCurrent ? '👉' : '  '} ${plan.name}: R$ ${plan.monthly_price}/mês (ID: ${plan.id})`);
      });
    }
    
    // 4. Simular mudança para Enterprise
    const enterprisePlan = plans.find(p => p.name.toLowerCase().includes('enterprise'));
    
    if (enterprisePlan && subscription.plan_id !== enterprisePlan.id) {
      console.log('\n4. Testando mudança para Enterprise...');
      
      const { data: updated, error: updateError } = await supabase
        .from('subscriptions')
        .update({
          plan_id: enterprisePlan.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id)
        .select(`
          id,
          plan_id,
          subscription_plans (
            name,
            monthly_price
          )
        `)
        .single();
      
      if (updateError) {
        console.log('❌ Erro ao atualizar:', updateError.message);
      } else {
        console.log('✅ Plano atualizado com sucesso!');
        console.log('📊 Nova assinatura:', {
          id: updated.id,
          plan: updated.subscription_plans.name,
          price: updated.subscription_plans.monthly_price
        });
      }
    } else if (subscription.plan_id === enterprisePlan?.id) {
      console.log('\n✅ Assinatura já está no plano Enterprise!');
    } else {
      console.log('\n⚠️ Plano Enterprise não encontrado');
    }
    
  } catch (error) {
    console.log('❌ Erro geral:', error.message);
  }
}

// Carregar variáveis de ambiente
require('dotenv').config();

verifyPlanChange().catch(console.error);