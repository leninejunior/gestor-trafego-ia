import { PaymentError, PaymentErrorType } from '../types';

/**
 * Estratégias de retry disponíveis
 */
export enum RetryStrategy {
  /** Intervalo fixo entre tentativas */
  FIXED = 'fixed',
  
  /** Backoff exponencial */
  EXPONENTIAL = 'exponential',
  
  /** Backoff linear */
  LINEAR = 'linear',
  
  /** Jitter exponencial (adiciona aleatoriedade) */
  EXPONENTIAL_JITTER = 'exponential_jitter'
}

/**
 * Configurações do sistema de retry
 */
export interface RetryConfig {
  /** Estratégia de retry */
  strategy: RetryStrategy;
  
  /** Número máximo de tentativas */
  maxAttempts: number;
  
  /** Delay inicial em ms */
  initialDelay: number;
  
  /** Delay máximo em ms */
  maxDelay: number;
  
  /** Multiplicador para backoff (usado em estratégias exponencial/linear) */
  multiplier: number;
  
  /** Jitter máximo em ms (para estratégia jitter) */
  maxJitter: number;
  
  /** Função para determinar se deve fazer retry */
  shouldRetry?: (error: any, attempt: number) => boolean;
  
  /** Callback executado antes de cada tentativa */
  onRetry?: (error: any, attempt: number, delay: number) => void;
}

/**
 * Resultado de uma operação com retry
 */
export interface RetryResult<T> {
  /** Resultado da operação */
  result: T;
  
  /** Número de tentativas realizadas */
  attempts: number;
  
  /** Tempo total gasto */
  totalTime: number;
  
  /** Erros ocorridos durante as tentativas */
  errors: Array<{
    attempt: number;
    error: any;
    timestamp: Date;
  }>;
}

/**
 * Serviço para implementar retry com diferentes estratégias
 */
export class RetryService {
  private config: RetryConfig;
  
  private readonly defaultConfig: RetryConfig = {
    strategy: RetryStrategy.EXPONENTIAL,
    maxAttempts: 3,
    initialDelay: 1000, // 1 segundo
    maxDelay: 30000, // 30 segundos
    multiplier: 2,
    maxJitter: 1000, // 1 segundo
    shouldRetry: this.defaultShouldRetry.bind(this)
  };

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Executa uma operação com retry automático
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationName?: string
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const errors: Array<{ attempt: number; error: any; timestamp: Date }> = [];
    
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        return {
          result,
          attempts: attempt,
          totalTime: Date.now() - startTime,
          errors
        };
        
      } catch (error) {
        lastError = error;
        errors.push({
          attempt,
          error,
          timestamp: new Date()
        });

        // Verifica se deve fazer retry
        if (!this.shouldRetry(error, attempt)) {
          break;
        }

        // Se não é a última tentativa, aplica delay
        if (attempt < this.config.maxAttempts) {
          const delay = this.calculateDelay(attempt);
          
          // Chama callback se definido
          if (this.config.onRetry) {
            try {
              this.config.onRetry(error, attempt, delay);
            } catch (callbackError) {
              // Log error silently - in production this would use proper logging
            }
          }

          await this.sleep(delay);
        }
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    throw this.createRetryExhaustedError(lastError, errors, operationName);
  }

  /**
   * Executa múltiplas operações com retry independente
   */
  async executeAll<T>(
    operations: Array<() => Promise<T>>,
    operationNames?: string[]
  ): Promise<RetryResult<T>[]> {
    const promises = operations.map((operation, index) => 
      this.execute(operation, operationNames?.[index])
    );
    
    return Promise.all(promises);
  }

  /**
   * Executa operações em sequência com retry
   */
  async executeSequential<T>(
    operations: Array<() => Promise<T>>,
    operationNames?: string[]
  ): Promise<RetryResult<T>[]> {
    const results: RetryResult<T>[] = [];
    
    for (let i = 0; i < operations.length; i++) {
      const result = await this.execute(operations[i], operationNames?.[i]);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Cria uma nova instância com configuração específica
   */
  withConfig(config: Partial<RetryConfig>): RetryService {
    return new RetryService({ ...this.config, ...config });
  }

  /**
   * Calcula o delay para a próxima tentativa
   */
  private calculateDelay(attempt: number): number {
    let delay: number;
    
    switch (this.config.strategy) {
      case RetryStrategy.FIXED:
        delay = this.config.initialDelay;
        break;
        
      case RetryStrategy.LINEAR:
        delay = this.config.initialDelay * attempt * this.config.multiplier;
        break;
        
      case RetryStrategy.EXPONENTIAL:
        delay = this.config.initialDelay * Math.pow(this.config.multiplier, attempt - 1);
        break;
        
      case RetryStrategy.EXPONENTIAL_JITTER:
        const exponentialDelay = this.config.initialDelay * Math.pow(this.config.multiplier, attempt - 1);
        const jitter = Math.random() * this.config.maxJitter;
        delay = exponentialDelay + jitter;
        break;
        
      default:
        delay = this.config.initialDelay;
    }
    
    // Aplica limite máximo
    return Math.min(delay, this.config.maxDelay);
  }

  /**
   * Determina se deve fazer retry baseado no erro e tentativa
   */
  private shouldRetry(error: any, attempt: number): boolean {
    // Se chegou no máximo de tentativas, não faz retry
    if (attempt >= this.config.maxAttempts) {
      return false;
    }

    // Usa função customizada se definida
    if (this.config.shouldRetry) {
      return this.config.shouldRetry(error, attempt);
    }

    return this.defaultShouldRetry(error, attempt);
  }

  /**
   * Lógica padrão para determinar se deve fazer retry
   */
  private defaultShouldRetry(error: any, _attempt: number): boolean {
    // PaymentError com flag retryable
    if (error instanceof PaymentError) {
      return error.retryable;
    }

    // Erros de rede são geralmente retryable
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND') {
      return true;
    }

    // Erros HTTP específicos
    if (error.status) {
      // 5xx - Erros do servidor
      if (error.status >= 500 && error.status < 600) {
        return true;
      }
      
      // 429 - Rate limit
      if (error.status === 429) {
        return true;
      }
      
      // 408 - Request timeout
      if (error.status === 408) {
        return true;
      }
      
      // 4xx - Erros do cliente (geralmente não retryable)
      if (error.status >= 400 && error.status < 500) {
        return false;
      }
    }

    // Timeout errors
    if (error.message && error.message.toLowerCase().includes('timeout')) {
      return true;
    }

    // Por padrão, não faz retry para erros desconhecidos
    return false;
  }

  /**
   * Cria erro quando todas as tentativas falharam
   */
  private createRetryExhaustedError(
    lastError: any,
    errors: Array<{ attempt: number; error: any; timestamp: Date }>,
    operationName?: string
  ): PaymentError {
    const operation = operationName ? ` for operation '${operationName}'` : '';
    const message = `All ${this.config.maxAttempts} retry attempts failed${operation}`;
    
    return new PaymentError(
      PaymentErrorType.UNKNOWN_ERROR,
      message,
      {
        lastError,
        allErrors: errors,
        totalAttempts: this.config.maxAttempts,
        strategy: this.config.strategy
      },
      false
    );
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtém configuração atual
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Atualiza configuração
   */
  updateConfig(newConfig: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * Instância global do RetryService com configuração padrão
 */
export const defaultRetryService = new RetryService();

/**
 * Decorator para adicionar retry automático a métodos
 */
export function withRetry(config?: Partial<RetryConfig>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const retryService = new RetryService(config);

    descriptor.value = async function (...args: any[]) {
      const result = await retryService.execute(
        () => originalMethod.apply(this, args),
        `${target.constructor.name}.${propertyKey}`
      );
      return result.result;
    };

    return descriptor;
  };
}

/**
 * Função utilitária para retry simples
 */
export async function retry<T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> {
  const retryService = new RetryService(config);
  const result = await retryService.execute(operation);
  return result.result;
}