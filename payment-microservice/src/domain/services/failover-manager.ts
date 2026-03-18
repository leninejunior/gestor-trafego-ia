import { IPaymentProvider } from '../interfaces/payment-provider.interface';
import { 
  PaymentError, 
  PaymentErrorType, 
  ProcessingOptions,
  ProviderStatus 
} from '../types';
import { ProviderRegistry } from './provider-registry';
import { CircuitBreaker } from './circuit-breaker';
import { HealthChecker } from './health-checker';

/**
 * Estratégias de failover disponíveis
 */
export enum FailoverStrategy {
  /** Tenta provedores em ordem de prioridade */
  PRIORITY = 'priority',
  
  /** Tenta provedores com melhor performance primeiro */
  PERFORMANCE = 'performance',
  
  /** Distribui carga entre provedores saudáveis */
  ROUND_ROBIN = 'round_robin',
  
  /** Usa apenas o provedor com menor latência */
  LOWEST_LATENCY = 'lowest_latency'
}

/**
 * Configurações do sistema de failover
 */
export interface FailoverConfig {
  /** Estratégia de failover */
  strategy: FailoverStrategy;
  
  /** Número máximo de tentativas */
  maxRetries: number;
  
  /** Timeout por tentativa em ms */
  timeoutPerAttempt: number;
  
  /** Intervalo entre tentativas em ms */
  retryInterval: number;
  
  /** Multiplicador para backoff exponencial */
  backoffMultiplier: number;
  
  /** Se deve pular provedores não saudáveis */
  skipUnhealthyProviders: boolean;
  
  /** Threshold de taxa de erro para considerar provedor não saudável (0-100) */
  errorRateThreshold: number;
  
  /** Threshold de latência para considerar provedor lento (ms) */
  latencyThreshold: number;
}

/**
 * Resultado de uma operação com failover
 */
export interface FailoverResult<T> {
  /** Resultado da operação */
  result: T;
  
  /** Provedor que processou com sucesso */
  successfulProvider: string;
  
  /** Número de tentativas realizadas */
  attemptsCount: number;
  
  /** Tempo total de processamento */
  totalTime: number;
  
  /** Erros ocorridos durante as tentativas */
  errors: Array<{
    provider: string;
    error: PaymentError;
    timestamp: Date;
  }>;
}

/**
 * Métricas de performance de provedor
 */
interface ProviderMetrics {
  providerName: string;
  successRate: number;
  averageLatency: number;
  lastUpdated: Date;
  totalRequests: number;
  successfulRequests: number;
}

/**
 * Gerenciador de failover para provedores de pagamento
 */
export class FailoverManager {
  private static instance: FailoverManager;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private providerMetrics: Map<string, ProviderMetrics> = new Map();
  private roundRobinIndex = 0;
  private config: FailoverConfig;
  
  private readonly defaultConfig: FailoverConfig = {
    strategy: FailoverStrategy.PRIORITY,
    maxRetries: 3,
    timeoutPerAttempt: 30000, // 30 segundos
    retryInterval: 1000, // 1 segundo
    backoffMultiplier: 2,
    skipUnhealthyProviders: true,
    errorRateThreshold: 10, // 10%
    latencyThreshold: 5000 // 5 segundos
  };

  private constructor(
    config: Partial<FailoverConfig> = {},
    private providerRegistry: ProviderRegistry = ProviderRegistry.getInstance(),
    private healthChecker: HealthChecker = HealthChecker.getInstance()
  ) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Singleton instance
   */
  static getInstance(config?: Partial<FailoverConfig>): FailoverManager {
    if (!FailoverManager.instance) {
      FailoverManager.instance = new FailoverManager(config);
    }
    return FailoverManager.instance;
  }

  /**
   * Executa uma operação com failover automático
   */
  async executeWithFailover<T>(
    operation: (provider: IPaymentProvider) => Promise<T>,
    options: ProcessingOptions = {}
  ): Promise<FailoverResult<T>> {
    const startTime = Date.now();
    const errors: Array<{ provider: string; error: PaymentError; timestamp: Date }> = [];
    
    // Merge configurações
    const effectiveConfig = {
      ...this.config,
      maxRetries: options.maxRetries ?? this.config.maxRetries,
      timeout: options.timeout ?? this.config.timeoutPerAttempt
    };

    // Obtém lista de provedores ordenada pela estratégia
    const providers = await this.getOrderedProviders(effectiveConfig.strategy, options.preferredProvider);
    
    if (providers.length === 0) {
      throw new PaymentError(
        PaymentErrorType.PROVIDER_UNAVAILABLE,
        'No providers available for processing',
        undefined,
        false
      );
    }

    let attemptsCount = 0;
    let lastError: PaymentError;

    for (const provider of providers) {
      // Verifica se excedeu o número máximo de tentativas
      if (attemptsCount >= effectiveConfig.maxRetries) {
        break;
      }

      attemptsCount++;

      try {
        // Verifica circuit breaker
        const circuitBreaker = this.getCircuitBreaker(provider.name);
        if (!circuitBreaker.canExecute()) {
          const error = new PaymentError(
            PaymentErrorType.PROVIDER_UNAVAILABLE,
            `Circuit breaker is open for provider ${provider.name}`,
            undefined,
            true,
            provider.name
          );
          errors.push({ provider: provider.name, error, timestamp: new Date() });
          continue;
        }

        // Executa operação com timeout
        const result = await this.executeWithTimeout(
          () => operation(provider),
          effectiveConfig.timeout!
        );

        // Registra sucesso
        await this.recordSuccess(provider.name);
        circuitBreaker.recordSuccess();

        return {
          result,
          successfulProvider: provider.name,
          attemptsCount,
          totalTime: Date.now() - startTime,
          errors
        };

      } catch (err) {
        const paymentError = this.normalizeError(err, provider.name);
        lastError = paymentError;
        errors.push({ provider: provider.name, error: paymentError, timestamp: new Date() });

        // Registra falha
        await this.recordFailure(provider.name, paymentError);
        this.getCircuitBreaker(provider.name).recordFailure();

        // Se não é retryable, para a execução
        if (!paymentError.retryable) {
          break;
        }

        // Aplica backoff se não for a última tentativa
        if (attemptsCount < effectiveConfig.maxRetries && attemptsCount < providers.length) {
          const delay = this.calculateBackoffDelay(attemptsCount, effectiveConfig);
          await this.sleep(delay);
        }
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    throw lastError! || new PaymentError(
      PaymentErrorType.PROVIDER_UNAVAILABLE,
      'All providers failed to process the request',
      { errors },
      false
    );
  }

  /**
   * Obtém lista de provedores ordenada pela estratégia
   */
  private async getOrderedProviders(
    strategy: FailoverStrategy,
    preferredProvider?: string
  ): Promise<IPaymentProvider[]> {
    const allProviders = this.providerRegistry.listActiveProviders();
    
    if (allProviders.length === 0) {
      return [];
    }

    // Filtra provedores não saudáveis se configurado
    let availableProviders = allProviders;
    if (this.config.skipUnhealthyProviders) {
      availableProviders = await this.filterHealthyProviders(allProviders);
    }

    // Se há provedor preferido, coloca ele primeiro
    if (preferredProvider) {
      const preferred = availableProviders.find(p => p.name === preferredProvider);
      if (preferred) {
        availableProviders = [
          preferred,
          ...availableProviders.filter(p => p.name !== preferredProvider)
        ];
      }
    }

    // Aplica estratégia de ordenação
    switch (strategy) {
      case FailoverStrategy.PRIORITY:
        return this.orderByPriority(availableProviders);
        
      case FailoverStrategy.PERFORMANCE:
        return this.orderByPerformance(availableProviders);
        
      case FailoverStrategy.ROUND_ROBIN:
        return this.orderByRoundRobin(availableProviders);
        
      case FailoverStrategy.LOWEST_LATENCY:
        return this.orderByLatency(availableProviders);
        
      default:
        return availableProviders;
    }
  }

  /**
   * Filtra apenas provedores saudáveis
   */
  private async filterHealthyProviders(providers: IPaymentProvider[]): Promise<IPaymentProvider[]> {
    const healthyProviders: IPaymentProvider[] = [];

    for (const provider of providers) {
      try {
        // Verifica circuit breaker
        const circuitBreaker = this.getCircuitBreaker(provider.name);
        if (!circuitBreaker.canExecute()) {
          continue;
        }

        // Verifica status do health checker
        const providerStatus = this.healthChecker.getProviderStatus(provider.name);
        if (providerStatus === ProviderStatus.UNHEALTHY || providerStatus === ProviderStatus.OFFLINE) {
          continue;
        }

        // Verifica métricas de performance
        const metrics = this.providerMetrics.get(provider.name);
        if (metrics) {
          if (metrics.successRate < (100 - this.config.errorRateThreshold)) {
            continue;
          }
          if (metrics.averageLatency > this.config.latencyThreshold) {
            continue;
          }
        }

        healthyProviders.push(provider);
      } catch (error) {
        // Se falhou no health check, pula o provedor
        continue;
      }
    }

    return healthyProviders;
  }

  /**
   * Ordena provedores por prioridade
   */
  private orderByPriority(providers: IPaymentProvider[]): IPaymentProvider[] {
    // Por enquanto, mantém a ordem atual (pode ser implementado com configuração de prioridade)
    return [...providers];
  }

  /**
   * Ordena provedores por performance (taxa de sucesso)
   */
  private orderByPerformance(providers: IPaymentProvider[]): IPaymentProvider[] {
    return providers.sort((a, b) => {
      const metricsA = this.providerMetrics.get(a.name);
      const metricsB = this.providerMetrics.get(b.name);
      
      const successRateA = metricsA?.successRate ?? 100;
      const successRateB = metricsB?.successRate ?? 100;
      
      return successRateB - successRateA; // Maior taxa de sucesso primeiro
    });
  }

  /**
   * Ordena provedores usando round robin
   */
  private orderByRoundRobin(providers: IPaymentProvider[]): IPaymentProvider[] {
    if (providers.length === 0) return providers;
    
    const startIndex = this.roundRobinIndex % providers.length;
    this.roundRobinIndex++;
    
    return [
      ...providers.slice(startIndex),
      ...providers.slice(0, startIndex)
    ];
  }

  /**
   * Ordena provedores por menor latência
   */
  private orderByLatency(providers: IPaymentProvider[]): IPaymentProvider[] {
    return providers.sort((a, b) => {
      const metricsA = this.providerMetrics.get(a.name);
      const metricsB = this.providerMetrics.get(b.name);
      
      const latencyA = metricsA?.averageLatency ?? 0;
      const latencyB = metricsB?.averageLatency ?? 0;
      
      return latencyA - latencyB; // Menor latência primeiro
    });
  }

  /**
   * Obtém ou cria circuit breaker para um provedor
   */
  private getCircuitBreaker(providerName: string): CircuitBreaker {
    if (!this.circuitBreakers.has(providerName)) {
      this.circuitBreakers.set(providerName, new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minuto
        monitoringPeriod: 300000 // 5 minutos
      }));
    }
    return this.circuitBreakers.get(providerName)!;
  }

  /**
   * Executa operação com timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new PaymentError(
          PaymentErrorType.NETWORK_ERROR,
          `Operation timed out after ${timeout}ms`,
          undefined,
          true
        ));
      }, timeout);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Calcula delay para backoff exponencial
   */
  private calculateBackoffDelay(attempt: number, config: FailoverConfig): number {
    return config.retryInterval * Math.pow(config.backoffMultiplier, attempt - 1);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Normaliza erro para PaymentError
   */
  private normalizeError(error: any, providerName: string): PaymentError {
    if (error instanceof PaymentError) {
      return new PaymentError(
        error.type,
        error.message,
        error.providerError,
        error.retryable,
        providerName
      );
    }

    // Determina se é retryable baseado no tipo de erro
    const isRetryable = this.isRetryableError(error);

    return new PaymentError(
      PaymentErrorType.UNKNOWN_ERROR,
      error.message || 'Unknown error occurred',
      error,
      isRetryable,
      providerName
    );
  }

  /**
   * Determina se um erro é retryable
   */
  private isRetryableError(error: any): boolean {
    // Erros de rede são geralmente retryable
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // Erros HTTP 5xx são retryable
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    // Erros HTTP 429 (rate limit) são retryable
    if (error.status === 429) {
      return true;
    }

    return false;
  }

  /**
   * Registra sucesso de um provedor
   */
  private async recordSuccess(providerName: string): Promise<void> {
    const metrics = this.providerMetrics.get(providerName) || {
      providerName,
      successRate: 100,
      averageLatency: 0,
      lastUpdated: new Date(),
      totalRequests: 0,
      successfulRequests: 0
    };

    metrics.totalRequests++;
    metrics.successfulRequests++;
    metrics.successRate = (metrics.successfulRequests / metrics.totalRequests) * 100;
    metrics.lastUpdated = new Date();

    this.providerMetrics.set(providerName, metrics);
  }

  /**
   * Registra falha de um provedor
   */
  private async recordFailure(providerName: string, error: PaymentError): Promise<void> {
    const metrics = this.providerMetrics.get(providerName) || {
      providerName,
      successRate: 100,
      averageLatency: 0,
      lastUpdated: new Date(),
      totalRequests: 0,
      successfulRequests: 0
    };

    metrics.totalRequests++;
    metrics.successRate = (metrics.successfulRequests / metrics.totalRequests) * 100;
    metrics.lastUpdated = new Date();

    this.providerMetrics.set(providerName, metrics);
  }

  /**
   * Obtém métricas de um provedor
   */
  getProviderMetrics(providerName: string): ProviderMetrics | undefined {
    return this.providerMetrics.get(providerName);
  }

  /**
   * Obtém métricas de todos os provedores
   */
  getAllProviderMetrics(): ProviderMetrics[] {
    return Array.from(this.providerMetrics.values());
  }

  /**
   * Reseta métricas de um provedor
   */
  resetProviderMetrics(providerName: string): void {
    this.providerMetrics.delete(providerName);
    const circuitBreaker = this.circuitBreakers.get(providerName);
    if (circuitBreaker) {
      circuitBreaker.reset();
    }
  }

  /**
   * Reseta todas as métricas
   */
  resetAllMetrics(): void {
    this.providerMetrics.clear();
    this.circuitBreakers.clear();
    this.roundRobinIndex = 0;
  }

  /**
   * Atualiza configuração do failover
   */
  updateConfig(newConfig: Partial<FailoverConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Obtém configuração atual
   */
  getConfig(): FailoverConfig {
    return { ...this.config };
  }
}