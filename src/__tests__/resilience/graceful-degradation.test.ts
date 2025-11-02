/**
 * Testes de Graceful Degradation
 * 
 * Testa comportamento de degradação graciosa quando serviços falham
 */

import { 
  GracefulDegradationManager, 
  ServiceStatus, 
  FallbackStrategies 
} from '@/lib/resilience/graceful-degradation';

// Mock dos módulos externos
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn()
}));

describe('GracefulDegradationManager', () => {
  let degradationManager: GracefulDegradationManager;

  beforeEach(() => {
    degradationManager = new GracefulDegradationManager({
      checkInterval: 1000,
      healthyThreshold: 1000,
      degradedThreshold: 2000,
      maxErrorCount: 2,
      services: ['iugu', 'database', 'feature-gate']
    });
  });

  afterEach(() => {
    degradationManager.stopHealthMonitoring();
  });

  describe('Inicialização', () => {
    it('deve inicializar serviços com status saudável', () => {
      const status = degradationManager.getServicesStatus();

      expect(status).toHaveProperty('iugu');
      expect(status).toHaveProperty('database');
      expect(status).toHaveProperty('feature-gate');

      Object.values(status).forEach(service => {
        expect(service.status).toBe(ServiceStatus.HEALTHY);
        expect(service.errorCount).toBe(0);
      });
    });

    it('deve registrar estratégias de fallback padrão', () => {
      // Verifica se as estratégias foram registradas
      expect(() => {
        FallbackStrategies.registerDefaultStrategies();
      }).not.toThrow();
    });
  });

  describe('Health Checks', () => {
    it('deve verificar saúde do Iugu', async () => {
      // Mock fetch para simular resposta saudável do Iugu
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      const health = await degradationManager.checkServiceHealth('iugu');

      expect(health.status).toBe(ServiceStatus.HEALTHY);
      expect(health.errorCount).toBe(0);
      expect(health.responseTime).toBeGreaterThan(0);
    });

    it('deve detectar falha no Iugu', async () => {
      // Mock fetch para simular falha do Iugu
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500
      });

      const health = await degradationManager.checkServiceHealth('iugu');

      expect(health.status).toBe(ServiceStatus.DEGRADED);
      expect(health.errorCount).toBe(1);
    });

    it('deve marcar serviço como indisponível após múltiplas falhas', async () => {
      // Mock fetch para simular falhas consecutivas
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500
      });

      // Primeira falha
      await degradationManager.checkServiceHealth('iugu');
      let status = degradationManager.getServicesStatus();
      expect(status.iugu.status).toBe(ServiceStatus.DEGRADED);

      // Segunda falha - deve marcar como indisponível
      await degradationManager.checkServiceHealth('iugu');
      status = degradationManager.getServicesStatus();
      expect(status.iugu.status).toBe(ServiceStatus.UNAVAILABLE);
    });

    it('deve detectar resposta lenta como degradada', async () => {
      // Mock fetch com delay para simular resposta lenta
      global.fetch = jest.fn().mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ ok: true, status: 200 }), 2500)
        )
      );

      const health = await degradationManager.checkServiceHealth('iugu');

      expect(health.status).toBe(ServiceStatus.DEGRADED);
      expect(health.responseTime).toBeGreaterThan(2000);
      expect(health.message).toContain('High response time');
    });
  });

  describe('Fallback Execution', () => {
    beforeEach(() => {
      // Registra estratégia de fallback para testes
      degradationManager.registerFallbackStrategy({
        serviceName: 'test-service',
        fallbackFunction: async () => ({ fallback: true, data: 'cached' }),
        cacheKey: 'test-cache',
        cacheTTL: 60000
      });
    });

    it('deve executar operação primária quando serviço está saudável', async () => {
      const primaryOperation = jest.fn().mockResolvedValue('primary result');

      const result = await degradationManager.executeWithFallback(
        'test-service',
        primaryOperation,
        'test-operation'
      );

      expect(result).toBe('primary result');
      expect(primaryOperation).toHaveBeenCalledTimes(1);
    });

    it('deve usar fallback quando serviço está degradado', async () => {
      // Força serviço para estado degradado
      const services = degradationManager.getServicesStatus();
      services['test-service'] = {
        name: 'test-service',
        status: ServiceStatus.DEGRADED,
        lastCheck: new Date(),
        errorCount: 1
      };

      const primaryOperation = jest.fn().mockRejectedValue(new Error('Service degraded'));

      const result = await degradationManager.executeWithFallback(
        'test-service',
        primaryOperation,
        'test-operation'
      );

      expect(result).toEqual({ fallback: true, data: 'cached' });
    });

    it('deve usar cache quando disponível', async () => {
      // Executa uma vez para popular cache
      await degradationManager.executeWithFallback(
        'test-service',
        jest.fn().mockRejectedValue(new Error('Fail')),
        'test-operation'
      );

      // Segunda execução deve usar cache
      const primaryOperation = jest.fn().mockRejectedValue(new Error('Fail again'));

      const result = await degradationManager.executeWithFallback(
        'test-service',
        primaryOperation,
        'test-operation'
      );

      expect(result).toEqual({ fallback: true, data: 'cached' });
    });

    it('deve tentar operação primária quando não há fallback', async () => {
      const primaryOperation = jest.fn().mockResolvedValue('primary result');

      const result = await degradationManager.executeWithFallback(
        'unknown-service',
        primaryOperation,
        'test-operation'
      );

      expect(result).toBe('primary result');
      expect(primaryOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache Management', () => {
    beforeEach(() => {
      degradationManager.registerFallbackStrategy({
        serviceName: 'cache-test',
        fallbackFunction: async () => ({ timestamp: Date.now() }),
        cacheKey: 'cache-test-key',
        cacheTTL: 100 // 100ms para teste rápido
      });
    });

    it('deve expirar cache após TTL', async () => {
      // Primeira execução - popula cache
      const result1 = await degradationManager.executeWithFallback(
        'cache-test',
        jest.fn().mockRejectedValue(new Error('Fail')),
        'cache-test'
      );

      // Aguarda expiração do cache
      await new Promise(resolve => setTimeout(resolve, 150));

      // Segunda execução - deve gerar novo resultado
      const result2 = await degradationManager.executeWithFallback(
        'cache-test',
        jest.fn().mockRejectedValue(new Error('Fail')),
        'cache-test'
      );

      expect(result1.timestamp).not.toBe(result2.timestamp);
    });

    it('deve limpar cache expirado', () => {
      // Adiciona dados ao cache manualmente
      degradationManager['localCache'].set('test-key', {
        data: 'test',
        expires: new Date(Date.now() - 1000) // Expirado
      });

      degradationManager.cleanupCache();

      expect(degradationManager['localCache'].has('test-key')).toBe(false);
    });
  });

  describe('System Status', () => {
    it('deve detectar sistema degradado', () => {
      // Força um serviço para estado degradado
      const services = degradationManager['serviceHealth'];
      services.set('iugu', {
        name: 'iugu',
        status: ServiceStatus.DEGRADED,
        lastCheck: new Date(),
        errorCount: 1
      });

      expect(degradationManager.isSystemDegraded()).toBe(true);
    });

    it('deve calcular nível de degradação', () => {
      const services = degradationManager['serviceHealth'];
      
      // 1 serviço degradado, 1 indisponível, 1 saudável
      services.set('service1', {
        name: 'service1',
        status: ServiceStatus.DEGRADED,
        lastCheck: new Date(),
        errorCount: 1
      });
      
      services.set('service2', {
        name: 'service2',
        status: ServiceStatus.UNAVAILABLE,
        lastCheck: new Date(),
        errorCount: 3
      });
      
      services.set('service3', {
        name: 'service3',
        status: ServiceStatus.HEALTHY,
        lastCheck: new Date(),
        errorCount: 0
      });

      const level = degradationManager.getDegradationLevel();
      
      // (0.5 + 1.0 + 0) / 3 = 0.5
      expect(level).toBeCloseTo(0.5, 1);
    });

    it('deve permitir reset manual de serviço', () => {
      // Força serviço para estado degradado
      const services = degradationManager['serviceHealth'];
      services.set('test-service', {
        name: 'test-service',
        status: ServiceStatus.UNAVAILABLE,
        lastCheck: new Date(),
        errorCount: 5,
        message: 'Service failed'
      });

      degradationManager.resetService('test-service');

      const status = degradationManager.getServicesStatus();
      expect(status['test-service'].status).toBe(ServiceStatus.HEALTHY);
      expect(status['test-service'].errorCount).toBe(0);
      expect(status['test-service'].message).toBeUndefined();
    });
  });

  describe('Monitoring', () => {
    it('deve iniciar monitoramento automático', () => {
      const spy = jest.spyOn(degradationManager as any, 'performHealthChecks');
      
      degradationManager.startHealthMonitoring();
      
      // Aguarda um ciclo de monitoramento
      return new Promise(resolve => {
        setTimeout(() => {
          expect(spy).toHaveBeenCalled();
          resolve(undefined);
        }, 1100);
      });
    });

    it('deve parar monitoramento', () => {
      degradationManager.startHealthMonitoring();
      degradationManager.stopHealthMonitoring();
      
      // Verifica que o interval foi limpo
      expect(degradationManager['healthCheckInterval']).toBeUndefined();
    });
  });

  describe('Database Health Check', () => {
    it('deve verificar saúde do banco de dados', async () => {
      // Mock do Supabase client
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ error: null })
          })
        })
      };

      const { createClient } = require('@/lib/supabase/server');
      createClient.mockResolvedValue(mockClient);

      const health = await degradationManager.checkServiceHealth('database');

      expect(health.status).toBe(ServiceStatus.HEALTHY);
      expect(mockClient.from).toHaveBeenCalledWith('subscription_plans');
    });

    it('deve detectar falha no banco de dados', async () => {
      // Mock do Supabase client com erro
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ error: new Error('Database error') })
          })
        })
      };

      const { createClient } = require('@/lib/supabase/server');
      createClient.mockResolvedValue(mockClient);

      const health = await degradationManager.checkServiceHealth('database');

      expect(health.status).toBe(ServiceStatus.DEGRADED);
      expect(health.errorCount).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('deve lidar com erros durante health check', async () => {
      // Mock fetch que lança exceção
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const health = await degradationManager.checkServiceHealth('iugu');

      expect(health.status).toBe(ServiceStatus.DEGRADED);
      expect(health.errorCount).toBe(1);
    });

    it('deve lidar com fallback que falha', async () => {
      degradationManager.registerFallbackStrategy({
        serviceName: 'failing-fallback',
        fallbackFunction: async () => {
          throw new Error('Fallback also failed');
        }
      });

      const primaryOperation = jest.fn().mockRejectedValue(new Error('Primary failed'));

      await expect(
        degradationManager.executeWithFallback('failing-fallback', primaryOperation)
      ).rejects.toThrow('Both primary and fallback operations failed');
    });
  });
});