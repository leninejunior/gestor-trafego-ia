const { createClient } = require('@supabase/supabase-js');

async function setupTestOrganization() {
  console.log('🛠️ CONFIGURANDO ORGANIZAÇÃO DE TESTE...\n');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('❌ Variáveis de ambiente do Supabase não encontradas');
    console.log('Necessário: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
    return;
  }
  
  // Usar service role key para bypass RLS
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    // 1. Verificar se já existe a organização
    console.log('1. Verificando organizações existentes...');
    const { data: existingOrgs, error: orgError } = await supabase
      .from('organizations')
      .select('*');
    
    if (orgError) {
      console.log('❌ Erro ao verificar organizações:', orgError.message);
      console.log('🔧 Tentando criar a tabela organizations...');
      
      // Tentar criar a organização mesmo assim
    } else {
      console.log(`📋 Encontradas ${existingOrgs.length} organizações existentes`);
      existingOrgs.forEach(org => {
        console.log(`  - ${org.name} (${org.id})`);
      });
    }
    
    // 2. Verificar planos disponíveis
    console.log('\n2. Verificando planos disponíveis...');
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('monthly_price');
    
    if (plansError) {
      console.log('❌ Erro ao buscar planos:', plansError.message);
      return;
    }
    
    if (plans.length === 0) {
      console.log('⚠️ Nenhum plano encontrado. Criando planos básicos...');
      
      const defaultPlans = [
        {
          name: 'Básico',
          description: 'Plano básico para pequenas empresas',
          monthly_price: 49.90,
          annual_price: 499.00,
          features: ['Dashboard básico', 'Até 5 campanhas', 'Suporte por email'],
          is_active: true
        },
        {
          name: 'Pro',
          description: 'Plano profissional para empresas em crescimento',
          monthly_price: 99.00,
          annual_price: 990.00,
          features: ['Dashboard avançado', 'Campanhas ilimitadas', 'Suporte prioritário', 'Analytics avançado'],
          is_active: true
        },
        {
          name: 'Enterprise',
          description: 'Plano empresarial para grandes organizações',
          monthly_price: 299.00,
          annual_price: 2990.00,
          features: ['Todas as funcionalidades', 'Suporte 24/7', 'API personalizada', 'Gerente dedicado'],
          is_active: true
        }
      ];
      
      const { data: createdPlans, error: createPlansError } = await supabase
        .from('subscription_plans')
        .insert(defaultPlans)
        .select();
      
      if (createPlansError) {
        console.log('❌ Erro ao criar planos:', createPlansError.message);
        return;
      }
      
      console.log('✅ Planos criados com sucesso!');
      plans.push(...createdPlans);
    }
    
    console.log(`📋 Planos disponíveis (${plans.length}):`);
    plans.forEach(plan => {
      console.log(`  - ${plan.name}: R$ ${plan.monthly_price}/mês`);
    });
    
    // 3. Criar organização de teste se não existir
    const testOrgId = '01bdaa04-1873-427f-8caa-b79bc7dd2fa2';
    const testOrgName = 'Engrene Connecting Ideas';
    
    console.log('\n3. Criando/verificando organização de teste...');
    
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', testOrgId)
      .single();
    
    let organization = existingOrg;
    
    if (!existingOrg) {
      console.log('📝 Criando organização de teste...');
      
      const { data: newOrg, error: createOrgError } = await supabase
        .from('organizations')
        .insert({
          id: testOrgId,
          name: testOrgName,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createOrgError) {
        console.log('❌ Erro ao criar organização:', createOrgError.message);
        return;
      }
      
      organization = newOrg;
      console.log('✅ Organização criada:', organization.name);
    } else {
      console.log('✅ Organização já existe:', organization.name);
    }
    
    // 4. Verificar/criar assinatura
    console.log('\n4. Verificando assinatura da organização...');
    
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', testOrgId)
      .single();
    
    if (!existingSub) {
      console.log('📝 Criando assinatura de teste...');
      
      const proPlan = plans.find(p => p.name.toLowerCase().includes('pro')) || plans[0];
      
      const { data: newSub, error: createSubError } = await supabase
        .from('subscriptions')
        .insert({
          organization_id: testOrgId,
          plan_id: proPlan.id,
          status: 'active',
          billing_cycle: 'monthly',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createSubError) {
        console.log('❌ Erro ao criar assinatura:', createSubError.message);
        return;
      }
      
      console.log('✅ Assinatura criada:', {
        id: newSub.id,
        plan: proPlan.name,
        status: newSub.status,
        billing_cycle: newSub.billing_cycle
      });
    } else {
      console.log('✅ Assinatura já existe:', {
        id: existingSub.id,
        status: existingSub.status,
        billing_cycle: existingSub.billing_cycle
      });
    }
    
    // 5. Testar a query da API novamente
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
      .eq('id', testOrgId)
      .single();
    
    if (apiError) {
      console.log('❌ Query da API ainda falha:', apiError.message);
    } else {
      console.log('✅ Query da API funcionou!');
      console.log('📊 Resultado:', {
        organization: apiResult.name,
        subscription: {
          plan: apiResult.subscriptions[0].subscription_plans.name,
          status: apiResult.subscriptions[0].status,
          billing_cycle: apiResult.subscriptions[0].billing_cycle
        }
      });
    }
    
    console.log('\n🎉 CONFIGURAÇÃO CONCLUÍDA!');
    console.log('💡 Agora você pode testar o modal de ajuste manual novamente.');
    
  } catch (error) {
    console.log('❌ Erro geral:', error.message);
    console.log('Stack:', error.stack);
  }
}

// Carregar variáveis de ambiente
require('dotenv').config();

setupTestOrganization().catch(console.error);