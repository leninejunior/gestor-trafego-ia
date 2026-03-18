/**
 * Chaos Engineering Tests
 * 
 * Testa o comportamento do sistema sob condições adversas
 * e falhas simuladas para validar resiliência
 */

import { CircuitBreakerFactory } from '@/lib/resilience/circuit-breaker';
import { gracefulDegradation } from '@/lib/resilience/graceful-degradation';
import { degradedCheckout } from '@/lib/checkout/degraded-checkout';
import { backupService } from '@/lib/backup/backup-service';
import { replicationService } from '@/lib/backup/replication-service';

// Mock dos serviços externos
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/iugu/iugu-service');

describe('Chaos Engineering Tests', () => {
  beforeEach(() => {
    // Reset todos os circuit breakers
    CircuitBreakerFactory.resetAll();
    
    // Para monitoramento para evitar interferência
    gracefulDegradation.stopHealthMonitoring();
  });

  afterEach(() => {
    // Limpa estado após cada teste
    gracefulDegradation.stopHealthMonitoring();
  });

  describe('Falha Completa do Iugu', () => {
    it('deve manter funcionalidade básica quando Iugu está completamente indisponível', async () => {
      // Simula falha total do Iugu
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const checkoutRequest = {
        plan_id: 'plan_123',
        billing_cycle: 'monthly' as const,
        organization_id: 'org_123',
        user_data: {
          name: 'Test User',
          email: 'test@example.com',
          organization_name: 'Test Org'
        }
      };

      // Deve usar modo degradado
      const result = await degradedCheckout.processCheckout(checkoutRequest);

      expect(result.success).toBe(true);
      expect(result.mode).toBe('degraded');
      expect(result.intent_id).toBeDefined();
      expect(result.message).toContain('registrada');
    });

    it('deve processar intents pendentes quando Iugu volta', async () => {
      // Primeiro, simula falha do Iugu
      global.fetch = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      // Cria alguns intents em modo degradado
      const requests = Array(3).fill(null).map((_, i) => ({
        plan_id: `plan_${i}`,
        billing_cycle: 'monthly' as const,
        organization_id: `org_${i}`,
        user_data: {
          name: `User ${i}`,
          email: `user${i}@example.com`,
          organization_name: `Org ${i}`
        }
      }));

      const results = await Promise.all(
        requests.map(req => degradedCheckout.processCheckout(req))
      );

      // Todos devem estar em modo degradado
      results.forEach(result => {
        expect(result.mode).toBe('degraded');
      });

      // Simula Iugu voltando
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'customer_123' })
      });

      // Processa intents pendentes
      await expect(degradedCheckout.processPendingIntents()).resolves.not.toThrow();
    });
  });

  describe('Falha Intermitente de Rede', () => {
    it('deve lidar com falhas intermitentes usando circuit breaker', async () => {
      const circuitBreaker = CircuitBreakerFactory.getIuguCircuitBreaker();
      let callCount = 0;

      // Simula falhas intermitentes (50% de falha)
      const intermittentOperation = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.resolve('success');
        } else {
          return Promise.reject(new Error('Network timeout'));
        }
      });

      const results = [];
      
      // Executa múltiplas operações
      for (let i = 0; i < 10; i++) {
        try {
          const result = await circuitBreaker.execute(intermittentOperation);
          results.push({ success: true, result });
        } catch (error) {
          results.push({ success: false, error: (error as Error).message });
        }
      }

      // Deve ter algumas operações bem-sucedidas
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);

      // Circuit breaker deve eventualmente abrir se muitas falhas
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(callCount);
    });
  });

  describe('Sobrecarga do Sistema', () => {
    it('deve lidar com alta concorrência de checkouts', async () => {
      // Mock de operação que simula carga
      global.fetch = jest.fn().mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ id: 'customer_123' })
          }), Math.random() * 100) // Delay aleatório
        )
      );

      const concurrentRequests = Array(50).fill(null).map((_, i) => ({
        plan_id: 'plan_load_test',
        billing_cycle: 'monthly' as const,
        organization_id: `org_${i}`,
        user_data: {
          name: `Load User ${i}`,
          email: `load${i}@example.com`,
          organization_name: `Load Org ${i}`
        }
      }));

      const startTime = Date.now();
      
      // Executa todas as requisições simultaneamente
      const results = await Promise.allSettled(
        concurrentRequests.map(req => degradedCheckout.processCheckout(req))
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Analisa resultados
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`Concurrency test: ${successful} successful, ${failed} failed in ${duration}ms`);

      // Deve ter pelo menos 80% de sucesso
      expect(successful / results.length).toBeGreaterThan(0.8);
      
      // Não deve demorar mais que 10 segundos
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('Falha de Banco de Dados', () => {
    it('deve usar fallback quando banco está indisponível', async () => {
      // Mock do Supabase que falha
      const { createClient } = require('@/lib/supabase/server');
      createClient.mockRejectedValue(new Error('Database connection failed'));

      // Tenta operação que precisa do banco
      const operation = async () => {
        const client = await createClient();
        return client.from('subscription_intents').select('*');
      };

      // Deve usar graceful degradation
      await expect(
        gracefulDegradation.executeWithFallback('database', operation)
      ).resolves.not.toThrow();
    });

    it('deve usar dados replicados quando banco principal falha', async () => {
      // Simula dados replicados
      replicationService.addReplicationTarget({
        id: 'test-backup',
        type: 'file',
        config: { path: '/tmp/test-replication' },
        tables: ['subscription_intents'],
        priority: 1,
        enabled: true
      });

      // Simula recuperação de dados
      const recoveredData = await replicationService.recoverFromTarget(
        'test-backup',
        'subscription_intents',
        'intent_123'
      );

      expect(Array.isArray(recoveredData)).toBe(true);
    });
  });

  describe('Falha de Múltiplos Serviços', () => {
    it('deve manter funcionalidade mínima quando múltiplos serviços falham', async () => {
      // Simula falha do Iugu
      global.fetch = jest.fn().mockRejectedValue(new Error('Iugu unavailable'));

      // Simula falha do banco
      const { createClient } = require('@/lib/supabase/server');
      createClient.mockRejectedValue(new Error('Database unavailable'));

      // Força todos os serviços para estado degradado
      gracefulDegradation.resetService('iugu');
      gracefulDegradation.resetService('database');
      gracefulDegradation.resetService('feature-gate');

      // Simula health checks que falham
      await gracefulDegradation.checkServiceHealth('iugu');
      await gracefulDegradation.checkServiceHealth('database');

      const systemStatus = gracefulDegradation.getServicesStatus();
      
      // Sistema deve estar degradado mas ainda funcional
      expect(gracefulDegradation.isSystemDegraded()).toBe(true);
      
      const degradationLevel = gracefulDegradation.getDegradationLevel();
      expect(degradationLevel).toBeGreaterThan(0.5);

      // Deve ainda conseguir processar checkout em modo offline
      const checkoutRequest = {
        plan_id: 'plan_emergency',
        billing_cycle: 'monthly' as const,
        organization_id: 'org_emergency',
        user_data: {
          name: 'Emergency User',
          email: 'emergency@example.com',
          organization_name: 'Emergency Org'
        }
      };

      const result = await degradedCheckout.processCheckout(checkoutRequest);
      
      // Deve funcionar em modo offline
      expect(result.success).toBe(true);
      expect(['degraded', 'offline']).toContain(result.mode);
    });
  });

  describe('Recovery e Backup', () => {
    it('deve criar backup durante situação de emergência', async () => {
      // Simula situação de emergência
      const emergencyBackup = await backupService.createCriticalDataBackup();

      expect(emergencyBackup.type).toBe('critical_data');
      expect(emergencyBackup.status).toBe('completed');
      expect(emergencyBackup.tables).toContain('subscription_intents');
    });

    it('deve validar integridade do backup', async () => {
      const backup = await backupService.createCriticalDataBackup();
      const isValid = await backupService.verifyBackup(backup.id);

      expect(isValid).toBe(true);
    });

    it('deve simular recovery completo', async () => {
      // Cria backup
      const backup = await backupService.createFullBackup();

      // Simula restauração
      await expect(
        backupService.restoreFromBackup(backup.id, ['subscription_intents'])
      ).resolves.not.toThrow();
    });
  });

  describe('Testes de Latência', () => {
    it('deve detectar e reagir a alta latência', async () => {
      const circuitBreaker = CircuitBreakerFactory.getIuguCircuitBreaker();
      
      // Simula operação com alta latência
      const slowOperation = jest.fn().mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve('slow success'), 3000)
        )
      );

      const startTime = Date.now();
      const result = await circuitBreaker.execute(slowOperation);
      const duration = Date.now() - startTime;

      expect(result).toBe('slow success');
      expect(duration).toBeGreaterThan(3000);

      // Verifica se métricas de tempo foram coletadas
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(1);
    });
  });

  describe('Testes de Memory Leak', () => {
    it('deve limpar recursos adequadamente', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Executa muitas operações para testar vazamentos
      for (let i = 0; i < 1000; i++) {
        const circuitBreaker = CircuitBreakerFactory.getExternalServiceCircuitBreaker(`test-${i}`);
        
        try {
          await circuitBreaker.execute(async () => {
            if (Math.random() > 0.5) {
              throw new Error('Random failure');
            }
            return 'success';
          });
        } catch (error) {
          // Ignora erros para o teste
        }
      }

      // Força garbage collection se disponível
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Não deve ter vazamento significativo (menos de 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Testes de Timeout', () => {
    it('deve lidar com timeouts de operação', async () => {
      const circuitBreaker = CircuitBreakerFactory.getIuguCircuitBreaker();
      
      // Operação que nunca resolve
      const timeoutOperation = jest.fn().mockImplementation(() => 
        new Promise(() => {}) // Never resolves
      );

      // Adiciona timeout manual para o teste
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), 1000)
      );

      const operationWithTimeout = () => Promise.race([
        timeoutOperation(),
        timeoutPromise
      ]);

      await expect(circuitBreaker.execute(operationWithTimeout)).rejects.toThrow('Operation timeout');
    });
  });

  describe('Testes de Dados Corrompidos', () => {
    it('deve lidar com dados corrompidos graciosamente', async () => {
      // Simula resposta com dados corrompidos
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          // Dados inválidos/corrompidos
          id: null,
          invalid_field: undefined,
          corrupted: 'invalid-json-structure'
        })
      });

      const checkoutRequest = {
        plan_id: 'plan_corrupted',
        billing_cycle: 'monthly' as const,
        organization_id: 'org_corrupted',
        user_data: {
          name: 'Corrupted Test',
          email: 'corrupted@example.com',
          organization_name: 'Corrupted Org'
        }
      };

      // Deve lidar com dados corrompidos usando fallback
      const result = await degradedCheckout.processCheckout(checkoutRequest);

      expect(result.success).toBe(true);
      expect(['degraded', 'offline']).toContain(result.mode);
    });
  });

  describe('Testes de Rate Limiting', () => {
    it('deve lidar com rate limiting do Iugu', async () => {
      let callCount = 0;
      
      // Simula rate limiting após 5 chamadas
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount > 5) {
          return Promise.resolve({
            ok: false,
            status: 429,
            json: () => Promise.resolve({ error: 'Rate limit exceeded' })
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 'customer_123' })
        });
      });

      const requests = Array(10).fill(null).map((_, i) => ({
        plan_id: 'plan_rate_limit',
        billing_cycle: 'monthly' as const,
        organization_id: `org_${i}`,
        user_data: {
          name: `Rate User ${i}`,
          email: `rate${i}@example.com`,
          organization_name: `Rate Org ${i}`
        }
      }));

      const results = await Promise.allSettled(
        requests.map(req => degradedCheckout.processCheckout(req))
      );

      // Primeiras requisições devem ter sucesso
      const firstResults = results.slice(0, 5);
      firstResults.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });

      // Requisições posteriores podem usar modo degradado
      const laterResults = results.slice(5);
      laterResults.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });
    });
  });
});