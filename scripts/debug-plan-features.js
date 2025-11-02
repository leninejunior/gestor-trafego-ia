#!/usr/bin/env node

/**
 * Script para debugar o problema com features dos planos
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function debugPlanFeatures() {
  console.log('🔍 Debugando features dos planos...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Buscar todos os planos e analisar o campo features
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*');

    if (error) {
      console.error('❌ Erro ao buscar planos:', error.message);
      return;
    }

    console.log(`📊 Analisando ${plans?.length || 0} planos:\n`);

    plans?.forEach((plan, index) => {
      console.log(`${index + 1}. Plano: ${plan.name} (${plan.id})`);
      console.log(`   Features tipo: ${typeof plan.features}`);
      console.log(`   Features valor:`, plan.features);
      console.log(`   Features é array: ${Array.isArray(plan.features)}`);
      
      if (plan.features) {
        if (typeof plan.features === 'string') {
          try {
            const parsed = JSON.parse(plan.features);
            console.log(`   Features parseado:`, parsed);
            console.log(`   Features parseado é array: ${Array.isArray(parsed)}`);
          } catch (e) {
            console.log(`   ❌ Erro ao parsear features como JSON: ${e.message}`);
          }
        }
      }
      console.log('');
    });

    // Testar correção do primeiro plano
    if (plans && plans.length > 0) {
      const firstPlan = plans[0];
      console.log(`🔧 Testando correção do plano: ${firstPlan.name}`);

      let correctedFeatures = [];
      
      if (Array.isArray(firstPlan.features)) {
        correctedFeatures = firstPlan.features;
      } else if (firstPlan.features && typeof firstPlan.features === 'object') {
        // Se é um objeto, converter para array
        correctedFeatures = Object.entries(firstPlan.features).map(([key, value]) => 
          typeof value === 'boolean' ? key : `${key}: ${value}`
        );
      } else if (typeof firstPlan.features === 'string') {
        try {
          const parsed = JSON.parse(firstPlan.features);
          correctedFeatures = Array.isArray(parsed) ? parsed : [firstPlan.features];
        } catch {
          correctedFeatures = [firstPlan.features];
        }
      } else {
        correctedFeatures = ['Basic Features', 'Standard Support'];
      }

      console.log('✅ Features corrigidas:', correctedFeatures);

      // Atualizar o plano com features corretas
      const { data: updatedPlan, error: updateError } = await supabase
        .from('subscription_plans')
        .update({
          features: correctedFeatures
        })
        .eq('id', firstPlan.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Erro ao corrigir features:', updateError.message);
      } else {
        console.log('✅ Features corrigidas com sucesso!');
        console.log('📊 Plano atualizado:', {
          id: updatedPlan.id,
          name: updatedPlan.name,
          features: updatedPlan.features,
          featuresType: typeof updatedPlan.features,
          featuresIsArray: Array.isArray(updatedPlan.features)
        });
      }
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

debugPlanFeatures().catch(console.error);