/**
 * Estados do Circuit Breaker
 */
export enum CircuitBreakerState {
  /** Circuito fechado - operações normais */
  CLOSED = 'closed',
  
  /** Circuito aberto - bloqueando requisições */
  OPEN = 'open',
  
  /** Meio aberto - testando se pode fechar */
  HALF_OPEN = 'half_open'
}

/**
 * Configurações do Circuit Breaker
 */
export interface CircuitBreakerConfig {
  /** Número de falhas consecutivas para abrir o circuito */
  failureThreshold: number;
  
  /** Tempo em ms para tentar fechar o circuito após abrir */
  recoveryTimeout: number;
  
  /** Período de monitoramento em ms */
  monitoringPeriod: number;
  
  /** Número de sucessos consecutivos para fechar o circuito no estado HALF_OPEN */
  successThreshold?: number;
}

/**
 * Métricas do Circuit Breaker
 */
export interface CircuitBreakerMetrics {
  /** Estado atual */
  state: CircuitBreakerState;
  
  /** Número de falhas consecutivas */
  consecutiveFailures: number;
  
  /** Número de sucessos consecutivos (no estado HALF_OPEN) */
  consecutiveSuccesses: number;
  
  /** Timestamp da última falha */
  lastFailureTime?: Date;
  
  /** Timestamp da última mudança de estado */
  lastStateChange: Date;
  
  /** Total de requisições no período atual */
  totalRequests: number;
  
  /** Total de falhas no período atual */
  totalFailures: number;
  
  /** Taxa de falha no período atual (0-100) */
  failureRate: number;
}

/**
 * Implementação do padrão Circuit Breaker
 * 
 * O Circuit Breaker previne cascata de falhas ao detectar quando um serviço
 * está falhando e temporariamente bloquear requisições para ele.
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime?: Date;
  private lastStateChange = new Date();
  private totalRequests = 0;
  private totalFailures = 0;
  private periodStartTime = new Date();

  private readonly config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      successThreshold: 3,
      ...config
    };
  }

  /**
   * Verifica se uma operação pode ser executada
   */
  canExecute(): boolean {
    this.updateStateIfNeeded();
    
    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        return true;
        
      case CircuitBreakerState.OPEN:
        return false;
        
      case CircuitBreakerState.HALF_OPEN:
        return true;
        
      default:
        return false;
    }
  }

  /**
   * Registra uma execução bem-sucedida
   */
  recordSuccess(): void {
    this.totalRequests++;
    this.consecutiveFailures = 0;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.consecutiveSuccesses++;
      
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo(CircuitBreakerState.CLOSED);
        this.consecutiveSuccesses = 0;
      }
    }
    
    this.resetPeriodIfNeeded();
  }

  /**
   * Registra uma falha na execução
   */
  recordFailure(): void {
    this.totalRequests++;
    this.totalFailures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = new Date();
    
    if (this.state === CircuitBreakerState.CLOSED) {
      if (this.consecutiveFailures >= this.config.failureThreshold) {
        this.transitionTo(CircuitBreakerState.OPEN);
      }
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Volta para OPEN se falhar no estado HALF_OPEN
      this.transitionTo(CircuitBreakerState.OPEN);
    }
    
    this.resetPeriodIfNeeded();
  }

  /**
   * Obtém métricas atuais do circuit breaker
   */
  getMetrics(): CircuitBreakerMetrics {
    this.updateStateIfNeeded();
    
    const failureRate = this.totalRequests > 0 
      ? (this.totalFailures / this.totalRequests) * 100 
      : 0;

    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      failureRate: Math.round(failureRate * 100) / 100
    };
  }

  /**
   * Força uma mudança de estado (útil para testes)
   */
  forceState(newState: CircuitBreakerState): void {
    this.transitionTo(newState);
  }

  /**
   * Reseta o circuit breaker para o estado inicial
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = undefined;
    this.lastStateChange = new Date();
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.periodStartTime = new Date();
  }

  /**
   * Atualiza o estado se necessário baseado no tempo
   */
  private updateStateIfNeeded(): void {
    if (this.state === CircuitBreakerState.OPEN && this.shouldTransitionToHalfOpen()) {
      this.transitionTo(CircuitBreakerState.HALF_OPEN);
    }
  }

  /**
   * Verifica se deve transicionar de OPEN para HALF_OPEN
   */
  private shouldTransitionToHalfOpen(): boolean {
    if (!this.lastFailureTime) {
      return false;
    }
    
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.recoveryTimeout;
  }

  /**
   * Transiciona para um novo estado
   */
  private transitionTo(newState: CircuitBreakerState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.lastStateChange = new Date();
      
      // Reseta contadores específicos do estado
      if (newState === CircuitBreakerState.CLOSED) {
        this.consecutiveFailures = 0;
        this.consecutiveSuccesses = 0;
      } else if (newState === CircuitBreakerState.HALF_OPEN) {
        this.consecutiveSuccesses = 0;
      }
    }
  }

  /**
   * Reseta o período de monitoramento se necessário
   */
  private resetPeriodIfNeeded(): void {
    const timeSincePeriodStart = Date.now() - this.periodStartTime.getTime();
    
    if (timeSincePeriodStart >= this.config.monitoringPeriod) {
      this.totalRequests = 0;
      this.totalFailures = 0;
      this.periodStartTime = new Date();
    }
  }

  /**
   * Obtém configuração atual
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * Atualiza configuração
   */
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    Object.assign(this.config, newConfig);
  }
}