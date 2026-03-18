/**
 * Testes de Schema - Webhook Logs e Payment Analytics
 * 
 * Valida a integridade do schema das tabelas de auditoria e analytics
 * conforme Requirements 4.1, 6.1, 6.2
 */

import { createClient } from '@supabase/supabase-js';

// Configuração do cliente de teste
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

describe('Webhook Logs and Analytics Schema Tests', () => {
  let testPlanId: string;
  let testIntentId: string;
  let testWebhookLogId: string;

  beforeAll(async () => {
    // Criar plano de teste
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .insert({
        name: 'Analytics Test Plan',
        description: 'Plan for analytics testing',
        monthly_price: 49.99,
        annual_price: 499.99,
        features: { analytics_test: true },
        max_clients: 10,
        max_campaigns: 50,
        is_active: true
      })
      .select()
      .single();

    if (planError) throw planError;
    testPlanId = plan.id;

    // Criar subscription intent de teste
    const { data: intent, error: intentError } = await supabase
      .from('subscription_intents')
      .insert({
        plan_id: testPlanId,
        billing_cycle: 'monthly',
        user_email: 'analytics-test@example.com',
        user_name: 'Analytics Test',
        organization_name: 'Analytics Org'
      })
      .select()
      .single();

    if (intentError) throw intentError;
    testIntentId = intent.id;
  });

  afterAll(async () => {
    // Limpar dados de teste
    if (testWebhookLogId) {
      await supabase.from('webhook_logs').delete().eq('id', testWebhookLogId);
    }
    if (testIntentId) {
      await supabase.from('subscription_intents').delete().eq('id', testIntentId);
    }
    if (testPlanId) {
      await supabase.from('subscription_plans').delete().eq('id', testPlanId);
    }
  });

  describe('Webhook Logs Table Tests', () => {
    test('should create webhook log with required fields', async () => {
      const webhookData = {
        event_type: 'invoice.status_changed',
        event_id: 'evt_test_123',
        subscription_intent_id: testIntentId,
        payload: {
          id: 'inv_123',
          status: 'paid',
          amount: 4999
        },
        provider: 'iugu'
      };

      const { data, error } = await supabase
        .from('webhook_logs')
        .insert(webhookData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.id).toBeDefined();
      expect(data.status).toBe('received'); // Status padrão
      expect(data.retry_count).toBe(0);
      expect(data.max_retries).toBe(5);
      expect(data.created_at).toBeDefined();

      testWebhookLogId = data.id;
    });

    test('should enforce status check constraints', async () => {
      const { error } = await supabase
        .from('webhook_logs')
        .insert({
          event_type: 'test.event',
          payload: { test: true },
          status: 'invalid_status' // Status inválido
        });

      expect(error).toBeTruthy();
      expect(error?.message).toContain('check constraint');
    });

    test('should handle JSONB payload correctly', async () => {
      const complexPayload = {
        invoice: {
          id: 'inv_456',
          items: [
            { description: 'Plan Pro', amount: 7900 },
            { description: 'Tax', amount: 100 }
          ],
          customer: {
            email: 'customer@example.com',
            metadata: { source: 'website' }
          }
        },
        timestamp: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('webhook_logs')
        .insert({
          event_type: 'invoice.created',
          event_id: 'evt_456',
          payload: complexPayload,
          provider: 'iugu'
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.payload).toEqual(complexPayload);

      // Limpar
      await supabase.from('webhook_logs').delete().eq('id', data.id);
    });

    test('should update webhook status and track retries', async () => {
      if (!testWebhookLogId) {
        throw new Error('Test webhook log not created');
      }

      // Atualizar para processing
      const { error: updateError1 } = await supabase
        .from('webhook_logs')
        .update({ 
          status: 'processing',
          processed_at: new Date().toISOString()
        })
        .eq('id', testWebhookLogId);

      expect(updateError1).toBeNull();

      // Simular falha e retry
      const { error: updateError2 } = await supabase
        .from('webhook_logs')
        .update({ 
          status: 'failed',
          error_message: 'Connection timeout',
          retry_count: 1,
          next_retry_at: new Date(Date.now() + 60000).toISOString() // 1 minuto
        })
        .eq('id', testWebhookLogId);

      expect(updateError2).toBeNull();

      // Verificar se foi atualizado
      const { data, error: selectError } = await supabase
        .from('webhook_logs')
        .select('status, retry_count, error_message')
        .eq('id', testWebhookLogId)
        .single();

      expect(selectError).toBeNull();
      expect(data.status).toBe('failed');
      expect(data.retry_count).toBe(1);
      expect(data.error_message).toBe('Connection timeout');
    });
  });

  describe('Payment Analytics Table Tests', () => {
    test('should create payment analytics record', async () => {
      const analyticsData = {
        date: '2024-01-15',
        plan_id: testPlanId,
        checkouts_started: 10,
        checkouts_completed: 8,
        checkouts_abandoned: 2,
        payments_confirmed: 8,
        payments_failed: 0,
        payments_pending: 0,
        revenue_total: 399.92,
        revenue_monthly: 399.92,
        revenue_annual: 0,
        conversion_rate: 80.00,
        average_time_to_complete: 300,
        abandonment_rate: 20.00
      };

      const { data, error } = await supabase
        .from('payment_analytics')
        .insert(analyticsData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.id).toBeDefined();
      expect(data.conversion_rate).toBe(80.00);
      expect(data.abandonment_rate).toBe(20.00);

      // Limpar
      await supabase.from('payment_analytics').delete().eq('id', data.id);
    });

    test('should enforce unique constraint on date and plan_id', async () => {
      const analyticsData = {
        date: '2024-01-16',
        plan_id: testPlanId,
        checkouts_started: 5,
        checkouts_completed: 4
      };

      // Inserir primeiro registro
      const { data: first, error: firstError } = await supabase
        .from('payment_analytics')
        .insert(analyticsData)
        .select()
        .single();

      expect(firstError).toBeNull();

      // Tentar inserir duplicata
      const { error: duplicateError } = await supabase
        .from('payment_analytics')
        .insert(analyticsData);

      expect(duplicateError).toBeTruthy();
      expect(duplicateError?.message).toContain('unique');

      // Limpar
      await supabase.from('payment_analytics').delete().eq('id', first.id);
    });

    test('should handle decimal precision correctly', async () => {
      const { data, error } = await supabase
        .from('payment_analytics')
        .insert({
          date: '2024-01-17',
          plan_id: testPlanId,
          revenue_total: 123.456789, // Mais casas decimais que o permitido
          conversion_rate: 85.123456
        })
        .select()
        .single();

      expect(error).toBeNull();
      // Verificar se foi arredondado corretamente
      expect(data.revenue_total).toBe('123.46'); // 2 casas decimais
      expect(data.conversion_rate).toBe('85.12'); // 2 casas decimais

      // Limpar
      await supabase.from('payment_analytics').delete().eq('id', data.id);
    });
  });

  describe('Webhook Retry Queue Tests', () => {
    test('should create retry queue entry', async () => {
      if (!testWebhookLogId) {
        throw new Error('Test webhook log not created');
      }

      const retryData = {
        webhook_log_id: testWebhookLogId,
        retry_attempt: 1,
        scheduled_for: new Date(Date.now() + 120000).toISOString() // 2 minutos
      };

      const { data, error } = await supabase
        .from('webhook_retry_queue')
        .insert(retryData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.status).toBe('pending');
      expect(data.retry_attempt).toBe(1);

      // Limpar
      await supabase.from('webhook_retry_queue').delete().eq('id', data.id);
    });

    test('should enforce foreign key constraint', async () => {
      const { error } = await supabase
        .from('webhook_retry_queue')
        .insert({
          webhook_log_id: '00000000-0000-0000-0000-000000000000',
          retry_attempt: 1,
          scheduled_for: new Date().toISOString()
        });

      expect(error).toBeTruthy();
      expect(error?.message).toContain('foreign key');
    });
  });

  describe('Utility Functions Tests', () => {
    test('should log webhook event using function', async () => {
      const { data: logId, error } = await supabase.rpc('log_webhook_event', {
        event_type_param: 'subscription.activated',
        event_id_param: 'evt_function_test',
        payload_param: {
          subscription_id: 'sub_123',
          status: 'active',
          customer_email: 'function-test@example.com'
        },
        provider_param: 'iugu',
        subscription_intent_id_param: testIntentId
      });

      expect(error).toBeNull();
      expect(logId).toBeTruthy();
      expect(typeof logId).toBe('string');

      // Verificar se foi criado
      const { data: log, error: selectError } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('id', logId)
        .single();

      expect(selectError).toBeNull();
      expect(log.event_type).toBe('subscription.activated');
      expect(log.event_id).toBe('evt_function_test');
      expect(log.subscription_intent_id).toBe(testIntentId);

      // Limpar
      await supabase.from('webhook_logs').delete().eq('id', logId);
    });

    test('should update webhook processing status using function', async () => {
      // Criar log primeiro
      const { data: logId, error: createError } = await supabase.rpc('log_webhook_event', {
        event_type_param: 'test.status_update',
        event_id_param: 'evt_status_test',
        payload_param: { test: true }
      });

      expect(createError).toBeNull();

      // Atualizar status
      const { data: updateResult, error: updateError } = await supabase.rpc('update_webhook_processing_status', {
        log_id_param: logId,
        new_status_param: 'completed',
        error_message_param: null,
        error_details_param: null
      });

      expect(updateError).toBeNull();
      expect(updateResult).toBe(true);

      // Verificar se foi atualizado
      const { data: updated, error: selectError } = await supabase
        .from('webhook_logs')
        .select('status, processed_at')
        .eq('id', logId)
        .single();

      expect(selectError).toBeNull();
      expect(updated.status).toBe('completed');
      expect(updated.processed_at).toBeTruthy();

      // Limpar
      await supabase.from('webhook_logs').delete().eq('id', logId);
    });

    test('should update daily analytics using function', async () => {
      const testDate = '2024-01-20';

      const { data: updateCount, error } = await supabase.rpc('update_daily_payment_analytics', {
        target_date: testDate,
        target_plan_id: testPlanId
      });

      expect(error).toBeNull();
      expect(updateCount).toBe(1);

      // Verificar se foi criado/atualizado
      const { data: analytics, error: selectError } = await supabase
        .from('payment_analytics')
        .select('*')
        .eq('date', testDate)
        .eq('plan_id', testPlanId)
        .single();

      expect(selectError).toBeNull();
      expect(analytics).toBeTruthy();

      // Limpar
      await supabase.from('payment_analytics').delete().eq('id', analytics.id);
    });

    test('should cleanup old webhook logs using function', async () => {
      // Criar log antigo
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 dias atrás
      
      const { data: oldLog, error: createError } = await supabase
        .from('webhook_logs')
        .insert({
          event_type: 'old.event',
          payload: { old: true },
          status: 'completed',
          created_at: oldDate.toISOString()
        })
        .select()
        .single();

      expect(createError).toBeNull();

      // Executar cleanup
      const { data: deletedCount, error: cleanupError } = await supabase.rpc('cleanup_old_webhook_logs', {
        retention_days: 90
      });

      expect(cleanupError).toBeNull();
      expect(typeof deletedCount).toBe('number');

      // Verificar se foi deletado
      const { data: deleted, error: selectError } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('id', oldLog.id)
        .single();

      expect(selectError).toBeTruthy(); // Deve dar erro pois foi deletado
      expect(deleted).toBeNull();
    });

    test('should get pending webhook retries using function', async () => {
      // Criar webhook log com retry pendente
      const { data: logId, error: createError } = await supabase.rpc('log_webhook_event', {
        event_type_param: 'test.retry',
        event_id_param: 'evt_retry_test',
        payload_param: { retry_test: true }
      });

      expect(createError).toBeNull();

      // Adicionar à fila de retry
      const { data: queueEntry, error: queueError } = await supabase
        .from('webhook_retry_queue')
        .insert({
          webhook_log_id: logId,
          retry_attempt: 1,
          scheduled_for: new Date(Date.now() - 1000).toISOString() // 1 segundo atrás
        })
        .select()
        .single();

      expect(queueError).toBeNull();

      // Buscar retries pendentes
      const { data: pendingRetries, error: retriesError } = await supabase.rpc('get_pending_webhook_retries', {
        limit_param: 10
      });

      expect(retriesError).toBeNull();
      expect(Array.isArray(pendingRetries)).toBe(true);
      
      const ourRetry = pendingRetries.find(r => r.webhook_log_id === logId);
      expect(ourRetry).toBeTruthy();
      expect(ourRetry.event_type).toBe('test.retry');

      // Limpar
      await supabase.from('webhook_retry_queue').delete().eq('id', queueEntry.id);
      await supabase.from('webhook_logs').delete().eq('id', logId);
    });
  });

  describe('Performance Tests', () => {
    beforeAll(async () => {
      // Criar dados de teste para performance
      const webhookLogs = Array.from({ length: 50 }, (_, i) => ({
        event_type: `test.performance.${i % 5}`,
        event_id: `evt_perf_${i}`,
        payload: { index: i, test: 'performance' },
        status: ['received', 'processing', 'completed', 'failed'][i % 4],
        provider: 'iugu'
      }));

      await supabase.from('webhook_logs').insert(webhookLogs);

      const analyticsData = Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        plan_id: testPlanId,
        checkouts_started: Math.floor(Math.random() * 20) + 5,
        checkouts_completed: Math.floor(Math.random() * 15) + 3,
        revenue_total: Math.random() * 1000 + 100
      }));

      await supabase.from('payment_analytics').insert(analyticsData);
    });

    afterAll(async () => {
      // Limpar dados de performance
      await supabase.from('webhook_logs').delete().like('event_id', 'evt_perf_%');
      await supabase.from('payment_analytics').delete().eq('plan_id', testPlanId);
    });

    test('should perform fast queries on webhook_logs by status', async () => {
      const startTime = Date.now();
      
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('status', 'completed')
        .limit(20);

      const queryTime = Date.now() - startTime;

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(queryTime).toBeLessThan(1000); // Menos de 1 segundo
    });

    test('should perform fast queries on payment_analytics by date range', async () => {
      const startTime = Date.now();
      
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('payment_analytics')
        .select('*')
        .gte('date', thirtyDaysAgo)
        .lte('date', today)
        .eq('plan_id', testPlanId);

      const queryTime = Date.now() - startTime;

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(queryTime).toBeLessThan(1000); // Menos de 1 segundo
    });

    test('should perform fast aggregation queries on analytics', async () => {
      const startTime = Date.now();
      
      const { data, error } = await supabase
        .from('payment_analytics')
        .select('revenue_total.sum(), checkouts_started.sum(), checkouts_completed.sum()')
        .eq('plan_id', testPlanId);

      const queryTime = Date.now() - startTime;

      expect(error).toBeNull();
      expect(queryTime).toBeLessThan(1500); // Menos de 1.5 segundos
    });
  });
});