import { IPaymentProvider } from '../interfaces/payment-provider.interface';
import { ProviderStatus, PaymentError, PaymentErrorType } from '../types';
import { ProviderRegistry } from './provider-registry';

/**
 * Configurações do health checker
 */
export interface HealthCheckerConfig {
  /** Intervalo entre verificações em ms */
  checkInterval: number;
  
  /** Timeout para cada verificação em ms */
  checkTimeout: number;
  
  /** Número de falhas consecutivas para marcar como unhealthy */
  failureThreshold: number;
  
  /** Número de sucessos consecutivos para marcar como healthy */
  recoveryThreshold: number;
  
  /** Se deve executar verificações automáticas */
  autoCheck: boolean;
  
  /** Provedores a serem ignorados nas verificações */
  excludedProviders: string[];
}

/**
 * Resultado de uma verificação de saúde
 */
export interface HealthCheckResult {
  /** Nome do provedor */
  providerName: string;
  
  /** Status da verificação */
  status: ProviderStatus;
  
  /** Tempo de resposta em ms */
  responseTime: number;
  
  /** Timestamp da verificação */
  timestamp: Date;
  
  /** Erro se houver */
  error?: string;
  
  /** Detalhes adicionais */
  details?: Record<string, any>;
}

/**
 * Histórico de verificações de um provedor
 */
interface ProviderHealthHistory {
  providerName: string;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastCheck: Date;
  currentStatus: ProviderStatus;
  history: HealthCheckResult[];
  maxHistorySize: number;
}

/**
 * Callback para eventos de mudança de status
 */
export type HealthStatusChangeCallback = (
  providerName: string,
  oldStatus: ProviderStatus,
  newStatus: ProviderStatus,
  result: HealthCheckResult
) => void;

/**
 * Serviço para monitoramento automático da saúde dos provedores
 */
export class HealthChecker {
  private static instance: HealthChecker;
  private intervalId?: NodeJS.Timeout;
  private providerHistory: Map<string, ProviderHealthHistory> = new Map();
  private statusChangeCallbacks: HealthStatusChangeCallback[] = [];
  private config: HealthCheckerConfig;
  
  private readonly defaultConfig: HealthCheckerConfig = {
    checkInterval: 30000, // 30 segundos
    checkTimeout: 10000, // 10 segundos
    failureThreshold: 3,
    recoveryThreshold: 2,
    autoCheck: true,
    excludedProviders: []
  };

  private constructor(
    config: Partial<HealthCheckerConfig> = {},
    private providerRegistry: ProviderRegistry = ProviderRegistry.getInstance()
  ) {
    this.config = { ...this.defaultConfig, ...config };
    
    if (this.config.autoCheck) {
      this.startAutoCheck();
    }
  }

  /**
   * Singleton instance
   */
  static getInstance(config?: Partial<HealthCheckerConfig>): HealthChecker {
    if (!HealthChecker.instance) {
      HealthChecker.instance = new HealthChecker(config);
    }
    return HealthChecker.instance;
  }

  /**
   * Inicia verificações automáticas
   */
  startAutoCheck(): void {
    if (this.intervalId) {
      this.stopAutoCheck();
    }

    this.intervalId = setInterval(async () => {
      try {
        await this.checkAllProviders();
      } catch (error) {
        // Log error silently - in production this would use proper logging
      }
    }, this.config.checkInterval);
  }

  /**
   * Para verificações automáticas
   */
  stopAutoCheck(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Verifica a saúde de todos os provedores ativos
   */
  async checkAllProviders(): Promise<HealthCheckResult[]> {
    const providers = this.providerRegistry.listActiveProviders();
    const results: HealthCheckResult[] = [];

    for (const provider of providers) {
      if (this.config.excludedProviders.includes(provider.name)) {
        continue;
      }

      try {
        const result = await this.checkProvider(provider);
        results.push(result);
      } catch (error) {
        const errorResult: HealthCheckResult = {
          providerName: provider.name,
          status: ProviderStatus.UNHEALTHY,
          responseTime: 0,
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        results.push(errorResult);
        this.updateProviderHistory(errorResult);
      }
    }

    return results;
  }

  /**
   * Verifica a saúde de um provedor específico
   */
  async checkProvider(provider: IPaymentProvider): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Executa health check com timeout
      const healthStatus = await this.executeWithTimeout(
        () => provider.healthCheck(),
        this.config.checkTimeout
      );

      const responseTime = Date.now() - startTime;
      
      const result: HealthCheckResult = {
        providerName: provider.name,
        status: healthStatus.status,
        responseTime,
        timestamp: new Date(),
        details: {
          ...healthStatus.details,
          originalStatus: healthStatus.status,
          responseTimeMs: responseTime
        }
      };

      this.updateProviderHistory(result);
      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      const result: HealthCheckResult = {
        providerName: provider.name,
        status: ProviderStatus.UNHEALTHY,
        responseTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Health check failed'
      };

      this.updateProviderHistory(result);
      return result;
    }
  }

  /**
   * Obtém o status atual de um provedor
   */
  getProviderStatus(providerName: string): ProviderStatus | undefined {
    const history = this.providerHistory.get(providerName);
    return history?.currentStatus;
  }

  /**
   * Obtém o histórico de um provedor
   */
  getProviderHistory(providerName: string): HealthCheckResult[] {
    const history = this.providerHistory.get(providerName);
    return history?.history || [];
  }

  /**
   * Obtém estatísticas de um provedor
   */
  getProviderStats(providerName: string): {
    currentStatus: ProviderStatus;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    lastCheck: Date;
    averageResponseTime: number;
    uptime: number;
  } | undefined {
    const history = this.providerHistory.get(providerName);
    if (!history) return undefined;

    const recentChecks = history.history.slice(-10); // Últimas 10 verificações
    const averageResponseTime = recentChecks.length > 0
      ? recentChecks.reduce((sum, check) => sum + check.responseTime, 0) / recentChecks.length
      : 0;

    const healthyChecks = recentChecks.filter(check => 
      check.status === ProviderStatus.HEALTHY || check.status === ProviderStatus.DEGRADED
    ).length;
    
    const uptime = recentChecks.length > 0 ? (healthyChecks / recentChecks.length) * 100 : 0;

    return {
      currentStatus: history.currentStatus,
      consecutiveFailures: history.consecutiveFailures,
      consecutiveSuccesses: history.consecutiveSuccesses,
      lastCheck: history.lastCheck,
      averageResponseTime: Math.round(averageResponseTime),
      uptime: Math.round(uptime * 100) / 100
    };
  }

  /**
   * Obtém resumo de todos os provedores
   */
  getAllProvidersStatus(): Map<string, ProviderStatus> {
    const statusMap = new Map<string, ProviderStatus>();
    
    for (const [providerName, history] of this.providerHistory) {
      statusMap.set(providerName, history.currentStatus);
    }
    
    return statusMap;
  }

  /**
   * Adiciona callback para mudanças de status
   */
  onStatusChange(callback: HealthStatusChangeCallback): void {
    this.statusChangeCallbacks.push(callback);
  }

  /**
   * Remove callback de mudanças de status
   */
  removeStatusChangeCallback(callback: HealthStatusChangeCallback): void {
    const index = this.statusChangeCallbacks.indexOf(callback);
    if (index > -1) {
      this.statusChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Força uma verificação imediata de todos os provedores
   */
  async forceCheckAll(): Promise<HealthCheckResult[]> {
    return this.checkAllProviders();
  }

  /**
   * Força uma verificação imediata de um provedor específico
   */
  async forceCheck(providerName: string): Promise<HealthCheckResult | null> {
    const provider = this.providerRegistry.getProvider(providerName);
    if (!provider) {
      return null;
    }
    
    return this.checkProvider(provider);
  }

  /**
   * Limpa o histórico de um provedor
   */
  clearProviderHistory(providerName: string): void {
    this.providerHistory.delete(providerName);
  }

  /**
   * Limpa todo o histórico
   */
  clearAllHistory(): void {
    this.providerHistory.clear();
  }

  /**
   * Atualiza configuração
   */
  updateConfig(newConfig: Partial<HealthCheckerConfig>): void {
    const oldAutoCheck = this.config.autoCheck;
    this.config = { ...this.config, ...newConfig };
    
    // Reinicia auto check se necessário
    if (this.config.autoCheck && !oldAutoCheck) {
      this.startAutoCheck();
    } else if (!this.config.autoCheck && oldAutoCheck) {
      this.stopAutoCheck();
    } else if (this.config.autoCheck && this.intervalId) {
      // Reinicia com novo intervalo
      this.stopAutoCheck();
      this.startAutoCheck();
    }
  }

  /**
   * Obtém configuração atual
   */
  getConfig(): HealthCheckerConfig {
    return { ...this.config };
  }

  /**
   * Atualiza histórico de um provedor
   */
  private updateProviderHistory(result: HealthCheckResult): void {
    let history = this.providerHistory.get(result.providerName);
    
    if (!history) {
      history = {
        providerName: result.providerName,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        lastCheck: result.timestamp,
        currentStatus: result.status,
        history: [],
        maxHistorySize: 50
      };
      this.providerHistory.set(result.providerName, history);
    }

    const oldStatus = history.currentStatus;
    
    // Atualiza contadores
    if (result.status === ProviderStatus.HEALTHY || result.status === ProviderStatus.DEGRADED) {
      history.consecutiveSuccesses++;
      history.consecutiveFailures = 0;
    } else {
      history.consecutiveFailures++;
      history.consecutiveSuccesses = 0;
    }

    // Determina novo status baseado nos thresholds
    let newStatus = result.status;
    
    if (history.consecutiveFailures >= this.config.failureThreshold) {
      newStatus = ProviderStatus.UNHEALTHY;
    } else if (history.currentStatus === ProviderStatus.UNHEALTHY && 
               history.consecutiveSuccesses >= this.config.recoveryThreshold) {
      newStatus = ProviderStatus.HEALTHY;
    }

    // Atualiza histórico
    history.currentStatus = newStatus;
    history.lastCheck = result.timestamp;
    history.history.push({ ...result, status: newStatus });

    // Limita tamanho do histórico
    if (history.history.length > history.maxHistorySize) {
      history.history = history.history.slice(-history.maxHistorySize);
    }

    // Notifica mudança de status se houver
    if (oldStatus !== newStatus) {
      this.notifyStatusChange(result.providerName, oldStatus, newStatus, result);
    }
  }

  /**
   * Notifica callbacks sobre mudança de status
   */
  private notifyStatusChange(
    providerName: string,
    oldStatus: ProviderStatus,
    newStatus: ProviderStatus,
    result: HealthCheckResult
  ): void {
    for (const callback of this.statusChangeCallbacks) {
      try {
        callback(providerName, oldStatus, newStatus, result);
      } catch (error) {
        // Log error silently - in production this would use proper logging
      }
    }
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
          `Health check timed out after ${timeout}ms`,
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
   * Cleanup ao destruir a instância
   */
  destroy(): void {
    this.stopAutoCheck();
    this.statusChangeCallbacks = [];
    this.providerHistory.clear();
  }
}