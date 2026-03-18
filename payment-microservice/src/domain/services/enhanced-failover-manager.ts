import { IPaymentProvider } from '../interfaces/payment-provider.interface';
import { 
  PaymentError, 
  PaymentErrorType, 
  ProcessingOptions,
  ProviderStatus 
} from '../types';
import { ProviderRegistry } from './provider-registry';
import { CircuitBreaker, CircuitBreakerState } from './circuit-breaker';
import { HealthChecker } from './health-checker';
import { RetryService, RetryStrategy } from './retry-service';

/**
 * Estratégias de failover aprimoradas
 */
export enum EnhancedFailoverStrategy {
  /** Tenta provedores em ordem de prioridade */
  PRIORITY = 'priority',
  
  /** Tenta provedores com melhor performance primeiro */
  PERFORMANCE = 'performance',
  
  /** Distribui carga entre provedores saudáveis */
  ROUND_ROBIN = 'round_robin',
  
  /** Usa apenas o provedor com menor latência */
  LOWEST_LATENCY = 'lowest_latency',
  
  /** Estratégia adaptativa baseada em condições atuais */
  ADAPTIVE = 'adaptive'
}

/**
 * Configurações aprimoradas do sistema de failover
 */
export interface EnhancedFailoverConfig {
  /** Estratégia de failover */
  strategy: EnhancedFailoverStrategy;
  
  /** Número máximo de tentativas */
  maxRetries: number;
  
  /** Timeout por tentativa em ms */
  timeoutPerAttempt: number;
  
  /** Se deve pular provedores não saudáveis */
  skipUnhealthyProviders: boolean;
  
  /** Threshold de taxa de erro para considerar provedor não saudável (0-100) */
  errorRateThreshold: number;
  
  /** Threshold de latência para considerar provedor lento (ms) */
  latencyThreshold: number;
  
  /** Configuração do retry service */
  retryConfig: {
    strategy: RetryStrategy;
    initialDelay: number;
    maxDelay: number;
    multiplier: number;
  };
  
  /** Se deve usar circuit breaker */
  useCircuitBreaker: boolean;
  
  /** Se deve usar health checker */
  useHealthChecker: boolean;
  
  /** Intervalo para atualização de métricas em ms */
  metricsUpdateInterval: number;
}

/**
 * Resultado aprimorado de uma operação com failover
 */
export interface EnhancedFailoverResult<T> {
  /** Resultado da operação */
  result: T;
  
  /** Provedor que processou com sucesso */
  successfulProvider: string;
  
  /** Número de tentativas realizadas */
  attemptsCount: number;
  
  /** Tempo total de processamento */
  totalTime: number;
  
  /** Estratégia utilizada */
  strategyUsed: EnhancedFailoverStrategy;
  
  /** Erros ocorridos durante as tentativas */
  errors: Array<{
    provider: string;
    error: PaymentError;
    timestamp: Date;
    circuitBreakerState?: CircuitBreakerState;
    providerHealth?: ProviderStatus;
  }>;
  
  /** Métricas da execução */
  metrics: {
    averageResponseTime: number;
    providersEvaluated: number;
    providersSkipped: number;
    circuitBreakersOpen: number;
  };
}

/**
 * Métricas aprimoradas de performance de provedor
 */
interface EnhancedProviderMetrics {
  providerName: string;
  successRate: number;
  averageLatency: number;
  lastUpdated: Date;
  totalRequests: number;
  successfulRequests: number;
  
  // Métricas adicionais
  recentPerformance: {
    last5Minutes: { successRate: number; avgLatency: number };
    last15Minutes: { successRate: number; avgLatency: number };
    lastHour: { successRate: number; avgLatency: number };
  };
  
  // Tendências
  trends: {
    successRateTrend: 'improving' | 'stable' | 'degrading';
    latencyTrend: 'improving' | 'stable' | 'degrading';
  };
}

/**
 * Gerenciador de failover aprimorado para provedores de pagamento
 */
export class EnhancedFailoverManager {
  private static instance: EnhancedFailoverManager;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private providerMetrics: Map<string, EnhancedProviderMetrics> = new Map();
  private roundRobinIndex = 0;
  private config: EnhancedFailoverConfig;
  private retryService: RetryService;
  private metricsUpdateTimer?: NodeJS.Timeout;
  
  private readonly defaultConfig: EnhancedFailoverConfig = {
    strategy: EnhancedFailoverStrategy.ADAPTIVE,
    maxRetries: 3,
    timeoutPerAttempt: 30000, // 30 segundos
    skipUnhealthyProviders: true,
    errorRateThreshold: 10, // 10%
    latencyThreshold: 5000, // 5 segundos
    retryConfig: {
      strategy: RetryStrategy.EXPONENTIAL_JITTER,
      initialDelay: 1000,
      maxDelay: 10000,
      multiplier: 2
    },
    useCircuitBreaker: true,
    useHealthChecker: true,
    metricsUpdateInterval: 60000 // 1 minuto
  };

  private constructor(
    config: Partial<EnhancedFailoverConfig> = {},
    private providerRegistry: ProviderRegistry = ProviderRegistry.getInstance(),
    private healthChecker: HealthChecker = HealthChecker.getInstance()
  ) {
    this.config = { ...this.defaultConfig, ...config };
    this.retryService = new RetryService(this.config.retryConfig);
    this.startMetricsUpdater();
  }

  /**
   * Singleton instance
   */
  static getInstance(config?: Partial<EnhancedFailoverConfig>): EnhancedFailoverManager {
    if (!EnhancedFailoverManager.instance) {
      EnhancedFailoverManager.instance = new EnhancedFailoverManager(config);
    }
    return EnhancedFailoverManager.instance;
  }

  /**
   * Executa uma operação com failover automático aprimorado
   */
  async executeWithFailover<T>(
    operation: (provider: IPaymentProvider) => Promise<T>,
    options: ProcessingOptions = {}
  ): Promise<EnhancedFailoverResult<T>> {
    const startTime = Date.now();
    const errors: EnhancedFailoverResult<T>['errors'] = [];
    
    // Merge configurações
    const effectiveConfig = {
      ...this.config,
      maxRetries: options.maxRetries ?? this.config.maxRetries,
      timeout: options.timeout ?? this.config.timeoutPerAttempt
    };

    // Determina estratégia a ser usada
    const strategyToUse = this.determineStrategy(options.preferredProvider);
    
    // Obtém lista de provedores ordenada pela estratégia
    const providers = await this.getOrderedProviders(strategyToUse, options.preferredProvider);
    
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
    let providersEvaluated = 0;
    let providersSkipped = 0;
    let circuitBreakersOpen = 0;
    const responseTimes: number[] = [];

    for (const provider of providers) {
      providersEvaluated++;
      
      // Verifica se excedeu o número máximo de tentativas
      if (attemptsCount >= effectiveConfig.maxRetries) {
        break;
      }

      // Verifica circuit breaker se habilitado
      if (this.config.useCircuitBreaker) {
        const circuitBreaker = this.getCircuitBreaker(provider.name);
        if (!circuitBreaker.canExecute()) {
          circuitBreakersOpen++;
          providersSkipped++;
          const error = new PaymentError(
            PaymentErrorType.PROVIDER_UNAVAILABLE,
            `Circuit breaker is open for provider ${provider.name}`,
            undefined,
            true,
            provider.name
          );
          errors.push({ 
            provider: provider.name, 
            error, 
            timestamp: new Date(),
            circuitBreakerState: circuitBreaker.getMetrics().state,
            providerHealth: this.config.useHealthChecker ? this.healthChecker.getProviderStatus(provider.name) : undefined
          });
          continue;
        }
      }

      attemptsCount++;

      try {
        // Executa operação com timeout e retry
        const operationStartTime = Date.now();
        const result = await this.executeWithTimeoutAndRetry(
          () => operation(provider),
          effectiveConfig.timeout!,
          provider.name
        );
        const responseTime = Date.now() - operationStartTime;
        responseTimes.push(responseTime);

        // Registra sucesso
        await this.recordSuccess(provider.name, responseTime);
        
        if (this.config.useCircuitBreaker) {
          this.getCircuitBreaker(provider.name).recordSuccess();
        }

        const averageResponseTime = responseTimes.length > 0 
          ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
          : 0;

        return {
          result,
          successfulProvider: provider.name,
          attemptsCount,
          totalTime: Date.now() - startTime,
          strategyUsed: strategyToUse,
          errors,
          metrics: {
            averageResponseTime,
            providersEvaluated,
            providersSkipped,
            circuitBreakersOpen
          }
        };

      } catch (err) {
        const paymentError = this.normalizeError(err, provider.name);
        lastError = paymentError;
        
        const circuitBreakerState = this.config.useCircuitBreaker 
          ? this.getCircuitBreaker(provider.name).getMetrics().state 
          : undefined;
        
        const providerHealth = this.config.useHealthChecker 
          ? this.healthChecker.getProviderStatus(provider.name) 
          : undefined;

        errors.push({ 
          provider: provider.name, 
          error: paymentError, 
          timestamp: new Date(),
          circuitBreakerState,
          providerHealth
        });

        // Registra falha
        await this.recordFailure(provider.name, paymentError);
        
        if (this.config.useCircuitBreaker) {
          this.getCircuitBreaker(provider.name).recordFailure();
        }

        // Se não é retryable, para a execução
        if (!paymentError.retryable) {
          break;
        }
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    const finalError = lastError! || new PaymentError(
      PaymentErrorType.PROVIDER_UNAVAILABLE,
      'All providers failed to process the request',
      { errors },
      false
    );

    // Adiciona métricas ao erro
    (finalError as any).failoverMetrics = {
      averageResponseTime,
      providersEvaluated,
      providersSkipped,
      circuitBreakersOpen,
      strategyUsed: strategyToUse
    };

    throw finalError;
  }

  /**
   * Determina a estratégia a ser usada baseada nas condições atuais
   */
  private determineStrategy(preferredProvider?: string): EnhancedFailoverStrategy {
    if (this.config.strategy !== EnhancedFailoverStrategy.ADAPTIVE) {
      return this.config.strategy;
    }

    // Lógica adaptativa
    const allMetrics = Array.from(this.providerMetrics.values());
    
    // Se há provedor preferido, usa prioridade
    if (preferredProvider) {
      return EnhancedFailoverStrategy.PRIORITY;
    }
    
    // Se há grande variação de performance, usa performance
    const latencies = allMetrics.map(m => m.averageLatency);
    const maxLatency = Math.max(...latencies);
    const minLatency = Math.min(...latencies);
    
    if (maxLatency - minLatency > 2000) { // 2 segundos de diferença
      return EnhancedFailoverStrategy.PERFORMANCE;
    }
    
    // Se performance é similar, usa round robin para distribuir carga
    return EnhancedFailoverStrategy.ROUND_ROBIN;
  }

  /**
   * Obtém lista de provedores ordenada pela estratégia
   */
  private async getOrderedProviders(
    strategy: EnhancedFailoverStrategy,
    preferredProvider?: string
  ): Promise<IPaymentProvider[]> {
    const allProviders = this.providerRegistry.listActiveProviders();
    
    if (allProviders.length === 0) {
      return [];
    }

    // Mantém todos os provedores para permitir verificação individual no loop
    let availableProviders = allProviders;

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
      case EnhancedFailoverStrategy.PRIORITY:
        return this.orderByPriority(availableProviders);
        
      case EnhancedFailoverStrategy.PERFORMANCE:
        return this.orderByPerformance(availableProviders);
        
      case EnhancedFailoverStrategy.ROUND_ROBIN:
        return this.orderByRoundRobin(availableProviders);
        
      case EnhancedFailoverStrategy.LOWEST_LATENCY:
        return this.orderByLatency(availableProviders);
        
      case EnhancedFailoverStrategy.ADAPTIVE:
        // Já foi determinada a estratégia real no determineStrategy
        return this.orderByPerformance(availableProviders);
        
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
        // Verifica circuit breaker se habilitado
        if (this.config.useCircuitBreaker) {
          const circuitBreaker = this.getCircuitBreaker(provider.name);
          if (!circuitBreaker.canExecute()) {
            continue;
          }
        }

        // Verifica status do health checker se habilitado
        if (this.config.useHealthChecker) {
          const providerStatus = this.healthChecker.getProviderStatus(provider.name);
          if (providerStatus === ProviderStatus.UNHEALTHY || providerStatus === ProviderStatus.OFFLINE) {
            continue;
          }
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
    // Mantém a ordem atual (pode ser implementado com configuração de prioridade)
    return [...providers];
  }

  /**
   * Ordena provedores por performance (taxa de sucesso e latência)
   */
  private orderByPerformance(providers: IPaymentProvider[]): IPaymentProvider[] {
    return providers.sort((a, b) => {
      const metricsA = this.providerMetrics.get(a.name);
      const metricsB = this.providerMetrics.get(b.name);
      
      const scoreA = this.calculatePerformanceScore(metricsA);
      const scoreB = this.calculatePerformanceScore(metricsB);
      
      return scoreB - scoreA; // Maior score primeiro
    });
  }

  /**
   * Calcula score de performance baseado em múltiplos fatores
   */
  private calculatePerformanceScore(metrics?: EnhancedProviderMetrics): number {
    if (!metrics) return 0;
    
    // Score baseado em taxa de sucesso (peso 60%)
    const successScore = metrics.successRate * 0.6;
    
    // Score baseado em latência (peso 30%) - latência menor = score maior
    const latencyScore = Math.max(0, (5000 - metrics.averageLatency) / 5000) * 30;
    
    // Score baseado em tendência (peso 10%)
    let trendScore = 5; // neutro
    if (metrics.trends.successRateTrend === 'improving') trendScore += 3;
    if (metrics.trends.successRateTrend === 'degrading') trendScore -= 3;
    if (metrics.trends.latencyTrend === 'improving') trendScore += 2;
    if (metrics.trends.latencyTrend === 'degrading') trendScore -= 2;
    
    return successScore + latencyScore + trendScore;
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
   * Executa operação com timeout e retry
   */
  private async executeWithTimeoutAndRetry<T>(
    operation: () => Promise<T>,
    timeout: number,
    providerName: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new PaymentError(
          PaymentErrorType.NETWORK_ERROR,
          `Operation timed out after ${timeout}ms for provider ${providerName}`,
          undefined,
          true,
          providerName
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
  private async recordSuccess(providerName: string, responseTime: number): Promise<void> {
    const metrics = this.providerMetrics.get(providerName) || this.createInitialMetrics(providerName);

    metrics.totalRequests++;
    metrics.successfulRequests++;
    metrics.successRate = (metrics.successfulRequests / metrics.totalRequests) * 100;
    
    // Atualiza latência com média móvel
    metrics.averageLatency = (metrics.averageLatency * 0.8) + (responseTime * 0.2);
    metrics.lastUpdated = new Date();

    this.providerMetrics.set(providerName, metrics);
    this.updateTrends(metrics);
  }

  /**
   * Registra falha de um provedor
   */
  private async recordFailure(providerName: string, error: PaymentError): Promise<void> {
    const metrics = this.providerMetrics.get(providerName) || this.createInitialMetrics(providerName);

    metrics.totalRequests++;
    metrics.successRate = (metrics.successfulRequests / metrics.totalRequests) * 100;
    metrics.lastUpdated = new Date();

    this.providerMetrics.set(providerName, metrics);
    this.updateTrends(metrics);
  }

  /**
   * Cria métricas iniciais para um provedor
   */
  private createInitialMetrics(providerName: string): EnhancedProviderMetrics {
    return {
      providerName,
      successRate: 100,
      averageLatency: 0,
      lastUpdated: new Date(),
      totalRequests: 0,
      successfulRequests: 0,
      recentPerformance: {
        last5Minutes: { successRate: 100, avgLatency: 0 },
        last15Minutes: { successRate: 100, avgLatency: 0 },
        lastHour: { successRate: 100, avgLatency: 0 }
      },
      trends: {
        successRateTrend: 'stable',
        latencyTrend: 'stable'
      }
    };
  }

  /**
   * Atualiza tendências de performance
   */
  private updateTrends(metrics: EnhancedProviderMetrics): void {
    // Lógica simplificada para determinar tendências
    // Em produção, isso seria baseado em dados históricos mais complexos
    
    const currentSuccessRate = metrics.successRate;
    const recentSuccessRate = metrics.recentPerformance.last15Minutes.successRate;
    
    if (currentSuccessRate > recentSuccessRate + 5) {
      metrics.trends.successRateTrend = 'improving';
    } else if (currentSuccessRate < recentSuccessRate - 5) {
      metrics.trends.successRateTrend = 'degrading';
    } else {
      metrics.trends.successRateTrend = 'stable';
    }
    
    const currentLatency = metrics.averageLatency;
    const recentLatency = metrics.recentPerformance.last15Minutes.avgLatency;
    
    if (currentLatency < recentLatency * 0.9) {
      metrics.trends.latencyTrend = 'improving';
    } else if (currentLatency > recentLatency * 1.1) {
      metrics.trends.latencyTrend = 'degrading';
    } else {
      metrics.trends.latencyTrend = 'stable';
    }
  }

  /**
   * Inicia atualizador de métricas
   */
  private startMetricsUpdater(): void {
    this.metricsUpdateTimer = setInterval(() => {
      this.updateAllMetrics();
    }, this.config.metricsUpdateInterval);
  }

  /**
   * Atualiza todas as métricas
   */
  private updateAllMetrics(): void {
    for (const [providerName, metrics] of this.providerMetrics) {
      this.updateTrends(metrics);
    }
  }

  /**
   * Obtém métricas de um provedor
   */
  getProviderMetrics(providerName: string): EnhancedProviderMetrics | undefined {
    return this.providerMetrics.get(providerName);
  }

  /**
   * Obtém métricas de todos os provedores
   */
  getAllProviderMetrics(): EnhancedProviderMetrics[] {
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
  updateConfig(newConfig: Partial<EnhancedFailoverConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Atualiza retry service se necessário
    if (newConfig.retryConfig) {
      this.retryService.updateConfig(newConfig.retryConfig);
    }
  }

  /**
   * Obtém configuração atual
   */
  getConfig(): EnhancedFailoverConfig {
    return { ...this.config };
  }

  /**
   * Obtém estatísticas gerais do sistema
   */
  getSystemStats(): {
    totalProviders: number;
    healthyProviders: number;
    degradedProviders: number;
    unhealthyProviders: number;
    circuitBreakersOpen: number;
    averageSystemLatency: number;
    overallSuccessRate: number;
  } {
    const allProviders = this.providerRegistry.listActiveProviders();
    const allMetrics = this.getAllProviderMetrics();
    const totalProviders = allProviders.length;
    
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;
    let circuitBreakersOpen = 0;
    
    let totalLatency = 0;
    let totalRequests = 0;
    let totalSuccessful = 0;
    
    for (const metrics of allMetrics) {
      // Conta status baseado em métricas
      if (metrics.successRate >= 95 && metrics.averageLatency < 2000) {
        healthyCount++;
      } else if (metrics.successRate >= 80) {
        degradedCount++;
      } else {
        unhealthyCount++;
      }
      
      // Verifica circuit breakers
      if (this.config.useCircuitBreaker) {
        const cb = this.circuitBreakers.get(metrics.providerName);
        if (cb && !cb.canExecute()) {
          circuitBreakersOpen++;
        }
      }
    }
    
    // Verifica circuit breakers para provedores sem métricas
    if (this.config.useCircuitBreaker) {
      for (const provider of allProviders) {
        if (!allMetrics.find(m => m.providerName === provider.name)) {
          const cb = this.circuitBreakers.get(provider.name);
          if (cb && !cb.canExecute()) {
            circuitBreakersOpen++;
          }
        }
      }
    }
    
    return {
      totalProviders,
      healthyProviders: healthyCount,
      degradedProviders: degradedCount,
      unhealthyProviders: unhealthyCount,
      circuitBreakersOpen,
      averageSystemLatency: totalRequests > 0 ? totalLatency / totalRequests : 0,
      overallSuccessRate: totalRequests > 0 ? (totalSuccessful / totalRequests) * 100 : 0
    };
  }

  /**
   * Cleanup ao destruir a instância
   */
  destroy(): void {
    if (this.metricsUpdateTimer) {
      clearInterval(this.metricsUpdateTimer);
      this.metricsUpdateTimer = undefined;
    }
    this.resetAllMetrics();
  }
}