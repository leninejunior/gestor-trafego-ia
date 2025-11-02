/**
 * Circuit Breaker Pattern Implementation
 * 
 * Implementa o padrão Circuit Breaker para proteger o sistema contra falhas
 * em cascata e melhorar a resiliência de chamadas para serviços externos.
 */

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  expectedErrors?: string[];
  name?: string;
}

export interface CircuitBreakerMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  failureRate: number;
  state: CircuitBreakerState;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  stateChangedAt: Date;
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly state: CircuitBreakerState,
    public readonly metrics: CircuitBreakerMetrics
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Circuit Breaker para proteger chamadas a serviços externos
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private stateChangedAt = new Date();
  private nextAttemptTime?: Date;

  constructor(
    private config: CircuitBreakerConfig,
    private name: string = 'CircuitBreaker'
  ) {
    this.validateConfig();
  }

  private validateConfig(): void {
    if (this.config.failureThreshold <= 0) {
      throw new Error('Failure threshold must be greater than 0');
    }
    if (this.config.recoveryTimeout <= 0) {
      throw new Error('Recovery timeout must be greater than 0');
    }
    if (this.config.monitoringPeriod <= 0) {
      throw new Error('Monitoring period must be greater than 0');
    }
  }

  /**
   * Executa uma operação protegida pelo circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const canExecute = this.canExecute();
    
    if (!canExecute) {
      const metrics = this.getMetrics();
      throw new CircuitBreakerError(
        `Circuit breaker is ${this.state}. Operation rejected.`,
        this.state,
        metrics
      );
    }

    const startTime = Date.now();
    
    try {
      const result = await operation();
      this.onSuccess();
      
      console.log(`[CircuitBreaker:${this.name}] Operation succeeded in ${Date.now() - startTime}ms`);
      return result;
      
    } catch (error) {
      this.onFailure(error as Error);
      
      console.error(`[CircuitBreaker:${this.name}] Operation failed in ${Date.now() - startTime}ms:`, error);
      throw error;
    }
  }

  /**
   * Verifica se a operação pode ser executada
   */
  private canExecute(): boolean {
    const now = new Date();
    
    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        return true;
        
      case CircuitBreakerState.OPEN:
        if (this.nextAttemptTime && now >= this.nextAttemptTime) {
          this.setState(CircuitBreakerState.HALF_OPEN);
          return true;
        }
        return false;
        
      case CircuitBreakerState.HALF_OPEN:
        return true;
        
      default:
        return false;
    }
  }

  /**
   * Manipula sucesso da operação
   */
  private onSuccess(): void {
    this.successCount++;
    this.totalRequests++;
    this.lastSuccessTime = new Date();
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.setState(CircuitBreakerState.CLOSED);
      this.resetCounts();
    }
    
    this.cleanupOldMetrics();
  }

  /**
   * Manipula falha da operação
   */
  private onFailure(error: Error): void {
    this.failureCount++;
    this.totalRequests++;
    this.lastFailureTime = new Date();
    
    // Verifica se é um erro esperado (não conta para o circuit breaker)
    if (this.isExpectedError(error)) {
      console.log(`[CircuitBreaker:${this.name}] Expected error, not counting towards failure threshold:`, error.message);
      return;
    }
    
    const failureRate = this.getFailureRate();
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Em half-open, qualquer falha volta para open
      this.setState(CircuitBreakerState.OPEN);
      this.setNextAttemptTime();
    } else if (
      this.state === CircuitBreakerState.CLOSED && 
      this.failureCount >= this.config.failureThreshold &&
      failureRate > 0.5 // 50% de falhas
    ) {
      this.setState(CircuitBreakerState.OPEN);
      this.setNextAttemptTime();
    }
    
    this.cleanupOldMetrics();
  }

  /**
   * Verifica se é um erro esperado
   */
  private isExpectedError(error: Error): boolean {
    if (!this.config.expectedErrors) {
      return false;
    }
    
    return this.config.expectedErrors.some(expectedError => 
      error.message.includes(expectedError) || 
      error.name.includes(expectedError)
    );
  }

  /**
   * Calcula a taxa de falhas
   */
  private getFailureRate(): number {
    if (this.totalRequests === 0) {
      return 0;
    }
    return this.failureCount / this.totalRequests;
  }

  /**
   * Define o próximo tempo de tentativa
   */
  private setNextAttemptTime(): void {
    this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
  }

  /**
   * Muda o estado do circuit breaker
   */
  private setState(newState: CircuitBreakerState): void {
    const oldState = this.state;
    this.state = newState;
    this.stateChangedAt = new Date();
    
    console.log(`[CircuitBreaker:${this.name}] State changed from ${oldState} to ${newState}`);
  }

  /**
   * Reseta contadores
   */
  private resetCounts(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.nextAttemptTime = undefined;
  }

  /**
   * Remove métricas antigas baseado no período de monitoramento
   */
  private cleanupOldMetrics(): void {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - this.config.monitoringPeriod);
    
    // Se a última falha foi há muito tempo, reseta contadores
    if (this.lastFailureTime && this.lastFailureTime < cutoffTime) {
      this.resetCounts();
    }
  }

  /**
   * Obtém métricas atuais do circuit breaker
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successCount,
      failedRequests: this.failureCount,
      failureRate: this.getFailureRate(),
      state: this.state,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChangedAt: this.stateChangedAt
    };
  }

  /**
   * Força o circuit breaker para um estado específico (para testes)
   */
  forceState(state: CircuitBreakerState): void {
    this.setState(state);
    if (state === CircuitBreakerState.CLOSED) {
      this.resetCounts();
    }
  }

  /**
   * Reseta o circuit breaker para o estado inicial
   */
  reset(): void {
    this.setState(CircuitBreakerState.CLOSED);
    this.resetCounts();
  }

  /**
   * Verifica se o circuit breaker está saudável
   */
  isHealthy(): boolean {
    return this.state === CircuitBreakerState.CLOSED || 
           (this.state === CircuitBreakerState.HALF_OPEN && this.getFailureRate() < 0.5);
  }
}

/**
 * Factory para criar circuit breakers com configurações pré-definidas
 */
export class CircuitBreakerFactory {
  private static instances = new Map<string, CircuitBreaker>();

  /**
   * Cria ou obtém um circuit breaker para chamadas ao Iugu
   */
  static getIuguCircuitBreaker(): CircuitBreaker {
    const name = 'iugu-api';
    
    if (!this.instances.has(name)) {
      const config: CircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTimeout: 30000, // 30 segundos
        monitoringPeriod: 60000, // 1 minuto
        expectedErrors: ['400', 'Validation', 'Invalid'], // Erros de validação não contam
        name
      };
      
      this.instances.set(name, new CircuitBreaker(config, name));
    }
    
    return this.instances.get(name)!;
  }

  /**
   * Cria ou obtém um circuit breaker para operações de banco de dados
   */
  static getDatabaseCircuitBreaker(): CircuitBreaker {
    const name = 'database';
    
    if (!this.instances.has(name)) {
      const config: CircuitBreakerConfig = {
        failureThreshold: 3,
        recoveryTimeout: 10000, // 10 segundos
        monitoringPeriod: 30000, // 30 segundos
        expectedErrors: ['PGRST116'], // Not found errors não contam
        name
      };
      
      this.instances.set(name, new CircuitBreaker(config, name));
    }
    
    return this.instances.get(name)!;
  }

  /**
   * Cria ou obtém um circuit breaker para serviços externos genéricos
   */
  static getExternalServiceCircuitBreaker(serviceName: string): CircuitBreaker {
    const name = `external-${serviceName}`;
    
    if (!this.instances.has(name)) {
      const config: CircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minuto
        monitoringPeriod: 120000, // 2 minutos
        name
      };
      
      this.instances.set(name, new CircuitBreaker(config, name));
    }
    
    return this.instances.get(name)!;
  }

  /**
   * Obtém métricas de todos os circuit breakers
   */
  static getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    
    this.instances.forEach((breaker, name) => {
      metrics[name] = breaker.getMetrics();
    });
    
    return metrics;
  }

  /**
   * Reseta todos os circuit breakers
   */
  static resetAll(): void {
    this.instances.forEach(breaker => breaker.reset());
  }
}