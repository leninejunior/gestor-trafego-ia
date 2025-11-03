const { createClient } = require('@supabase/supabase-js');

async function debugOrganizationSubscription() {
  console.log('🔍 DIAGNOSTICANDO ORGANIZAÇÃO E ASSINATURA...\n');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Variáveis de ambiente do Supabase não encontradas');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const organizationId = '01bdaa04-1873-427f-8caa-b79bc7dd2fa2';
  
  try {
    // 1. Listar todas as organizações primeiro
    console.log('1. Listando todas as organizações...');
    const { data: allOrgs, error: allOrgsError } = await supabase
      .from('organizations')
      .select('*')
      .limit(10);
    
    if (allOrgsError) {
      console.log('❌ Erro ao listar organizações:', allOrgsError.message);
      return;
    }
    
    console.log(`📋 Encontradas ${allOrgs.length} organizações:`);
    allOrgs.forEach(org => {
      console.log(`  - ${org.name} (${org.id})`);
    });
    
    // 2. Verificar se a organização específica existe
    console.log('\n2. Verificando organização específica...');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .maybeSingle();
    
    if (orgError) {
      console.log('❌ Erro ao buscar organização:', orgError.message);
      return;
    }
    
    if (!org) {
      console.log('❌ Organização não encontrada');
      return;
    }
    
    console.log('✅ Organização encontrada:', org.name);
    console.log('📊 Dados da organização:', {
      id: org.id,
      name: org.name,
      status: org.status,
      created_at: org.created_at
    });
    
    // 3. Verificar assinaturas da organização
    console.log('\n3. Verificando assinaturas...');
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans (
          id,
          name,
          monthly_price,
          annual_price
        )
      `)
      .eq('organization_id', organizationId);
    
    if (subError) {
      console.log('❌ Erro ao buscar assinaturas:', subError.message);
    } else {
      console.log(`📋 Encontradas ${subscriptions.length} assinaturas`);
      
      if (subscriptions.length === 0) {
        console.log('⚠️ PROBLEMA: Organização não tem assinaturas!');
        console.log('\n🔧 SOLUÇÕES:');
        console.log('1. Criar uma assinatura para a organização');
        console.log('2. Modificar a API para não exigir assinatura existente');
        
        // Verificar planos disponíveis
        console.log('\n4. Verificando planos disponíveis...');
        const { data: plans, error: plansError } = await supabase
          .from('subscription_plans')
          .select('*')
          .order('monthly_price');
        
        if (plansError) {
          console.log('❌ Erro ao buscar planos:', plansError.message);
        } else {
          console.log(`📋 Encontrados ${plans.length} planos:`);
          plans.forEach(plan => {
            console.log(`  - ${plan.name}: R$ ${plan.monthly_price}/mês`);
          });
          
          if (plans.length > 0) {
            console.log('\n🛠️ Criando assinatura padrão...');
            
            const defaultPlan = plans.find(p => p.name.toLowerCase().includes('pro')) || plans[0];
            
            const { data: newSub, error: createError } = await supabase
              .from('subscriptions')
              .insert({
                organization_id: organizationId,
                plan_id: defaultPlan.id,
                status: 'active',
                billing_cycle: 'monthly',
                current_period_start: new Date().toISOString(),
                current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select()
              .single();
            
            if (createError) {
              console.log('❌ Erro ao criar assinatura:', createError.message);
            } else {
              console.log('✅ Assinatura criada com sucesso!');
              console.log('📊 Nova assinatura:', {
                id: newSub.id,
                plan: defaultPlan.name,
                status: newSub.status,
                billing_cycle: newSub.billing_cycle
              });
            }
          }
        }
      } else {
        subscriptions.forEach((sub, i) => {
          console.log(`📋 Assinatura ${i + 1}:`, {
            id: sub.id,
            plan: sub.subscription_plans?.name || 'Plano não encontrado',
            status: sub.status,
            billing_cycle: sub.billing_cycle,
            current_period_start: sub.current_period_start,
            current_period_end: sub.current_period_end
          });
        });
      }
    }
    
    // 5. Testar a query da API
    console.log('\n5. Testando query da API...');
    const { data: apiResult, error: apiError } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        subscriptions!inner (
          id,
          plan_id,
          status,
          billing_cycle,
          current_period_start,
          current_period_end,
          subscription_plans!inner (
            id,
            name,
            monthly_price,
            annual_price
          )
        )
      `)
      .eq('id', organizationId)
      .single();
    
    if (apiError) {
      console.log('❌ Query da API falhou:', apiError.message);
      console.log('🔧 Isso explica o erro 404!');
    } else {
      console.log('✅ Query da API funcionou!');
      console.log('📊 Resultado:', apiResult);
    }
    
  } catch (error) {
    console.log('❌ Erro geral:', error.message);
  }
}

// Carregar variáveis de ambiente
require('dotenv').config();

debugOrganizationSubscription().catch(console.error);