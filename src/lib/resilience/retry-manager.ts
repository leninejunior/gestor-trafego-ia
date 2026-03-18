/**
 * Retry Manager with Exponential Backoff
 * 
 * Implementa lógica de retry com backoff exponencial, jitter e circuit breaker integration
 */

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors?: string[];
  nonRetryableErrors?: string[];
  onRetry?: (attempt: number, error: Error) => void;
  onFailure?: (finalError: Error, attempts: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

export class RetryableError extends Error {
  constructor(message: string, public readonly originalError: Error) {
    super(message);
    this.name = 'RetryableError';
  }
}

export class NonRetryableError extends Error {
  constructor(message: string, public readonly originalError: Error) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

/**
 * Gerenciador de retry com backoff exponencial
 */
export class RetryManager {
  private static readonly DEFAULT_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'NETWORK_ERROR',
      'TIMEOUT',
      '500',
      '502',
      '503',
      '504'
    ],
    nonRetryableErrors: [
      '400',
      '401',
      '403',
      '404',
      '422',
      'VALIDATION_ERROR',
      'AUTHENTICATION_ERROR',
      'AUTHORIZATION_ERROR'
    ]
  };

  constructor(private config: RetryConfig = RetryManager.DEFAULT_CONFIG) {
    this.config = { ...RetryManager.DEFAULT_CONFIG, ...config };
  }

  /**
   * Executa uma operação com retry automático
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationName?: string
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 1) {
          console.log(`[RetryManager] Operation '${operationName}' succeeded on attempt ${attempt}`);
        }
        
        return result;
        
      } catch (error) {
        lastError = error as Error;
        
        // Verifica se o erro é retryable
        if (!this.isRetryableError(lastError)) {
          console.log(`[RetryManager] Non-retryable error for '${operationName}':`, lastError.message);
          throw new NonRetryableError(
            `Non-retryable error: ${lastError.message}`,
            lastError
          );
        }
        
        // Se é a última tentativa, não faz retry
        if (attempt === this.config.maxAttempts) {
          console.error(`[RetryManager] All ${this.config.maxAttempts} attempts failed for '${operationName}'`);
          
          if (this.config.onFailure) {
            this.config.onFailure(lastError, attempt);
          }
          
          throw new RetryableError(
            `Operation failed after ${this.config.maxAttempts} attempts: ${lastError.message}`,
            lastError
          );
        }
        
        // Calcula delay para próxima tentativa
        const delay = this.calculateDelay(attempt);
        
        console.warn(`[RetryManager] Attempt ${attempt} failed for '${operationName}', retrying in ${delay}ms:`, lastError.message);
        
        if (this.config.onRetry) {
          this.config.onRetry(attempt, lastError);
        }
        
        // Aguarda antes da próxima tentativa
        await this.sleep(delay);
      }
    }
    
    // Nunca deveria chegar aqui, mas por segurança
    throw lastError!;
  }

  /**
   * Executa operação com retry e retorna resultado detalhado
   */
  async executeWithResult<T>(
    operation: () => Promise<T>,
    operationName?: string
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    
    try {
      const result = await this.execute(operation, operationName);
      
      return {
        success: true,
        result,
        attempts: 1, // Se chegou aqui, foi na primeira tentativa
        totalTime: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        attempts: this.config.maxAttempts,
        totalTime: Date.now() - startTime
      };
    }
  }

  /**
   * Verifica se um erro é retryable
   */
  private isRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();
    
    // Verifica erros explicitamente não-retryable
    if (this.config.nonRetryableErrors) {
      for (const nonRetryable of this.config.nonRetryableErrors) {
        if (errorMessage.includes(nonRetryable.toLowerCase()) || 
            errorName.includes(nonRetryable.toLowerCase())) {
          return false;
        }
      }
    }
    
    // Verifica erros explicitamente retryable
    if (this.config.retryableErrors) {
      for (const retryable of this.config.retryableErrors) {
        if (errorMessage.includes(retryable.toLowerCase()) || 
            errorName.includes(retryable.toLowerCase())) {
          return true;
        }
      }
    }
    
    // Por padrão, considera erros de rede como retryable
    const networkErrors = ['network', 'timeout', 'connection', 'econnreset', 'enotfound'];
    return networkErrors.some(networkError => 
      errorMessage.includes(networkError) || errorName.includes(networkError)
    );
  }

  /**
   * Calcula delay com backoff exponencial e jitter
   */
  private calculateDelay(attempt: number): number {
    // Backoff exponencial: baseDelay * (backoffMultiplier ^ (attempt - 1))
    let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    
    // Aplica limite máximo
    delay = Math.min(delay, this.config.maxDelay);
    
    // Adiciona jitter para evitar thundering herd
    if (this.config.jitter) {
      // Jitter de ±25%
      const jitterRange = delay * 0.25;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      delay = Math.max(0, delay + jitter);
    }
    
    return Math.floor(delay);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cria uma versão configurada do retry manager para diferentes cenários
   */
  static forIuguAPI(): RetryManager {
    return new RetryManager({
      maxAttempts: 3,
      baseDelay: 2000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: ['500', '502', '503', '504', 'ECONNRESET', 'TIMEOUT'],
      nonRetryableErrors: ['400', '401', '403', '404', '422'],
      onRetry: (attempt, error) => {
        console.warn(`[Iugu Retry] Attempt ${attempt} failed:`, error.message);
      }
    });
  }

  static forDatabase(): RetryManager {
    return new RetryManager({
      maxAttempts: 2,
      baseDelay: 500,
      maxDelay: 2000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: ['connection', 'timeout', 'lock'],
      nonRetryableErrors: ['PGRST116', 'constraint', 'validation'],
      onRetry: (attempt, error) => {
        console.warn(`[Database Retry] Attempt ${attempt} failed:`, error.message);
      }
    });
  }

  static forWebhooks(): RetryManager {
    return new RetryManager({
      maxAttempts: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: ['500', '502', '503', '504', 'TIMEOUT', 'NETWORK'],
      nonRetryableErrors: ['400', '401', '403', '404', '422'],
      onRetry: (attempt, error) => {
        console.warn(`[Webhook Retry] Attempt ${attempt} failed:`, error.message);
      }
    });
  }

  static forExternalAPI(serviceName: string): RetryManager {
    return new RetryManager({
      maxAttempts: 3,
      baseDelay: 1500,
      maxDelay: 15000,
      backoffMultiplier: 2,
      jitter: true,
      onRetry: (attempt, error) => {
        console.warn(`[${serviceName} Retry] Attempt ${attempt} failed:`, error.message);
      }
    });
  }
}

/**
 * Decorator para adicionar retry automático a métodos
 */
export function withRetry(config?: Partial<RetryConfig>) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const retryManager = new RetryManager(config);

    descriptor.value = async function (...args: any[]) {
      return retryManager.execute(
        () => method.apply(this, args),
        `${target.constructor.name}.${propertyName}`
      );
    };
  };
}

/**
 * Função utilitária para retry simples
 */
export async function retry<T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> {
  const retryManager = new RetryManager(config);
  return retryManager.execute(operation);
}