/**
 * Testes do Circuit Breaker
 * 
 * Testa o comportamento do circuit breaker em diferentes cenários de falha
 */

import { CircuitBreaker, CircuitBreakerState, CircuitBreakerError } from '@/lib/resilience/circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 1000,
      monitoringPeriod: 5000,
      name: 'test-breaker'
    });
  });

  describe('Estado CLOSED (Normal)', () => {
    it('deve executar operações com sucesso', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.CLOSED);
    });

    it('deve contar falhas mas manter estado CLOSED abaixo do threshold', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Falha 1'))
        .mockRejectedValueOnce(new Error('Falha 2'))
        .mockResolvedValue('success');

      // Primeira falha
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Falha 1');
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.CLOSED);

      // Segunda falha
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Falha 2');
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.CLOSED);

      // Sucesso
      const result = await circuitBreaker.execute(operation);
      expect(result).toBe('success');
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.CLOSED);
    });

    it('deve abrir circuit breaker após atingir threshold de falhas', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Falha'));

      // Executa falhas até atingir threshold
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(operation)).rejects.toThrow('Falha');
      }

      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe('Estado OPEN (Falha)', () => {
    beforeEach(async () => {
      // Força circuit breaker para estado OPEN
      const operation = jest.fn().mockRejectedValue(new Error('Falha'));
      
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(operation)).rejects.toThrow('Falha');
      }
      
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.OPEN);
    });

    it('deve rejeitar operações imediatamente quando OPEN', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      await expect(circuitBreaker.execute(operation)).rejects.toThrow(CircuitBreakerError);
      
      expect(operation).not.toHaveBeenCalled();
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.OPEN);
    });

    it('deve transicionar para HALF_OPEN após timeout de recovery', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      // Aguarda timeout de recovery
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const result = await circuitBreaker.execute(operation);
      
      expect(result).toBe('success');
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('Estado HALF_OPEN (Teste)', () => {
    it('deve voltar para CLOSED em caso de sucesso', async () => {
      // Força para HALF_OPEN diretamente
      circuitBreaker.forceState(CircuitBreakerState.HALF_OPEN);
      
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(operation);
      
      expect(result).toBe('success');
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.CLOSED);
    });

    it('deve voltar para OPEN em caso de falha', async () => {
      // Força para HALF_OPEN diretamente
      circuitBreaker.forceState(CircuitBreakerState.HALF_OPEN);
      
      const operation = jest.fn().mockRejectedValue(new Error('Falha'));
      
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Falha');
      
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe('Erros Esperados', () => {
    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        recoveryTimeout: 1000,
        monitoringPeriod: 5000,
        expectedErrors: ['ValidationError', '400'],
        name: 'test-breaker'
      });
    });

    it('não deve contar erros esperados para o threshold', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('ValidationError: Invalid input'))
        .mockRejectedValueOnce(new Error('400 Bad Request'))
        .mockResolvedValue('success');

      // Erros esperados não contam
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('ValidationError');
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.CLOSED);

      await expect(circuitBreaker.execute(operation)).rejects.toThrow('400 Bad Request');
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.CLOSED);

      // Sucesso
      const result = await circuitBreaker.execute(operation);
      expect(result).toBe('success');
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('Métricas', () => {
    it('deve coletar métricas corretamente', async () => {
      const successOperation = jest.fn().mockResolvedValue('success');
      const failOperation = jest.fn().mockRejectedValue(new Error('Falha'));

      // Executa algumas operações
      await circuitBreaker.execute(successOperation);
      await circuitBreaker.execute(successOperation);
      await expect(circuitBreaker.execute(failOperation)).rejects.toThrow();

      const metrics = circuitBreaker.getMetrics();

      expect(metrics.totalRequests).toBe(3);
      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.failureRate).toBeCloseTo(0.33, 2);
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
      expect(metrics.lastSuccessTime).toBeInstanceOf(Date);
      expect(metrics.lastFailureTime).toBeInstanceOf(Date);
    });
  });

  describe('Reset e Controle Manual', () => {
    it('deve permitir reset manual', async () => {
      // Força para estado OPEN
      circuitBreaker.forceState(CircuitBreakerState.OPEN);
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.OPEN);

      // Reset
      circuitBreaker.reset();
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.getMetrics().totalRequests).toBe(0);
    });

    it('deve verificar se está saudável', () => {
      expect(circuitBreaker.isHealthy()).toBe(true);

      circuitBreaker.forceState(CircuitBreakerState.OPEN);
      expect(circuitBreaker.isHealthy()).toBe(false);

      circuitBreaker.forceState(CircuitBreakerState.HALF_OPEN);
      expect(circuitBreaker.isHealthy()).toBe(true);
    });
  });

  describe('Cenários de Timeout', () => {
    it('deve lidar com operações que demoram muito', async () => {
      const slowOperation = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('slow success'), 100))
      );

      const start = Date.now();
      const result = await circuitBreaker.execute(slowOperation);
      const duration = Date.now() - start;

      expect(result).toBe('slow success');
      expect(duration).toBeGreaterThanOrEqual(100);
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('Concorrência', () => {
    it('deve lidar com múltiplas operações simultâneas', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const promises = Array(10).fill(null).map(() => 
        circuitBreaker.execute(operation)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(results.every(r => r === 'success')).toBe(true);
      expect(operation).toHaveBeenCalledTimes(10);
      expect(circuitBreaker.getMetrics().totalRequests).toBe(10);
    });

    it('deve manter consistência durante falhas concorrentes', async () => {
      const failOperation = jest.fn().mockRejectedValue(new Error('Concurrent failure'));
      
      const promises = Array(5).fill(null).map(() => 
        circuitBreaker.execute(failOperation).catch(e => e)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(results.every(r => r instanceof Error)).toBe(true);
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.OPEN);
    });
  });
});