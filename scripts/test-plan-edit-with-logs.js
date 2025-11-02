#!/usr/bin/env node

/**
 * Script para testar a edição de planos com logs detalhados
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testPlanEditWithLogs() {
  console.log('🧪 Testando edição de planos com logs detalhados...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Buscar um plano para editar
    console.log('1️⃣ Buscando plano para editar...');
    
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .limit(1);

    if (plansError || !plans || plans.length === 0) {
      console.error('❌ Erro ao buscar planos ou nenhum plano encontrado');
      return;
    }

    const testPlan = plans[0];
    console.log('✅ Plano encontrado:', testPlan.name);

    // 2. Simular formData como o componente criaria
    console.log('\n2️⃣ Criando formData simulado...');
    
    // Normalizar features
    let featuresArray = [];
    if (Array.isArray(testPlan.features)) {
      featuresArray = [...testPlan.features];
    } else if (testPlan.features && typeof testPlan.features === 'object') {
      featuresArray = Object.entries(testPlan.features).map(([key, value]) => 
        typeof value === 'boolean' ? key : `${key}: ${value}`
      );
    }

    const formData = {
      name: testPlan.name + ' - Teste Edit',
      description: testPlan.description + ' - Editado para teste',
      monthly_price: parseFloat(testPlan.monthly_price) + 10,
      annual_price: parseFloat(testPlan.annual_price) + 100,
      features: [...featuresArray, 'Nova Feature Teste'],
      limits: {
        max_clients: testPlan.max_clients || 5,
        max_campaigns_per_client: testPlan.max_campaigns || 25,
        data_retention_days: 90,
        sync_interval_hours: 24,
        allow_csv_export: true,
        allow_json_export: true
      },
      is_active: testPlan.is_active,
      is_popular: false
    };

    console.log('📝 FormData criado:', JSON.stringify(formData, null, 2));

    // 3. Validar localmente primeiro
    console.log('\n3️⃣ Validação local...');
    
    const validatePlan = (data) => {
      const errors = [];
      if (!data.name || !data.name.trim()) errors.push('Plan name is required');
      if (!data.description || !data.description.trim()) errors.push('Plan description is required');
      if (data.monthly_price < 0) errors.push('Monthly price cannot be negative');
      if (data.annual_price < 0) errors.push('Annual price cannot be negative');
      if (!data.features || !Array.isArray(data.features) || data.features.length === 0) {
        errors.push('At least one feature is required');
      }
      return errors;
    };

    const localErrors = validatePlan(formData);
    if (localErrors.length > 0) {
      console.error('❌ Erros de validação local:', localErrors);
      return;
    }
    console.log('✅ Validação local passou');

    // 4. Testar a API diretamente
    console.log('\n4️⃣ Testando API diretamente...');
    
    const requestBody = JSON.stringify(formData);
    console.log('📤 Request body:', requestBody);
    console.log('📊 Request body size:', requestBody.length, 'bytes');

    try {
      const response = await fetch(`http://localhost:3000/api/admin/plans/${testPlan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log('📄 Response text:', responseText);

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Erro ao parsear resposta JSON:', parseError.message);
        console.log('📄 Raw response:', responseText);
        return;
      }

      if (!response.ok) {
        console.error('❌ API retornou erro:', responseData);
        
        if (responseData.details) {
          console.error('❌ Detalhes da validação:');
          responseData.details.forEach((detail, index) => {
            console.error(`   ${index + 1}. ${detail.message || detail}`);
            if (detail.path) {
              console.error(`      Path: ${detail.path.join('.')}`);
            }
          });
        }
        return;
      }

      console.log('✅ API funcionou com sucesso!');
      console.log('📊 Resposta:', JSON.stringify(responseData, null, 2));

      // 5. Verificar se a atualização foi persistida
      console.log('\n5️⃣ Verificando persistência...');
      
      const { data: updatedPlan, error: fetchError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', testPlan.id)
        .single();

      if (fetchError) {
        console.error('❌ Erro ao buscar plano atualizado:', fetchError.message);
        return;
      }

      console.log('✅ Plano atualizado encontrado');
      console.log('📊 Nome atualizado:', updatedPlan.name);
      console.log('📊 Preço atualizado:', updatedPlan.monthly_price);
      console.log('📊 Features atualizadas:', updatedPlan.features?.length, 'itens');

      // 6. Restaurar o plano original
      console.log('\n6️⃣ Restaurando plano original...');
      
      const { error: restoreError } = await supabase
        .from('subscription_plans')
        .update({
          name: testPlan.name,
          description: testPlan.description,
          monthly_price: testPlan.monthly_price,
          annual_price: testPlan.annual_price,
          features: testPlan.features
        })
        .eq('id', testPlan.id);

      if (restoreError) {
        console.error('❌ Erro ao restaurar plano:', restoreError.message);
      } else {
        console.log('✅ Plano restaurado ao estado original');
      }

    } catch (apiError) {
      console.error('❌ Erro na chamada da API:', apiError.message);
      console.log('ℹ️ Certifique-se de que o servidor Next.js está rodando na porta 3000');
    }

    console.log('\n🎉 Teste concluído!');

  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
  }
}

testPlanEditWithLogs().catch(console.error);