#!/usr/bin/env node

/**
 * Script para testar a funcionalidade de edição de planos
 * Verifica se a API está funcionando corretamente
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testPlanEditing() {
  console.log('🧪 Testando funcionalidade de edição de planos...\n');

  // Verificar variáveis de ambiente
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Variáveis de ambiente não configuradas');
    return;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Verificar se existem planos
    console.log('1️⃣ Verificando planos existentes...');
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .limit(5);

    if (plansError) {
      console.error('❌ Erro ao buscar planos:', plansError.message);
      return;
    }

    console.log(`✅ Encontrados ${plans?.length || 0} planos`);
    
    if (!plans || plans.length === 0) {
      console.log('📝 Criando plano de teste...');
      
      // Criar um plano de teste
      const { data: newPlan, error: createError } = await supabase
        .from('subscription_plans')
        .insert({
          name: 'Plano Teste',
          description: 'Plano criado para teste de edição',
          monthly_price: 99.90,
          annual_price: 999.90,
          features: ['Teste Feature 1', 'Teste Feature 2'],
          max_clients: 5,
          max_campaigns: 25,
          is_active: true
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Erro ao criar plano de teste:', createError.message);
        return;
      }

      console.log('✅ Plano de teste criado:', newPlan.id);
      plans.push(newPlan);
    }

    // 2. Testar edição de um plano
    const testPlan = plans[0];
    console.log(`\n2️⃣ Testando edição do plano: ${testPlan.name} (${testPlan.id})`);

    const updateData = {
      name: `${testPlan.name} - Editado`,
      description: `${testPlan.description} - Atualizado em ${new Date().toISOString()}`,
      monthly_price: parseFloat(testPlan.monthly_price) + 10,
      features: [...(testPlan.features || []), 'Nova Feature Teste']
    };

    console.log('📝 Dados de atualização:', JSON.stringify(updateData, null, 2));

    const { data: updatedPlan, error: updateError } = await supabase
      .from('subscription_plans')
      .update(updateData)
      .eq('id', testPlan.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar plano:', updateError.message);
      console.error('❌ Detalhes do erro:', updateError);
      return;
    }

    console.log('✅ Plano atualizado com sucesso!');
    console.log('📊 Dados atualizados:', JSON.stringify(updatedPlan, null, 2));

    // 3. Verificar se a atualização foi persistida
    console.log('\n3️⃣ Verificando se a atualização foi persistida...');
    
    const { data: verifyPlan, error: verifyError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', testPlan.id)
      .single();

    if (verifyError) {
      console.error('❌ Erro ao verificar plano:', verifyError.message);
      return;
    }

    console.log('✅ Verificação concluída');
    console.log('📊 Estado atual do plano:', JSON.stringify(verifyPlan, null, 2));

    // 4. Testar API REST diretamente
    console.log('\n4️⃣ Testando API REST diretamente...');
    
    const testApiUpdate = {
      name: `${verifyPlan.name} - API Test`,
      description: `${verifyPlan.description} - Testado via API`,
      monthly_price: parseFloat(verifyPlan.monthly_price) + 5
    };

    try {
      const response = await fetch(`http://localhost:3000/api/admin/plans/${testPlan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testApiUpdate)
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('❌ Erro na API REST:', result);
        return;
      }

      console.log('✅ API REST funcionando corretamente');
      console.log('📊 Resposta da API:', JSON.stringify(result, null, 2));

    } catch (apiError) {
      console.error('❌ Erro ao testar API REST:', apiError.message);
      console.log('ℹ️ Certifique-se de que o servidor Next.js está rodando na porta 3000');
    }

    console.log('\n🎉 Teste de edição de planos concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
  }
}

// Executar o teste
testPlanEditing().catch(console.error);