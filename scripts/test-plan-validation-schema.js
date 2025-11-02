#!/usr/bin/env node

/**
 * Script para testar especificamente a validação do schema Zod
 */

const { z } = require('zod');

// Replicar o schema de validação
const UpdatePlanRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  monthly_price: z.number().min(0).optional(),
  annual_price: z.number().min(0).optional(),
  features: z.array(z.string()).optional(),
  limits: z.object({
    clients: z.number().optional(),
    users: z.number().optional(),
    campaigns: z.number().optional(),
    api_calls: z.number().optional(),
    storage_gb: z.number().optional(),
    max_clients: z.number().optional(),
    max_campaigns_per_client: z.number().optional(),
    data_retention_days: z.number().optional(),
    sync_interval_hours: z.number().optional(),
    allow_csv_export: z.union([z.number(), z.boolean()]).optional(),
    allow_json_export: z.union([z.number(), z.boolean()]).optional(),
  }).optional(),
  is_active: z.boolean().optional(),
  is_popular: z.boolean().optional(),
});

async function testPlanValidationSchema() {
  console.log('🧪 Testando validação do schema Zod...\n');

  // Dados de teste que simulam o que o componente enviaria
  const testData = {
    name: "Pro - Teste Edit",
    description: "Ideal for growing agencies with advanced needs - Editado para teste",
    monthly_price: 109,
    annual_price: 1090,
    features: [
      "Advanced Campaign Management",
      "Advanced Analytics",
      "Priority Support",
      "Custom Reports",
      "API Access",
      "Up to 25 Clients",
      "All Integrations",
      "Nova Feature Teste"
    ],
    limits: {
      max_clients: 25,
      max_campaigns_per_client: 100,
      data_retention_days: 90,
      sync_interval_hours: 24,
      allow_csv_export: true,
      allow_json_export: true
    },
    is_active: true,
    is_popular: false
  };

  console.log('📝 Dados de teste:', JSON.stringify(testData, null, 2));

  // Testar validação
  console.log('\n🔍 Testando validação...');
  
  const validationResult = UpdatePlanRequestSchema.safeParse(testData);
  
  if (validationResult.success) {
    console.log('✅ Validação passou com sucesso!');
    console.log('📊 Dados validados:', JSON.stringify(validationResult.data, null, 2));
  } else {
    console.log('❌ Validação falhou!');
    console.log('📋 Erros encontrados:');
    validationResult.error.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.message}`);
      console.log(`      Path: ${error.path.join('.')}`);
      console.log(`      Code: ${error.code}`);
      if (error.expected) console.log(`      Expected: ${error.expected}`);
      if (error.received) console.log(`      Received: ${error.received}`);
      console.log('');
    });
  }

  // Testar cenários problemáticos
  console.log('\n🧪 Testando cenários problemáticos...');

  // Cenário 1: Nome muito longo
  console.log('\n1. Nome muito longo (>100 caracteres)');
  const longNameData = { ...testData, name: 'A'.repeat(101) };
  const longNameResult = UpdatePlanRequestSchema.safeParse(longNameData);
  console.log('Resultado:', longNameResult.success ? '✅ Passou' : '❌ Falhou');
  if (!longNameResult.success) {
    console.log('Erro:', longNameResult.error.errors[0].message);
  }

  // Cenário 2: Preço negativo
  console.log('\n2. Preço negativo');
  const negativePriceData = { ...testData, monthly_price: -10 };
  const negativePriceResult = UpdatePlanRequestSchema.safeParse(negativePriceData);
  console.log('Resultado:', negativePriceResult.success ? '✅ Passou' : '❌ Falhou');
  if (!negativePriceResult.success) {
    console.log('Erro:', negativePriceResult.error.errors[0].message);
  }

  // Cenário 3: Features não é array
  console.log('\n3. Features não é array');
  const nonArrayFeaturesData = { ...testData, features: 'not an array' };
  const nonArrayFeaturesResult = UpdatePlanRequestSchema.safeParse(nonArrayFeaturesData);
  console.log('Resultado:', nonArrayFeaturesResult.success ? '✅ Passou' : '❌ Falhou');
  if (!nonArrayFeaturesResult.success) {
    console.log('Erro:', nonArrayFeaturesResult.error.errors[0].message);
  }

  // Cenário 4: Limits com tipos incorretos
  console.log('\n4. Limits com tipos incorretos');
  const wrongLimitsData = { 
    ...testData, 
    limits: { 
      ...testData.limits, 
      max_clients: 'not a number' 
    } 
  };
  const wrongLimitsResult = UpdatePlanRequestSchema.safeParse(wrongLimitsData);
  console.log('Resultado:', wrongLimitsResult.success ? '✅ Passou' : '❌ Falhou');
  if (!wrongLimitsResult.success) {
    console.log('Erro:', wrongLimitsResult.error.errors[0].message);
  }

  // Cenário 5: Dados válidos mínimos
  console.log('\n5. Dados válidos mínimos');
  const minimalData = {
    name: "Test"
  };
  const minimalResult = UpdatePlanRequestSchema.safeParse(minimalData);
  console.log('Resultado:', minimalResult.success ? '✅ Passou' : '❌ Falhou');
  if (minimalResult.success) {
    console.log('Dados:', JSON.stringify(minimalResult.data, null, 2));
  }

  // Cenário 6: Objeto vazio
  console.log('\n6. Objeto vazio');
  const emptyData = {};
  const emptyResult = UpdatePlanRequestSchema.safeParse(emptyData);
  console.log('Resultado:', emptyResult.success ? '✅ Passou' : '❌ Falhou');
  if (emptyResult.success) {
    console.log('Dados:', JSON.stringify(emptyResult.data, null, 2));
  }

  console.log('\n🎯 CONCLUSÃO:');
  if (validationResult.success) {
    console.log('✅ O schema de validação está funcionando corretamente');
    console.log('✅ Os dados do componente são válidos');
    console.log('💡 O erro "Validation error" deve estar vindo de outro lugar');
  } else {
    console.log('❌ Há problemas com o schema de validação');
    console.log('💡 Estes erros precisam ser corrigidos no componente ou schema');
  }
}

testPlanValidationSchema().catch(console.error);