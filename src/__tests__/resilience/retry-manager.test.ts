/**
 * Testes do Retry Manager
 * 
 * Testa lógica de retry com backoff exponencial e classificação de erros
 */

import { RetryManager, RetryableError, NonRetryableError } from '@/lib/resilience/retry-manager';

describe('RetryManager', () => {
  let retryManager: RetryManager;

  beforeEach(() => {
    retryManager = new RetryManager({
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
      jitter: false, // Desabilita jitter para testes determinísticos
      retryableErrors: ['NETWORK_ERROR', '500', 'TIMEOUT'],
      nonRetryableErrors: ['400', 'VALIDATION_ERROR', '401']
    });
  });

  describe('Operações com Sucesso', () => {
    it('deve executar operação com sucesso na primeira tentativa', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await retryManager.execute(operation, 'test-operation');
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('deve retornar resultado detalhado com sucesso', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await retryManager.executeWithResult(operation, 'test-operation');
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.totalTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Retry com Erros Retryable', () => {
    it('deve fazer retry para erros de rede', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('NETWORK_ERROR: Connection failed'))
        .mockRejectedValueOnce(new Error('500 Internal Server Error'))
        .mockResolvedValue('success');

      const start = Date.now();
      const result = await retryManager.execute(operation, 'network-operation');
      const duration = Date.now() - start;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
      
      // Verifica que houve delay entre tentativas
      expect(duration).toBeGreaterThan(300); // 100ms + 200ms delays mínimos
    });

    it('deve calcular backoff exponencial corretamente', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('TIMEOUT'))
        .mockRejectedValueOnce(new Error('TIMEOUT'))
        .mockResolvedValue('success');

      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      
      global.setTimeout = jest.fn().mockImplementation((callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, delay);
      });

      await retryManager.execute(operation);

      expect(delays).toHaveLength(2);
      expect(delays[0]).toBe(100); // baseDelay
      expect(delays[1]).toBe(200); // baseDelay * backoffMultiplier

      global.setTimeout = originalSetTimeout;
    });

    it('deve falhar após esgotar todas as tentativas', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('500 Server Error'));

      await expect(retryManager.execute(operation)).rejects.toThrow(RetryableError);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('deve retornar resultado detalhado com falha', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('NETWORK_ERROR'));

      const result = await retryManager.executeWithResult(operation);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(RetryableError);
      expect(result.attempts).toBe(3);
      expect(result.totalTime).toBeGreaterThan(0);
    });
  });

  describe('Erros Não-Retryable', () => {
    it('deve falhar imediatamente para erros de validação', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('400 Bad Request'));

      await expect(retryManager.execute(operation)).rejects.toThrow(NonRetryableError);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('deve falhar imediatamente para erros de autenticação', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('401 Unauthorized'));

      await expect(retryManager.execute(operation)).rejects.toThrow(NonRetryableError);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('deve falhar imediatamente para erros de validação customizados', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('VALIDATION_ERROR: Invalid input'));

      await expect(retryManager.execute(operation)).rejects.toThrow(NonRetryableError);
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('Configurações Específicas', () => {
    it('deve usar configuração para Iugu API', async () => {
      const iuguRetry = RetryManager.forIuguAPI();
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('500 Server Error'))
        .mockRejectedValueOnce(new Error('502 Bad Gateway'))
        .mockResolvedValue('success');

      const result = await iuguRetry.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    }, 10000); // Aumenta timeout para 10 segundos

    it('deve usar configuração para Database', async () => {
      const dbRetry = RetryManager.forDatabase();
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('connection timeout'))
        .mockResolvedValue('success');

      const result = await dbRetry.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('deve usar configuração para Webhooks', async () => {
      const webhookRetry = RetryManager.forWebhooks();
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('503 Service Unavailable'))
        .mockRejectedValueOnce(new Error('504 Gateway Timeout'))
        .mockRejectedValueOnce(new Error('NETWORK timeout'))
        .mockResolvedValue('success');

      const result = await webhookRetry.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(4);
    }, 15000); // Aumenta timeout para 15 segundos
  });

  describe('Callbacks de Retry', () => {
    it('deve chamar callback onRetry', async () => {
      const onRetry = jest.fn();
      const retryWithCallback = new RetryManager({
        maxAttempts: 3,
        baseDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
        jitter: false,
        onRetry
      });

      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
        .mockRejectedValueOnce(new Error('TIMEOUT'))
        .mockResolvedValue('success');

      await retryWithCallback.execute(operation);

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
    });

    it('deve chamar callback onFailure', async () => {
      const onFailure = jest.fn();
      const retryWithCallback = new RetryManager({
        maxAttempts: 2,
        baseDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
        jitter: false,
        onFailure
      });

      const operation = jest.fn().mockRejectedValue(new Error('NETWORK_ERROR'));

      await expect(retryWithCallback.execute(operation)).rejects.toThrow();

      expect(onFailure).toHaveBeenCalledTimes(1);
      expect(onFailure).toHaveBeenCalledWith(expect.any(Error), 2);
    });
  });

  describe('Jitter', () => {
    it('deve aplicar jitter quando habilitado', async () => {
      const retryWithJitter = new RetryManager({
        maxAttempts: 3,
        baseDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
        jitter: true
      });

      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
        .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
        .mockResolvedValue('success');

      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      
      global.setTimeout = jest.fn().mockImplementation((callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, delay);
      });

      await retryWithJitter.execute(operation);

      expect(delays).toHaveLength(2);
      
      // Com jitter, os delays devem variar um pouco
      expect(delays[0]).toBeGreaterThan(75);  // 100 - 25% jitter
      expect(delays[0]).toBeLessThan(125);    // 100 + 25% jitter
      expect(delays[1]).toBeGreaterThan(150); // 200 - 25% jitter
      expect(delays[1]).toBeLessThan(250);    // 200 + 25% jitter

      global.setTimeout = originalSetTimeout;
    });
  });

  describe('Limite de Delay Máximo', () => {
    it('deve respeitar maxDelay', async () => {
      const retryWithMaxDelay = new RetryManager({
        maxAttempts: 5,
        baseDelay: 100,
        maxDelay: 300,
        backoffMultiplier: 3,
        jitter: false
      });

      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
        .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
        .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
        .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
        .mockResolvedValue('success');

      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      
      global.setTimeout = jest.fn().mockImplementation((callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, delay);
      });

      await retryWithMaxDelay.execute(operation);

      expect(delays).toEqual([100, 300, 300, 300]); // Limitado a maxDelay

      global.setTimeout = originalSetTimeout;
    });
  });

  describe('Classificação Automática de Erros', () => {
    it('deve classificar erros de rede como retryable por padrão', async () => {
      const defaultRetry = new RetryManager({
        maxAttempts: 2,
        baseDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
        jitter: false
        // Sem retryableErrors/nonRetryableErrors específicos
      });

      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      const result = await defaultRetry.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('deve classificar erros desconhecidos baseado em padrões', async () => {
      const defaultRetry = new RetryManager({
        maxAttempts: 2,
        baseDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
        jitter: false
      });

      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Connection timeout occurred'))
        .mockResolvedValue('success');

      const result = await defaultRetry.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cenários Edge Case', () => {
    it('deve lidar com operação que retorna undefined', async () => {
      const operation = jest.fn().mockResolvedValue(undefined);

      const result = await retryManager.execute(operation);

      expect(result).toBeUndefined();
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('deve lidar com operação que retorna null', async () => {
      const operation = jest.fn().mockResolvedValue(null);

      const result = await retryManager.execute(operation);

      expect(result).toBeNull();
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('deve lidar com erro sem mensagem', async () => {
      const operation = jest.fn().mockRejectedValue(new Error());

      await expect(retryManager.execute(operation)).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(1); // Erro vazio não é retryable
    });
  });
});