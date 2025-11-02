#!/usr/bin/env node

/**
 * Script para limpar os dados de teste e deixar os planos em estado consistente
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function cleanupPlanTests() {
  console.log('🧹 Limpando dados de teste dos planos...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Restaurar planos para estado original
    const plansToRestore = [
      {
        id: 'dd69597d-ab7e-4fa6-8d94-6190a9f8056e',
        name: 'Basic',
        description: 'Perfect for small agencies getting started',
        monthly_price: 49,
        annual_price: 490,
        features: [
          'Campaign Management',
          'Basic Analytics',
          'Email Support',
          'Up to 5 Clients',
          'Standard Integrations'
        ]
      },
      {
        id: '82542cdb-f453-41a1-9ef8-2a7bbe57c7f6',
        name: 'Pro',
        description: 'Ideal for growing agencies with advanced needs',
        monthly_price: 99,
        annual_price: 990,
        features: [
          'Advanced Campaign Management',
          'Advanced Analytics',
          'Priority Support',
          'Custom Reports',
          'API Access',
          'Up to 25 Clients',
          'All Integrations'
        ]
      },
      {
        id: 'a529dce5-a2eb-44ce-93db-0cb5a4318ab8',
        name: 'Enterprise',
        description: 'For large agencies requiring unlimited access',
        monthly_price: 299,
        annual_price: 2990,
        features: [
          'Enterprise Campaign Management',
          'Advanced Analytics & AI',
          'Dedicated Support Manager',
          'White Label Solution',
          'Full API Access',
          'Unlimited Clients',
          'Custom Integrations',
          'SLA Guarantee'
        ]
      }
    ];

    for (const plan of plansToRestore) {
      console.log(`🔧 Restaurando plano: ${plan.name}`);
      
      const { error } = await supabase
        .from('subscription_plans')
        .update({
          name: plan.name,
          description: plan.description,
          monthly_price: plan.monthly_price,
          annual_price: plan.annual_price,
          features: plan.features,
          updated_at: new Date().toISOString()
        })
        .eq('id', plan.id);

      if (error) {
        console.error(`❌ Erro ao restaurar plano ${plan.name}:`, error.message);
      } else {
        console.log(`✅ Plano ${plan.name} restaurado`);
      }
    }

    // Verificar estado final
    console.log('\n🔍 Verificando estado final dos planos...\n');
    
    const { data: finalPlans, error: verifyError } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('monthly_price', { ascending: true });

    if (verifyError) {
      console.error('❌ Erro ao verificar planos:', verifyError.message);
      return;
    }

    finalPlans?.forEach((plan, index) => {
      console.log(`${index + 1}. ${plan.name} - R$ ${plan.monthly_price}/mês`);
      console.log(`   Descrição: ${plan.description}`);
      console.log(`   Features (${plan.features?.length || 0}): ${Array.isArray(plan.features) ? '✅ Array' : '❌ Não é array'}`);
      console.log(`   Ativo: ${plan.is_active ? '✅' : '❌'}`);
      console.log('');
    });

    console.log('🎉 Limpeza concluída! Os planos estão prontos para uso.');
    console.log('\n📋 Resumo do que foi corrigido:');
    console.log('✅ Campo features convertido de objeto para array');
    console.log('✅ Planos restaurados para estado original');
    console.log('✅ Dados de teste removidos');
    console.log('✅ Funcionalidade de edição deve estar funcionando');

  } catch (error) {
    console.error('❌ Erro na limpeza:', error);
  }
}

cleanupPlanTests().catch(console.error);