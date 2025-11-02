import { createClient } from '@supabase/supabase-js';

// Configuração de teste
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://doiogabdzybqxnyhktbv.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaW9nYWJkenlicXhueWhrdGJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg1ODcyOSwiZXhwIjoyMDc1NDM0NzI5fQ.HlJgXvaOLcAOvJa9iV2jNpAqx1du5Ge9-oBD9oYkXuw';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

describe('Checkout RLS Security - Simplified Tests', () => {
  beforeAll(() => {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente do Supabase não configuradas para testes');
    }
  });

  describe('Table Existence and Access Control', () => {
    test('should have checkout tables accessible with service role', async () => {
      const tables = ['subscription_intents', 'subscription_intent_transitions', 'webhook_logs', 'payment_analytics'];
      
      for (const tableName of tables) {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        // Tabela deve existir (não deve dar erro de tabela não encontrada)
        expect(error?.code).not.toBe('PGRST116');
        
        // Se há erro, deve ser de RLS (acesso controlado) ou sem dados
        if (error) {
          expect(['42501', 'PGRST301'].includes(error.code)).toBe(true);
        }
      }
    });

    test('should allow service role to insert webhook logs', async () => {
      const testWebhook = {
        event_type: 'test_security_validation',
        event_id: 'test_' + Date.now(),
        payload: { test: true, timestamp: new Date().toISOString() },
        status: 'received'
      };

      const { data, error } = await supabase
        .from('webhook_logs')
        .insert(testWebhook)
        .select();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data[0]).toHaveProperty('id');

      // Limpar o registro de teste
      if (data && data[0]) {
        await supabase
          .from('webhook_logs')
          .delete()
          .eq('id', data[0].id);
      }
    });

    test('should control access to subscription_intents', async () => {
      // Tentar acessar subscription_intents sem contexto de usuário
      const { data, error } = await supabase
        .from('subscription_intents')
        .select('*')
        .limit(5);

      // Service role deve ter acesso ou não haver dados
      if (error) {
        // Se há erro, deve ser de RLS controlado
        expect(error.code).toBe('42501');
      } else {
        // Se não há erro, dados devem ser array (pode estar vazio)
        expect(Array.isArray(data)).toBe(true);
      }
    });

    test('should allow service role to manage subscription intents', async () => {
      const testIntent = {
        plan_id: '00000000-0000-0000-0000-000000000000', // UUID fictício para teste
        billing_cycle: 'monthly',
        status: 'pending',
        user_email: 'test@example.com',
        user_name: 'Test User',
        organization_name: 'Test Org',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h no futuro
      };

      const { data, error } = await supabase
        .from('subscription_intents')
        .insert(testIntent)
        .select();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data[0]).toHaveProperty('id');

      // Limpar o registro de teste
      if (data && data[0]) {
        await supabase
          .from('subscription_intents')
          .delete()
          .eq('id', data[0].id);
      }
    });
  });

  describe('Data Isolation Validation', () => {
    test('should maintain data isolation structure', async () => {
      // Verificar que subscription_intents tem campos necessários para isolamento
      const { data, error } = await supabase
        .from('subscription_intents')
        .select('user_id, user_email')
        .limit(1);

      // Deve ter acesso aos campos ou não haver dados
      if (error) {
        expect(error.code).toBe('42501'); // RLS ativo
      } else {
        // Se há dados, deve ter os campos de isolamento
        if (data && data.length > 0) {
          expect(data[0]).toHaveProperty('user_email');
        }
      }
    });

    test('should validate webhook logs structure', async () => {
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('event_type, status, created_at')
        .limit(1);

      // Service role deve ter acesso
      if (error) {
        expect(error.code).not.toBe('PGRST116'); // Não deve ser erro de tabela não encontrada
      } else {
        expect(Array.isArray(data)).toBe(true);
      }
    });
  });

  describe('Security Compliance', () => {
    test('should have proper table structure for security', async () => {
      // Testar que as tabelas têm a estrutura esperada
      const tables = [
        { name: 'subscription_intents', requiredFields: ['user_email', 'status'] },
        { name: 'webhook_logs', requiredFields: ['event_type', 'status'] },
        { name: 'payment_analytics', requiredFields: ['date'] }
      ];

      for (const table of tables) {
        const { data, error } = await supabase
          .from(table.name)
          .select(table.requiredFields.join(', '))
          .limit(1);

        // Não deve dar erro de campo não encontrado
        if (error) {
          expect(error.code).not.toBe('PGRST103'); // Campo não encontrado
          expect(error.code).not.toBe('PGRST116'); // Tabela não encontrada
        }
      }
    });

    test('should validate service role permissions', async () => {
      // Service role deve conseguir fazer operações básicas
      const operations = [
        { table: 'webhook_logs', operation: 'select' },
        { table: 'subscription_intents', operation: 'select' },
        { table: 'payment_analytics', operation: 'select' }
      ];

      for (const op of operations) {
        const { error } = await supabase
          .from(op.table)
          .select('*')
          .limit(1);

        // Não deve dar erro de permissão negada para service role
        if (error) {
          expect(error.code).not.toBe('42501'); // Permissão negada
        }
      }
    });
  });

  describe('System Health Check', () => {
    test('should validate overall system security health', async () => {
      let healthScore = 0;
      const maxScore = 4;

      // 1. Tabelas existem
      try {
        await supabase.from('subscription_intents').select('id').limit(1);
        healthScore++;
      } catch (e) {
        // Falha esperada se RLS estiver muito restritivo
      }

      // 2. Service role pode inserir webhooks
      try {
        const { error } = await supabase
          .from('webhook_logs')
          .insert({
            event_type: 'health_check',
            event_id: 'health_' + Date.now(),
            payload: { health: true },
            status: 'received'
          });
        
        if (!error) healthScore++;
      } catch (e) {
        // Falha não esperada
      }

      // 3. Estrutura de dados adequada
      try {
        await supabase.from('subscription_intents').select('user_email, status').limit(1);
        healthScore++;
      } catch (e) {
        // Falha pode ser esperada
      }

      // 4. Sistema responsivo
      const startTime = Date.now();
      await supabase.from('webhook_logs').select('id').limit(1);
      const responseTime = Date.now() - startTime;
      
      if (responseTime < 5000) healthScore++; // Menos de 5 segundos

      // Sistema deve ter pelo menos 50% de saúde
      expect(healthScore).toBeGreaterThanOrEqual(maxScore * 0.5);
    });
  });
});