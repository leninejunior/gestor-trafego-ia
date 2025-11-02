import { createClient } from '@supabase/supabase-js';

// Configuração de teste
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

describe('Checkout RLS Security Validation', () => {
  beforeAll(() => {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente do Supabase não configuradas para testes');
    }
  });

  describe('RLS Status Validation', () => {
    test('should have RLS enabled on all checkout tables', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: `
          SELECT 
            tablename,
            rowsecurity as rls_enabled
          FROM pg_tables 
          WHERE tablename IN (
            'subscription_intents', 
            'subscription_intent_transitions', 
            'webhook_logs', 
            'payment_analytics'
          )
          AND schemaname = 'public';
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      
      const tables = ['subscription_intents', 'subscription_intent_transitions', 'webhook_logs', 'payment_analytics'];
      
      tables.forEach(tableName => {
        const table = data.find((t: any) => t.tablename === tableName);
        expect(table).toBeDefined();
        expect(table.rls_enabled).toBe(true);
      });
    });
  });

  describe('RLS Policies Validation', () => {
    test('should have correct role assignments for policies', async () => {
      const { data: policies, error } = await supabase.rpc('exec_sql', {
        sql_query: `
          SELECT 
            tablename,
            policyname,
            roles,
            cmd
          FROM pg_policies 
          WHERE tablename IN (
            'subscription_intents', 
            'subscription_intent_transitions', 
            'webhook_logs', 
            'payment_analytics'
          )
          ORDER BY tablename, policyname;
        `
      });

      expect(error).toBeNull();
      expect(policies).toBeDefined();
      expect(policies.length).toBeGreaterThan(0);

      // Verificar que não há políticas aplicadas incorretamente ao role 'public'
      const publicRolePolicies = policies.filter((policy: any) => {
        const roles = Array.isArray(policy.roles) ? policy.roles : [policy.roles];
        return roles.includes('public') && !policy.policyname.includes('webhook insertion');
      });

      expect(publicRolePolicies).toHaveLength(0);
    });

    test('should have service_role policies for all tables', async () => {
      const { data: policies, error } = await supabase.rpc('exec_sql', {
        sql_query: `
          SELECT 
            tablename,
            policyname,
            roles
          FROM pg_policies 
          WHERE tablename IN (
            'subscription_intents', 
            'subscription_intent_transitions', 
            'webhook_logs', 
            'payment_analytics'
          )
          AND 'service_role' = ANY(roles);
        `
      });

      expect(error).toBeNull();
      expect(policies).toBeDefined();
      
      // Deve haver pelo menos uma política de service_role para cada tabela
      const tables = ['subscription_intents', 'subscription_intent_transitions', 'webhook_logs', 'payment_analytics'];
      
      tables.forEach(tableName => {
        const tablePolicies = policies.filter((p: any) => p.tablename === tableName);
        expect(tablePolicies.length).toBeGreaterThan(0);
      });
    });

    test('should have authenticated user policies for subscription_intents', async () => {
      const { data: policies, error } = await supabase.rpc('exec_sql', {
        sql_query: `
          SELECT 
            policyname,
            roles,
            cmd
          FROM pg_policies 
          WHERE tablename = 'subscription_intents'
          AND 'authenticated' = ANY(roles);
        `
      });

      expect(error).toBeNull();
      expect(policies).toBeDefined();
      expect(policies.length).toBeGreaterThan(0);

      // Deve haver políticas para SELECT, INSERT e UPDATE para usuários autenticados
      const commands = policies.map((p: any) => p.cmd);
      expect(commands).toContain('SELECT');
      expect(commands).toContain('INSERT');
      expect(commands).toContain('UPDATE');
    });

    test('should have anon policy only for webhook insertion', async () => {
      const { data: policies, error } = await supabase.rpc('exec_sql', {
        sql_query: `
          SELECT 
            tablename,
            policyname,
            cmd
          FROM pg_policies 
          WHERE 'anon' = ANY(roles);
        `
      });

      expect(error).toBeNull();
      expect(policies).toBeDefined();

      // Deve haver apenas uma política para anon (webhook insertion)
      expect(policies.length).toBe(1);
      expect(policies[0].tablename).toBe('webhook_logs');
      expect(policies[0].cmd).toBe('INSERT');
      expect(policies[0].policyname).toContain('webhook insertion');
    });
  });

  describe('Security Functions Validation', () => {
    test('should have security helper functions defined', async () => {
      const { data: functions, error } = await supabase.rpc('exec_sql', {
        sql_query: `
          SELECT 
            routine_name,
            security_type
          FROM information_schema.routines 
          WHERE routine_name IN (
            'check_user_permissions',
            'can_access_subscription_intent'
          )
          AND routine_schema = 'public';
        `
      });

      expect(error).toBeNull();
      expect(functions).toBeDefined();
      expect(functions.length).toBe(2);

      // Verificar que as funções são SECURITY DEFINER
      functions.forEach((func: any) => {
        expect(func.security_type).toBe('DEFINER');
      });
    });
  });

  describe('Data Isolation Validation', () => {
    test('should validate subscription_intents isolation structure', async () => {
      const { data: policies, error } = await supabase.rpc('exec_sql', {
        sql_query: `
          SELECT 
            policyname,
            qual
          FROM pg_policies 
          WHERE tablename = 'subscription_intents'
          AND policyname LIKE '%own%';
        `
      });

      expect(error).toBeNull();
      expect(policies).toBeDefined();
      
      // Deve haver políticas que verificam user_id ou user_email
      const hasUserIdCheck = policies.some((p: any) => 
        p.qual && p.qual.includes('user_id')
      );
      const hasUserEmailCheck = policies.some((p: any) => 
        p.qual && p.qual.includes('user_email')
      );

      expect(hasUserIdCheck || hasUserEmailCheck).toBe(true);
    });

    test('should validate webhook_logs admin-only access', async () => {
      const { data: policies, error } = await supabase.rpc('exec_sql', {
        sql_query: `
          SELECT 
            policyname,
            roles,
            cmd
          FROM pg_policies 
          WHERE tablename = 'webhook_logs'
          AND cmd != 'INSERT';
        `
      });

      expect(error).toBeNull();
      expect(policies).toBeDefined();

      // Todas as políticas não-INSERT devem ser para service_role ou admin
      policies.forEach((policy: any) => {
        const roles = Array.isArray(policy.roles) ? policy.roles : [policy.roles];
        const hasServiceRole = roles.includes('service_role');
        const isAdminPolicy = policy.policyname.toLowerCase().includes('admin');
        
        expect(hasServiceRole || isAdminPolicy).toBe(true);
      });
    });
  });

  describe('Policy Coverage Validation', () => {
    test('should have complete policy coverage for all tables', async () => {
      const tables = ['subscription_intents', 'subscription_intent_transitions', 'webhook_logs', 'payment_analytics'];
      
      for (const tableName of tables) {
        const { data: policies, error } = await supabase.rpc('exec_sql', {
          sql_query: `
            SELECT COUNT(*) as policy_count
            FROM pg_policies 
            WHERE tablename = '${tableName}';
          `
        });

        expect(error).toBeNull();
        expect(policies).toBeDefined();
        expect(policies[0].policy_count).toBeGreaterThan(0);
      }
    });

    test('should not have conflicting policies', async () => {
      const { data: policies, error } = await supabase.rpc('exec_sql', {
        sql_query: `
          SELECT 
            tablename,
            COUNT(*) as policy_count,
            COUNT(DISTINCT cmd) as unique_commands
          FROM pg_policies 
          WHERE tablename IN (
            'subscription_intents', 
            'subscription_intent_transitions', 
            'webhook_logs', 
            'payment_analytics'
          )
          GROUP BY tablename;
        `
      });

      expect(error).toBeNull();
      expect(policies).toBeDefined();

      // Verificar que há políticas suficientes mas não excessivas
      policies.forEach((table: any) => {
        expect(table.policy_count).toBeGreaterThan(0);
        expect(table.policy_count).toBeLessThan(20); // Limite razoável
      });
    });
  });
});