/**
 * Testes de Integração de Resiliência
 * 
 * Testa a integração completa de todos os componentes de resiliência
 */

import { CircuitBreakerFactory } from '@/lib/resilience/circuit-breaker';
import { RetryManager } from '@/lib/resilience/retry-manager';
import { gracefulDegradation } from '@/lib/resilience/graceful-degradation';
import { resilientDb } from '@/lib/resilience/database-resilience';
import { degradedCheckout } from '@/lib/checkout/degraded-checkout';
import { backupService } from '@/lib/backup/backup-service';
import { replicationService } from '@/lib/backup/replication-service';

// Mock dos serviços externos
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/iugu/iugu-service');

describe('Resilience Integration Tests', () => {
  beforeAll(() => {
    // Configura ambiente de teste
    process.env.NODE_ENV = 'test';
  });

  beforeEach(() => {
    // Reset estado entre testes
    CircuitBreakerFactory.resetAll();
    gracefulDegradation.stopHealthMonitoring();
    jest.clearAllMocks();
  });

  afterEach(() => {
    gracefulDegradation.stopHealthMonitoring();
  });

  describe('Fluxo Completo de Checkout Resiliente', () => {
    it('deve processar checkout com todos os componentes de resiliência', async () => {
      // Configura mocks para simular ambiente real
      const mockSupabaseClient = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [{ id: 'intent_123', status: 'pending' }],
              error: null
            })
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [{ id: 'intent_123', status: 'completed' }],
                error: null
              })
            })
          })
        })
      };

      const { createClient } = require('@/lib/supabase/server');
      createClient.mockResolvedValue(mockSupabaseClient);

      // Mock do Iugu funcionando
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: 'customer_123',
          email: 'test@example.com'
        })
      });

      const checkoutRequest = {
        plan_id: 'plan_integration_test',
        billing_cycle: 'monthly' as const,
        organization_id: 'org_integration_test',
        user_data: {
          name: 'Integration Test User',
          email: 'integration@example.com',
          organization_name: 'Integration Test Org'
        }
      };

      // Executa checkout
      const result = await degradedCheckout.processCheckout(checkoutRequest);

      expect(result.success).toBe(true);
      expect(result.mode).toBe('normal');
      expect(result.intent_id).toBeDefined();
      expect(result.checkout_url).toBeDefined();
    });

    it('deve usar circuit breaker e retry em conjunto', async () => {
      const circuitBreaker = CircuitBreakerFactory.getIuguCircuitBreaker();
      const retryManager = RetryManager.forIuguAPI();

      let attemptCount = 0;
      const flakyOperation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return Promise.reject(new Error('500 Server Error'));
        }
        return Promise.resolve('success after retries');
      });

      // Executa operação com circuit breaker e retry
      const result = await circuitBreaker.execute(async () => {
        return retryManager.execute(flakyOperation, 'flaky-operation');
      });

      expect(result).toBe('success after retries');
      expect(attemptCount).toBe(3); // 2 falhas + 1 sucesso
      expect(circuitBreaker.getMetrics().state).toBe('closed');
    });

    it('deve usar graceful degradation quando circuit breaker abre', async () => {
      const circuitBreaker = CircuitBreakerFactory.getIuguCircuitBreaker();

      // Força circuit breaker para estado aberto
      const failingOperation = jest.fn().mockRejectedValue(new Error('Service down'));
      
      // Executa falhas suficientes para abrir circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Ignora erros para forçar abertura
        }
      }

      expect(circuitBreaker.getMetrics().state).toBe('open');

      // Agora usa graceful degradation
      const result = await gracefulDegradation.executeWithFallback(
        'iugu',
        async () => {
          return circuitBreaker.execute(async () => 'should not reach here');
        },
        'degraded-operation'
      );

      expect(result).toEqual({
        status: 'fallback_mode',
        message: expect.stringContaining('temporariamente indisponível'),
        checkout_url: '/checkout/fallback',
        fallback: true
      });
    });
  });

  describe('Integração Database Resilience', () => {
    it('deve usar retry e fallback para operações de banco', async () => {
      let attemptCount = 0;
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockImplementation(() => {
            attemptCount++;
            if (attemptCount <= 2) {
              return Promise.resolve({ 
                data: null, 
                error: new Error('Connection timeout') 
              });
            }
            return Promise.resolve({ 
              data: [{ id: 'intent_123' }], 
              error: null 
            });
          })
        })
      };

      const { createClient } = require('@/lib/supabase/server');
      createClient.mockResolvedValue(mockClient);

      // Executa operação resiliente
      const result = await resilientDb.execute({
        operation: async (client) => {
          const { data, error } = await client
            .from('subscription_intents')
            .select('*');
          
          if (error) throw error;
          return data;
        },
        operationName: 'get-subscription-intents'
      });

      expect(result).toEqual([{ id: 'intent_123' }]);
      expect(attemptCount).toBe(3); // 2 falhas + 1 sucesso
    });

    it('deve usar cache de fallback quando banco falha completamente', async () => {
      // Mock que sempre falha
      const { createClient } = require('@/lib/supabase/server');
      createClient.mockRejectedValue(new Error('Database completely down'));

      // Salva dados no cache de fallback
      resilientDb.cacheFallbackData('test-key', { id: 'cached_123' });

      // Tenta operação com fallback
      const result = await resilientDb.executeWithFallback({
        operation: async (client) => {
          const { data, error } = await client
            .from('subscription_intents')
            .select('*');
          
          if (error) throw error;
          return data;
        },
        operationName: 'get-cached-data'
      }, 'test-key', { id: 'cached_123' });

      expect(result).toEqual({ id: 'cached_123' });
    });
  });

  describe('Integração Backup e Replicação', () => {
    it('deve criar backup e replicar dados simultaneamente', async () => {
      // Mock do banco para backup
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [
              { id: 'intent_1', status: 'pending' },
              { id: 'intent_2', status: 'completed' }
            ],
            error: null
          })
        })
      };

      const { createClient } = require('@/lib/supabase/server');
      createClient.mockResolvedValue(mockClient);

      // Cria backup
      const backup = await backupService.createCriticalDataBackup();
      expect(backup.status).toBe('completed');

      // Simula replicação
      await replicationService.logChange(
        'subscription_intents',
        'insert',
        'intent_new',
        { id: 'intent_new', status: 'pending' }
      );

      // Força sincronização
      await replicationService.forcSync();

      const replicationStatus = replicationService.getSyncStatus();
      expect(Object.keys(replicationStatus)).toContain('redis-cache');
      expect(Object.keys(replicationStatus)).toContain('local-backup');
    });

    it('deve recuperar dados de replicação quando backup principal falha', async () => {
      // Simula dados replicados
      await replicationService.logChange(
        'subscription_intents',
        'insert',
        'replicated_123',
        { id: 'replicated_123', status: 'pending' }
      );

      // Recupera dados
      const recoveredData = await replicationService.recoverFromTarget(
        'local-backup',
        'subscription_intents',
        'replicated_123'
      );

      expect(Array.isArray(recoveredData)).toBe(true);
    });
  });

  describe('Monitoramento e Health Checks', () => {
    it('deve monitorar saúde de todos os serviços', async () => {
      // Mock de serviços saudáveis
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ error: null })
          })
        })
      };

      const { createClient } = require('@/lib/supabase/server');
      createClient.mockResolvedValue(mockClient);

      // Verifica saúde de todos os serviços
      const iuguHealth = await gracefulDegradation.checkServiceHealth('iugu');
      const dbHealth = await gracefulDegradation.checkServiceHealth('database');
      const featureGateHealth = await gracefulDegradation.checkServiceHealth('feature-gate');

      expect(iuguHealth.status).toBe('healthy');
      expect(dbHealth.status).toBe('healthy');
      expect(featureGateHealth.status).toBe('healthy');

      expect(gracefulDegradation.isSystemDegraded()).toBe(false);
      expect(gracefulDegradation.getDegradationLevel()).toBe(0);
    });

    it('deve detectar degradação do sistema', async () => {
      // Mock de serviços com problemas
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500
      });

      // Verifica saúde e detecta problemas
      await gracefulDegradation.checkServiceHealth('iugu');
      await gracefulDegradation.checkServiceHealth('iugu'); // Segunda falha

      expect(gracefulDegradation.isSystemDegraded()).toBe(true);
      expect(gracefulDegradation.getDegradationLevel()).toBeGreaterThan(0);
    });
  });

  describe('Cenários de Recovery', () => {
    it('deve executar recovery completo do sistema', async () => {
      // Simula estado degradado
      const circuitBreaker = CircuitBreakerFactory.getIuguCircuitBreaker();
      circuitBreaker.forceState('open');

      // Força serviços para estado degradado
      await gracefulDegradation.checkServiceHealth('iugu');
      await gracefulDegradation.checkServiceHealth('database');

      expect(gracefulDegradation.isSystemDegraded()).toBe(true);

      // Simula recovery - serviços voltam
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ error: null })
          })
        })
      };

      const { createClient } = require('@/lib/supabase/server');
      createClient.mockResolvedValue(mockClient);

      // Reset manual dos serviços
      circuitBreaker.reset();
      gracefulDegradation.resetService('iugu');
      gracefulDegradation.resetService('database');

      // Verifica recovery
      const iuguHealth = await gracefulDegradation.checkServiceHealth('iugu');
      const dbHealth = await gracefulDegradation.checkServiceHealth('database');

      expect(iuguHealth.status).toBe('healthy');
      expect(dbHealth.status).toBe('healthy');
      expect(gracefulDegradation.isSystemDegraded()).toBe(false);
    });

    it('deve processar intents pendentes após recovery', async () => {
      // Simula intents criados durante degradação
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [
              { id: 'intent_pending_1', status: 'degraded_pending' },
              { id: 'intent_pending_2', status: 'degraded_pending' }
            ],
            error: null
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [{ id: 'intent_pending_1', status: 'processing' }],
                error: null
              })
            })
          })
        })
      };

      const { createClient } = require('@/lib/supabase/server');
      createClient.mockResolvedValue(mockClient);

      // Mock Iugu funcionando
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'customer_recovered' })
      });

      // Processa intents pendentes
      await expect(degradedCheckout.processPendingIntents()).resolves.not.toThrow();
    });
  });

  describe('Performance sob Stress', () => {
    it('deve manter performance aceitável sob carga', async () => {
      // Mock de operações rápidas
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'fast_customer' })
      });

      const mockClient = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [{ id: 'fast_intent' }],
              error: null
            })
          })
        })
      };

      const { createClient } = require('@/lib/supabase/server');
      createClient.mockResolvedValue(mockClient);

      const requests = Array(20).fill(null).map((_, i) => ({
        plan_id: 'plan_stress',
        billing_cycle: 'monthly' as const,
        organization_id: `org_stress_${i}`,
        user_data: {
          name: `Stress User ${i}`,
          email: `stress${i}@example.com`,
          organization_name: `Stress Org ${i}`
        }
      }));

      const startTime = Date.now();
      
      const results = await Promise.all(
        requests.map(req => degradedCheckout.processCheckout(req))
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Todos devem ter sucesso
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Deve processar em menos de 5 segundos
      expect(duration).toBeLessThan(5000);

      console.log(`Processed ${requests.length} checkouts in ${duration}ms`);
    });
  });

  describe('Validação de Métricas', () => {
    it('deve coletar métricas de todos os componentes', () => {
      // Métricas do circuit breaker
      const cbMetrics = CircuitBreakerFactory.getAllMetrics();
      expect(typeof cbMetrics).toBe('object');

      // Status dos serviços
      const servicesStatus = gracefulDegradation.getServicesStatus();
      expect(typeof servicesStatus).toBe('object');

      // Status de replicação
      const replicationStatus = replicationService.getSyncStatus();
      expect(typeof replicationStatus).toBe('object');

      // Histórico de backup
      const backupHistory = backupService.getBackupHistory();
      expect(Array.isArray(backupHistory)).toBe(true);

      // Health da replicação
      const replicationHealth = replicationService.getHealthStatus();
      expect(replicationHealth).toHaveProperty('healthy');
      expect(replicationHealth).toHaveProperty('targets');
      expect(replicationHealth).toHaveProperty('pendingLogs');
      expect(replicationHealth).toHaveProperty('failedLogs');
    });
  });
});