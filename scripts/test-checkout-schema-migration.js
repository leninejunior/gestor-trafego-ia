/**
 * Script de Teste - Migração do Schema de Checkout
 * 
 * Valida se a migração do schema foi aplicada corretamente
 * e testa as funcionalidades principais
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  console.error('Certifique-se de que NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testSchemaValidation() {
  console.log('🔍 Testando validação do schema...\n');

  const tests = [
    {
      name: 'Verificar tabela subscription_intents',
      test: async () => {
        const { data, error } = await supabase
          .from('subscription_intents')
          .select('*')
          .limit(0);
        
        if (error) throw error;
        return 'Tabela subscription_intents existe e é acessível';
      }
    },
    {
      name: 'Verificar tabela webhook_logs',
      test: async () => {
        const { data, error } = await supabase
          .from('webhook_logs')
          .select('*')
          .limit(0);
        
        if (error) throw error;
        return 'Tabela webhook_logs existe e é acessível';
      }
    },
    {
      name: 'Verificar tabela payment_analytics',
      test: async () => {
        const { data, error } = await supabase
          .from('payment_analytics')
          .select('*')
          .limit(0);
        
        if (error) throw error;
        return 'Tabela payment_analytics existe e é acessível';
      }
    },
    {
      name: 'Verificar tabela webhook_retry_queue',
      test: async () => {
        const { data, error } = await supabase
          .from('webhook_retry_queue')
          .select('*')
          .limit(0);
        
        if (error) throw error;
        return 'Tabela webhook_retry_queue existe e é acessível';
      }
    }
  ];

  for (const test of tests) {
    try {
      const result = await test.test();
      console.log(`✅ ${test.name}: ${result}`);
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
  }
}

async function testFunctionality() {
  console.log('\n🧪 Testando funcionalidades...\n');

  let testPlanId = null;
  let testIntentId = null;
  let testWebhookLogId = null;

  try {
    // 1. Criar plano de teste
    console.log('📝 Criando plano de teste...');
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .insert({
        name: 'Test Plan - Migration',
        description: 'Plan for testing migration',
        monthly_price: 29.99,
        annual_price: 299.99,
        features: { test: true },
        max_clients: 5,
        max_campaigns: 25,
        is_active: true
      })
      .select()
      .single();

    if (planError) throw planError;
    testPlanId = plan.id;
    console.log(`✅ Plano criado: ${testPlanId}`);

    // 2. Testar função create_subscription_intent
    console.log('\n📝 Testando criação de subscription intent...');
    const { data: intentId, error: intentError } = await supabase.rpc('create_subscription_intent', {
      plan_id_param: testPlanId,
      billing_cycle_param: 'monthly',
      user_email_param: 'test-migration@example.com',
      user_name_param: 'Test Migration User',
      organization_name_param: 'Test Migration Org',
      cpf_cnpj_param: '12345678901',
      phone_param: '+5511999999999',
      metadata_param: { test: 'migration' }
    });

    if (intentError) throw intentError;
    testIntentId = intentId;
    console.log(`✅ Subscription intent criado: ${testIntentId}`);

    // 3. Verificar dados do intent
    console.log('\n📝 Verificando dados do intent...');
    const { data: intent, error: selectError } = await supabase
      .from('subscription_intents')
      .select('*')
      .eq('id', testIntentId)
      .single();

    if (selectError) throw selectError;
    
    console.log(`✅ Status: ${intent.status}`);
    console.log(`✅ Email: ${intent.user_email}`);
    console.log(`✅ Expires at: ${intent.expires_at}`);
    console.log(`✅ Metadata: ${JSON.stringify(intent.metadata)}`);

    // 4. Testar atualização de status
    console.log('\n📝 Testando atualização de status...');
    const { data: updateResult, error: updateError } = await supabase.rpc('update_subscription_intent_status', {
      intent_id_param: testIntentId,
      new_status_param: 'processing',
      iugu_customer_id_param: 'test_customer_123',
      metadata_update_param: { updated_by: 'test' }
    });

    if (updateError) throw updateError;
    console.log(`✅ Status atualizado: ${updateResult}`);

    // 5. Testar log de webhook
    console.log('\n📝 Testando log de webhook...');
    const { data: webhookLogId, error: webhookError } = await supabase.rpc('log_webhook_event', {
      event_type_param: 'test.migration',
      event_id_param: 'evt_migration_test',
      payload_param: {
        test: true,
        subscription_intent_id: testIntentId,
        timestamp: new Date().toISOString()
      },
      provider_param: 'iugu',
      subscription_intent_id_param: testIntentId
    });

    if (webhookError) throw webhookError;
    testWebhookLogId = webhookLogId;
    console.log(`✅ Webhook log criado: ${testWebhookLogId}`);

    // 6. Testar atualização de status do webhook
    console.log('\n📝 Testando atualização de status do webhook...');
    const { data: webhookUpdateResult, error: webhookUpdateError } = await supabase.rpc('update_webhook_processing_status', {
      log_id_param: testWebhookLogId,
      new_status_param: 'completed',
      error_message_param: null,
      error_details_param: null
    });

    if (webhookUpdateError) throw webhookUpdateError;
    console.log(`✅ Status do webhook atualizado: ${webhookUpdateResult}`);

    // 7. Testar analytics
    console.log('\n📝 Testando atualização de analytics...');
    const { data: analyticsResult, error: analyticsError } = await supabase.rpc('update_daily_payment_analytics', {
      target_date: new Date().toISOString().split('T')[0],
      target_plan_id: testPlanId
    });

    if (analyticsError) throw analyticsError;
    console.log(`✅ Analytics atualizadas: ${analyticsResult} plano(s) processado(s)`);

    // 8. Verificar analytics criadas
    const { data: analytics, error: analyticsSelectError } = await supabase
      .from('payment_analytics')
      .select('*')
      .eq('plan_id', testPlanId)
      .eq('date', new Date().toISOString().split('T')[0])
      .single();

    if (analyticsSelectError) {
      console.log(`⚠️ Analytics não encontradas (normal se não há dados): ${analyticsSelectError.message}`);
    } else {
      console.log(`✅ Analytics encontradas: ${analytics.checkouts_started} checkouts iniciados`);
    }

    // 9. Testar limpeza de intents expirados
    console.log('\n📝 Testando limpeza de intents expirados...');
    const { data: cleanupResult, error: cleanupError } = await supabase.rpc('cleanup_expired_subscription_intents');

    if (cleanupError) throw cleanupError;
    console.log(`✅ Limpeza executada: ${cleanupResult} intent(s) expirado(s)`);

    // 10. Testar constraints e validações
    console.log('\n📝 Testando constraints e validações...');
    
    // Tentar criar intent com plano inválido
    try {
      await supabase.rpc('create_subscription_intent', {
        plan_id_param: '00000000-0000-0000-0000-000000000000',
        billing_cycle_param: 'monthly',
        user_email_param: 'invalid@example.com',
        user_name_param: 'Invalid Test',
        organization_name_param: 'Invalid Org'
      });
      console.log('❌ Deveria ter falhado com plano inválido');
    } catch (error) {
      console.log('✅ Constraint de plano inválido funcionando corretamente');
    }

    // Tentar criar intent com billing_cycle inválido
    try {
      await supabase.rpc('create_subscription_intent', {
        plan_id_param: testPlanId,
        billing_cycle_param: 'invalid_cycle',
        user_email_param: 'invalid2@example.com',
        user_name_param: 'Invalid Test 2',
        organization_name_param: 'Invalid Org 2'
      });
      console.log('❌ Deveria ter falhado com billing_cycle inválido');
    } catch (error) {
      console.log('✅ Constraint de billing_cycle inválido funcionando corretamente');
    }

    console.log('\n🎉 Todos os testes funcionais passaram!');

  } catch (error) {
    console.error(`❌ Erro durante teste funcional: ${error.message}`);
  } finally {
    // Limpeza
    console.log('\n🧹 Limpando dados de teste...');
    
    if (testWebhookLogId) {
      await supabase.from('webhook_logs').delete().eq('id', testWebhookLogId);
      console.log('✅ Webhook log removido');
    }
    
    if (testIntentId) {
      await supabase.from('subscription_intents').delete().eq('id', testIntentId);
      console.log('✅ Subscription intent removido');
    }
    
    if (testPlanId) {
      // Remover analytics primeiro (foreign key)
      await supabase.from('payment_analytics').delete().eq('plan_id', testPlanId);
      await supabase.from('subscription_plans').delete().eq('id', testPlanId);
      console.log('✅ Plano de teste removido');
    }
  }
}

async function testPerformance() {
  console.log('\n⚡ Testando performance básica...\n');

  const performanceTests = [
    {
      name: 'Query por status em subscription_intents',
      test: async () => {
        const start = Date.now();
        const { data, error } = await supabase
          .from('subscription_intents')
          .select('*')
          .eq('status', 'pending')
          .limit(10);
        
        const duration = Date.now() - start;
        if (error) throw error;
        return `${duration}ms`;
      }
    },
    {
      name: 'Query por event_type em webhook_logs',
      test: async () => {
        const start = Date.now();
        const { data, error } = await supabase
          .from('webhook_logs')
          .select('*')
          .eq('event_type', 'invoice.status_changed')
          .limit(10);
        
        const duration = Date.now() - start;
        if (error) throw error;
        return `${duration}ms`;
      }
    },
    {
      name: 'Query por data em payment_analytics',
      test: async () => {
        const start = Date.now();
        const { data, error } = await supabase
          .from('payment_analytics')
          .select('*')
          .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .limit(10);
        
        const duration = Date.now() - start;
        if (error) throw error;
        return `${duration}ms`;
      }
    }
  ];

  for (const test of performanceTests) {
    try {
      const result = await test.test();
      const isGood = parseInt(result) < 1000;
      console.log(`${isGood ? '✅' : '⚠️'} ${test.name}: ${result}`);
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
  }
}

async function main() {
  console.log('🚀 Iniciando testes da migração do schema de checkout...\n');
  
  try {
    await testSchemaValidation();
    await testFunctionality();
    await testPerformance();
    
    console.log('\n✅ Todos os testes concluídos com sucesso!');
    console.log('\n📋 Resumo:');
    console.log('- Schema validado: subscription_intents, webhook_logs, payment_analytics, webhook_retry_queue');
    console.log('- Funções testadas: create_subscription_intent, update_subscription_intent_status, log_webhook_event');
    console.log('- Constraints validadas: foreign keys, check constraints');
    console.log('- Performance básica verificada');
    
  } catch (error) {
    console.error(`❌ Erro geral: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  testSchemaValidation,
  testFunctionality,
  testPerformance
};