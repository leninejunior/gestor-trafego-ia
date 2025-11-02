#!/usr/bin/env node

/**
 * Script para corrigir o campo features de todos os planos
 * Converte de objeto para array conforme esperado pelo frontend
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function fixAllPlanFeatures() {
  console.log('🔧 Corrigindo features de todos os planos...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Buscar todos os planos
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*');

    if (error) {
      console.error('❌ Erro ao buscar planos:', error.message);
      return;
    }

    console.log(`📊 Corrigindo ${plans?.length || 0} planos:\n`);

    for (const plan of plans || []) {
      console.log(`🔧 Corrigindo plano: ${plan.name} (${plan.id})`);
      
      let correctedFeatures = [];
      
      if (Array.isArray(plan.features)) {
        console.log('   ✅ Features já é array, mantendo');
        correctedFeatures = plan.features;
      } else if (plan.features && typeof plan.features === 'object') {
        // Converter objeto para array de strings mais legíveis
        const featureMap = {
          'apiAccess': 'API Access',
          'maxClients': 'Client Management',
          'whiteLabel': 'White Label Solution',
          'maxCampaigns': 'Campaign Management',
          'customReports': 'Custom Reports',
          'prioritySupport': 'Priority Support',
          'advancedAnalytics': 'Advanced Analytics'
        };

        correctedFeatures = Object.entries(plan.features)
          .filter(([key, value]) => value === true || (typeof value === 'number' && value > 0))
          .map(([key, value]) => {
            const displayName = featureMap[key] || key;
            if (typeof value === 'number' && value !== true) {
              return value === -1 ? `${displayName} (Unlimited)` : `${displayName} (${value})`;
            }
            return displayName;
          });

        console.log('   🔄 Convertendo objeto para array:', correctedFeatures);
      } else if (typeof plan.features === 'string') {
        try {
          const parsed = JSON.parse(plan.features);
          correctedFeatures = Array.isArray(parsed) ? parsed : [plan.features];
        } catch {
          correctedFeatures = [plan.features];
        }
        console.log('   🔄 Convertendo string para array:', correctedFeatures);
      } else {
        // Definir features padrão baseado no nome do plano
        if (plan.name.toLowerCase().includes('basic')) {
          correctedFeatures = [
            'Campaign Management',
            'Basic Analytics',
            'Email Support',
            'Up to 5 Clients'
          ];
        } else if (plan.name.toLowerCase().includes('pro')) {
          correctedFeatures = [
            'Advanced Campaign Management',
            'Advanced Analytics',
            'Priority Support',
            'Custom Reports',
            'API Access',
            'Up to 25 Clients'
          ];
        } else if (plan.name.toLowerCase().includes('enterprise')) {
          correctedFeatures = [
            'Enterprise Campaign Management',
            'Advanced Analytics & AI',
            'Dedicated Support',
            'White Label Solution',
            'Full API Access',
            'Unlimited Clients',
            'Custom Integrations'
          ];
        } else {
          correctedFeatures = ['Standard Features', 'Email Support'];
        }
        console.log('   🆕 Criando features padrão:', correctedFeatures);
      }

      // Atualizar o plano
      const { error: updateError } = await supabase
        .from('subscription_plans')
        .update({
          features: correctedFeatures
        })
        .eq('id', plan.id);

      if (updateError) {
        console.error(`   ❌ Erro ao atualizar plano ${plan.name}:`, updateError.message);
      } else {
        console.log(`   ✅ Plano ${plan.name} atualizado com sucesso`);
      }
      console.log('');
    }

    // Verificar se todas as correções foram aplicadas
    console.log('🔍 Verificando correções...\n');
    
    const { data: updatedPlans, error: verifyError } = await supabase
      .from('subscription_plans')
      .select('id, name, features');

    if (verifyError) {
      console.error('❌ Erro ao verificar correções:', verifyError.message);
      return;
    }

    updatedPlans?.forEach((plan, index) => {
      console.log(`${index + 1}. ${plan.name}:`);
      console.log(`   Features é array: ${Array.isArray(plan.features)}`);
      console.log(`   Quantidade de features: ${plan.features?.length || 0}`);
      console.log(`   Features: ${JSON.stringify(plan.features, null, 2)}`);
      console.log('');
    });

    console.log('🎉 Correção de features concluída com sucesso!');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

fixAllPlanFeatures().catch(console.error);