#!/usr/bin/env node

/**
 * Script para debugar o erro de validação no handleEditPlan
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function debugValidationError() {
  console.log('🔍 Debugando erro de validação no handleEditPlan...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Buscar um plano para simular a edição
    console.log('1️⃣ Buscando planos para simular edição...');
    
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .limit(1);

    if (plansError) {
      console.error('❌ Erro ao buscar planos:', plansError.message);
      return;
    }

    if (!plans || plans.length === 0) {
      console.log('❌ Nenhum plano encontrado para testar');
      return;
    }

    const testPlan = plans[0];
    console.log('✅ Plano encontrado para teste:', testPlan.name);
    console.log('📊 Dados do plano:', JSON.stringify(testPlan, null, 2));

    // 2. Simular o que acontece no openEditDialog
    console.log('\n2️⃣ Simulando openEditDialog...');
    
    // Normalizar features como o componente faz
    let featuresArray = [];
    if (Array.isArray(testPlan.features)) {
      featuresArray = [...testPlan.features];
    } else if (testPlan.features && typeof testPlan.features === 'object') {
      featuresArray = Object.entries(testPlan.features).map(([key, value]) => 
        typeof value === 'boolean' ? key : `${key}: ${value}`
      );
    }

    console.log('🔄 Features normalizadas:', featuresArray);
    console.log('📊 Features é array:', Array.isArray(featuresArray));
    console.log('📊 Features length:', featuresArray.length);

    // Simular formData como seria criado
    const formData = {
      name: testPlan.name,
      description: testPlan.description,
      monthly_price: testPlan.monthly_price,
      annual_price: testPlan.annual_price,
      features: featuresArray,
      limits: { ...testPlan.limits },
      is_active: testPlan.is_active,
      is_popular: testPlan.is_popular || false
    };

    console.log('📝 FormData simulado:', JSON.stringify(formData, null, 2));

    // 3. Simular a validação
    console.log('\n3️⃣ Simulando validação...');
    
    const validatePlan = (data) => {
      const errors = [];
      
      console.log('🔍 Validando name:', data.name, '- trim:', data.name?.trim());
      if (!data.name || !data.name.trim()) errors.push('Plan name is required');
      
      console.log('🔍 Validando description:', data.description, '- trim:', data.description?.trim());
      if (!data.description || !data.description.trim()) errors.push('Plan description is required');
      
      console.log('🔍 Validando monthly_price:', data.monthly_price, '- type:', typeof data.monthly_price);
      if (data.monthly_price < 0) errors.push('Monthly price cannot be negative');
      
      console.log('🔍 Validando annual_price:', data.annual_price, '- type:', typeof data.annual_price);
      if (data.annual_price < 0) errors.push('Annual price cannot be negative');
      
      console.log('🔍 Validando features:', data.features, '- isArray:', Array.isArray(data.features), '- length:', data.features?.length);
      if (!data.features || !Array.isArray(data.features) || data.features.length === 0) {
        errors.push('At least one feature is required');
      }
      
      return errors;
    };

    const validationErrors = validatePlan(formData);
    
    if (validationErrors.length > 0) {
      console.log('❌ Erros de validação encontrados:');
      validationErrors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    } else {
      console.log('✅ Validação passou sem erros');
    }

    // 4. Testar diferentes cenários problemáticos
    console.log('\n4️⃣ Testando cenários problemáticos...');

    // Cenário 1: Features undefined
    console.log('\n🧪 Cenário 1: Features undefined');
    const testData1 = { ...formData, features: undefined };
    const errors1 = validatePlan(testData1);
    console.log('Erros:', errors1);

    // Cenário 2: Features null
    console.log('\n🧪 Cenário 2: Features null');
    const testData2 = { ...formData, features: null };
    const errors2 = validatePlan(testData2);
    console.log('Erros:', errors2);

    // Cenário 3: Features não é array
    console.log('\n🧪 Cenário 3: Features não é array');
    const testData3 = { ...formData, features: 'not an array' };
    const errors3 = validatePlan(testData3);
    console.log('Erros:', errors3);

    // Cenário 4: Features array vazio
    console.log('\n🧪 Cenário 4: Features array vazio');
    const testData4 = { ...formData, features: [] };
    const errors4 = validatePlan(testData4);
    console.log('Erros:', errors4);

    // Cenário 5: Name vazio
    console.log('\n🧪 Cenário 5: Name vazio');
    const testData5 = { ...formData, name: '' };
    const errors5 = validatePlan(testData5);
    console.log('Erros:', errors5);

    // Cenário 6: Preços negativos
    console.log('\n🧪 Cenário 6: Preços negativos');
    const testData6 = { ...formData, monthly_price: -10, annual_price: -100 };
    const errors6 = validatePlan(testData6);
    console.log('Erros:', errors6);

    // 5. Verificar se há algum problema com tipos de dados
    console.log('\n5️⃣ Verificando tipos de dados...');
    
    console.log('Tipos dos campos:');
    console.log('- name:', typeof formData.name);
    console.log('- description:', typeof formData.description);
    console.log('- monthly_price:', typeof formData.monthly_price);
    console.log('- annual_price:', typeof formData.annual_price);
    console.log('- features:', typeof formData.features, Array.isArray(formData.features) ? '(array)' : '(not array)');
    console.log('- limits:', typeof formData.limits);
    console.log('- is_active:', typeof formData.is_active);
    console.log('- is_popular:', typeof formData.is_popular);

    // 6. Simular o JSON.stringify que é usado na requisição
    console.log('\n6️⃣ Testando JSON.stringify...');
    
    try {
      const jsonString = JSON.stringify(formData);
      console.log('✅ JSON.stringify funcionou');
      console.log('📊 Tamanho do JSON:', jsonString.length);
      
      // Testar parse de volta
      const parsedData = JSON.parse(jsonString);
      console.log('✅ JSON.parse funcionou');
      console.log('📊 Features após parse:', parsedData.features, Array.isArray(parsedData.features));
      
    } catch (jsonError) {
      console.error('❌ Erro no JSON.stringify/parse:', jsonError.message);
    }

    console.log('\n🎯 CONCLUSÃO:');
    console.log('Se não há erros de validação aqui, o problema pode estar:');
    console.log('1. No estado do React quando handleEditPlan é chamado');
    console.log('2. Na transformação dos dados antes da validação');
    console.log('3. Em alguma condição de corrida no estado');
    console.log('4. Na API que está retornando erro de validação');

  } catch (error) {
    console.error('❌ Erro geral no debug:', error);
  }
}

debugValidationError().catch(console.error);